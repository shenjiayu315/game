import { GameProvider, useGame } from "./GameProvider";
import { GameShell } from "../ui/layout/GameShell";
import { TitleScreen } from "../ui/title/TitleScreen";

function AppContent() {
  const { screen } = useGame();
  return screen === "title" ? <TitleScreen /> : <GameShell />;
}

export function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
