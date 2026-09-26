import { Play, RotateCcw } from "lucide-react";
import { useGame } from "../../app/GameProvider";
import { loadContent } from "../../content/loader";

const content = loadContent();

export function TitleScreen() {
  const { dispatch, saveStatus } = useGame();

  return (
    <main className="title-screen">
      <section className="title-panel">
        <p className="eyebrow">文字动态版 v0.1</p>
        <h1>神树：从初醒到临战</h1>
        <p className="title-copy">
          在蛮荒林地中苏醒，伸展根系，回应第一个人类，并在部落公开祭祀后走向临战前夜。
        </p>
        <div className="title-actions">
          <button className="primary-button" type="button" onClick={() => dispatch({ type: "START_NEW_GAME" })}>
            <Play size={18} />
            进入游戏
          </button>
          <button className="secondary-button" type="button" disabled={!saveStatus.hasSave} onClick={() => dispatch({ type: "LOAD_GAME" })}>
            <RotateCcw size={18} />
            继续游戏
          </button>
        </div>
        <p className="save-hint">{saveStatus.hasSave ? saveStatus.reason : "暂无可继续的手动存档"}</p>
        <p className="version-line">{content.version}</p>
      </section>
    </main>
  );
}
