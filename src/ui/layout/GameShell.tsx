import { Home, Pause, Play, Save, Zap } from "lucide-react";
import { useGame } from "../../app/GameProvider";
import { formatDate, isPaused } from "../../engine/engine";
import { MainView } from "../main-view/MainView";
import { LeftStatusPanel } from "../panels/LeftStatusPanel";
import { RightInfoPanel } from "../panels/RightInfoPanel";

export function GameShell() {
  const { state, dispatch } = useGame();
  if (!state) return null;

  const paused = isPaused(state);
  const blocked = state.blockingReasons.length > 0 || state.runtimeMode !== "observing";

  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">章节一</p>
          <h1>从初醒到临战</h1>
        </div>
        <div className="date-block">
          <span>{formatDate(state.date)}</span>
          <small>{blocked ? `临时阻塞：${state.blockingReasons.join("、") || state.runtimeMode}` : state.recentMessage}</small>
        </div>
        <nav className="top-actions" aria-label="时间与存档">
          <button className={paused ? "icon-button active" : "icon-button"} type="button" onClick={() => dispatch({ type: "SET_SPEED", speed: 0 })} title="暂停">
            <Pause size={17} />
          </button>
          <button className={state.preferredSpeed === 1 ? "speed-button active" : "speed-button"} type="button" onClick={() => dispatch({ type: "SET_SPEED", speed: 1 })}>
            <Play size={16} />
            1x
          </button>
          <button className={state.preferredSpeed === 3 ? "speed-button active" : "speed-button"} type="button" onClick={() => dispatch({ type: "SET_SPEED", speed: 3 })}>
            <Zap size={16} />
            3x
          </button>
          <button className="icon-button" type="button" onClick={() => dispatch({ type: "SAVE_GAME" })} title="保存">
            <Save size={17} />
          </button>
          <button className="icon-button" type="button" onClick={() => dispatch({ type: "RETURN_TO_TITLE" })} title="返回标题">
            <Home size={17} />
          </button>
        </nav>
      </header>
      {state.saveMessage ? <div className="toast-line">{state.saveMessage}</div> : null}
      <section className="game-grid">
        <LeftStatusPanel state={state} />
        <MainView state={state} />
        <RightInfoPanel state={state} />
      </section>
    </main>
  );
}
