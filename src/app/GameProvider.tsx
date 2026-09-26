import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { loadContent } from "../content/loader";
import { createInitialGameState, reduceGame } from "../engine/engine";
import { getSaveStatus, loadSavedGame, saveGame } from "../engine/persistence/save";
import type { GameCommand, GameState } from "../engine/types";

interface GameContextValue {
  state: GameState | null;
  dispatch: (command: GameCommand) => void;
  screen: "title" | "game";
  setScreen: (screen: "title" | "game") => void;
  saveStatus: { hasSave: boolean; reason: string; savedAt?: string };
  refreshSaveStatus: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);
const content = loadContent();

function reducer(state: GameState | null, command: GameCommand): GameState | null {
  if (command.type === "START_NEW_GAME") return createInitialGameState(command.seed);
  if (command.type === "LOAD_GAME") return command.state ? reduceGame(command.state, command) : state;
  if (!state) return state;
  if (command.type === "SAVE_GAME") {
    const result = saveGame(state);
    if (result.ok) return { ...state, saveMessage: `已保存：${new Date(result.savedAt).toLocaleString()}` };
    return { ...state, saveMessage: result.error };
  }
  return reduceGame(state, command);
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, null);
  const [screen, setScreen] = useState<"title" | "game">("title");
  const [saveStatus, setSaveStatus] = useState(() => getSaveStatus(content.version));

  const refreshSaveStatus = useCallback(() => setSaveStatus(getSaveStatus(content.version)), []);

  const dispatch = useCallback((command: GameCommand) => {
    if (command.type === "LOAD_GAME") {
      const loaded = loadSavedGame(content.version);
      if (loaded.ok) {
        rawDispatch({ type: "LOAD_GAME", state: loaded.state });
        setScreen("game");
      } else {
        refreshSaveStatus();
      }
      return;
    }
    if (command.type === "START_NEW_GAME") setScreen("game");
    if (command.type === "RETURN_TO_TITLE") {
      setScreen("title");
      refreshSaveStatus();
      return;
    }
    rawDispatch(command);
    if (command.type === "SAVE_GAME") window.setTimeout(refreshSaveStatus, 0);
  }, [refreshSaveStatus]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && state) rawDispatch({ type: "SET_BACKGROUND_PAUSE", paused: true });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [state]);

  useEffect(() => {
    if (!state || state.preferredSpeed === 0 || state.blockingReasons.length > 0 || state.runtimeMode !== "observing") return;
    const interval = window.setInterval(() => {
      const ticks = state.preferredSpeed === 3 ? 3 : 1;
      for (let index = 0; index < ticks; index += 1) {
        rawDispatch({ type: "ADVANCE_DAY" });
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [state?.preferredSpeed, state?.blockingReasons.length, state?.runtimeMode]);

  const value = useMemo(() => ({ state, dispatch, screen, setScreen, saveStatus, refreshSaveStatus }), [state, dispatch, screen, saveStatus, refreshSaveStatus]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used inside GameProvider");
  return context;
}
