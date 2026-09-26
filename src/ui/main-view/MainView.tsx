import { Check, CircleDot, ShieldAlert } from "lucide-react";
import { useGame } from "../../app/GameProvider";
import { loadContent } from "../../content/loader";
import { formatDate, getCurrentDecision, getPhaseSummary, getPhaseTitle, isPaused } from "../../engine/engine";
import type { DecisionOptionDefinition, GameReport, GameState } from "../../engine/types";

const content = loadContent();

export function MainView({ state }: { state: GameState }) {
  return (
    <section className={state.currentDecision || state.pendingResult ? "main-with-modal dimmed-world" : "main-with-modal"}>
      <ObservationView state={state} />
      {state.chapterResult && state.runtimeMode === "summary" ? <ChapterSummary state={state} /> : null}
      {state.currentDecision ? <DecisionModal state={state} /> : null}
      {state.pendingResult && state.runtimeMode === "result" ? <ResultModal report={state.pendingResult} /> : null}
    </section>
  );
}

function ObservationView({ state }: { state: GameState }) {
  const paused = isPaused(state);
  const nextDate = state.currentOracleId ? state.nextOracleReviewDay : state.nextDivineChoiceDay;
  return (
    <section className="main-stack">
      <section className="main-card observe-card">
        <p className="eyebrow">{paused ? "世界暂时停住" : "世界正在流动"}</p>
        <h2>{getPhaseTitle(state.phaseId, content)}</h2>
        <p className="lead">{getPhaseSummary(state.phaseId, content)}</p>
        <div className="timeline-strip">
          <span className={paused ? "status-chip warn" : "status-chip good"}>{paused ? "阻塞或暂停" : `${state.preferredSpeed}倍运行`}</span>
          <span className="status-chip">神力今日 {signed(state.lastDailyDelta.power)}</span>
          <span className="status-chip">粮食今日 {signed(state.lastDailyDelta.food)}</span>
          {nextDate ? <span className="status-chip">下次抉择 第{nextDate}日</span> : null}
        </div>
      </section>

      <section className="main-card">
        <p className="eyebrow">{state.currentOracleId ? "长期神谕" : "当前神意"}</p>
        {state.currentOracleId ? (
          <>
            <h2>{oracleLabel(state.currentOracleId)}</h2>
            <p className="lead">这道神谕会持续影响部落自主行动评分，但不会直接控制每个族人。</p>
            <div className="fact-grid">
              <Fact label="下次调整" value={state.nextOracleReviewDay ? `第${state.nextOracleReviewDay}日` : "未定"} />
              <Fact label="部落回应" value={state.tribe.plan?.response ?? "等待评估"} />
            </div>
          </>
        ) : state.currentDivineFocus ? (
          <>
            <h2>{state.currentDivineFocus.label}</h2>
            <p className="lead">{state.currentDivineFocus.summary}</p>
            <div className="fact-grid">
              <Fact label="持续至" value={`第${state.currentDivineFocus.endsOn}日`} />
              <Fact label="来源" value="神意抉择" />
            </div>
          </>
        ) : (
          <>
            <h2>尚未形成当前神意</h2>
            <p className="lead">世界会先流动数日，直到神树必须把注意力投向某个方向。</p>
          </>
        )}
      </section>

      <section className="main-card">
        <p className="eyebrow">最近发生</p>
        <div className="activity-list">
          {[...state.activityLog].reverse().slice(0, 6).map((entry) => (
            <p key={entry.id} className={`activity-line ${entry.tone ?? "neutral"}`}>
              <span>第{entry.day}日</span>
              {entry.text}
            </p>
          ))}
        </div>
      </section>

      <section className="main-card">
        <p className="eyebrow">当前线索</p>
        <div className="clue-list">
          {buildClues(state).map((clue) => <p key={clue}>{clue}</p>)}
        </div>
      </section>
    </section>
  );
}

function DecisionModal({ state }: { state: GameState }) {
  const { dispatch } = useGame();
  const decision = getCurrentDecision(state, content);
  if (!decision) return null;
  return (
    <div className="modal-layer">
      <section className="decision-modal">
        <p className="eyebrow">{decision.sourceLabel} · {formatDate(state.date)}</p>
        <h2>{decision.title}</h2>
        <div className="story-text">
          {decision.body.map((line, index) => <p key={`${decision.id}-body-${index}`}>{line}</p>)}
        </div>
        <div className="choice-list">
          {decision.options.map((option) => (
            <DecisionButton
              key={option.id}
              option={option}
              onClick={() => dispatch({ type: "CHOOSE_DECISION_OPTION", decisionId: decision.id, optionId: option.id })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function DecisionButton({ option, onClick }: { option: DecisionOptionDefinition; onClick: () => void }) {
  return (
    <button className="choice" type="button" onClick={onClick}>
      <span>{option.label}</span>
      <small>{[option.costHint, option.impactHint, option.preview].filter(Boolean).join(" · ")}</small>
    </button>
  );
}

function ResultModal({ report }: { report: GameReport }) {
  const { dispatch } = useGame();
  return (
    <div className="modal-layer">
      <section className="decision-modal result-modal">
        <p className="eyebrow">{report.action ? `你选择了：${report.action}` : "结果"}</p>
        <h2>{report.title}</h2>
        <div className="story-text">
          {report.body.map((line, index) => <p key={`${report.title}-${index}`}>{line}</p>)}
        </div>
        <ReportDetails report={report} />
        <button className="primary-button" type="button" onClick={() => dispatch({ type: "ACKNOWLEDGE_RESULT" })}>
          <Check size={18} />
          继续
        </button>
      </section>
    </div>
  );
}

function ChapterSummary({ state }: { state: GameState }) {
  const { dispatch } = useGame();
  const result = state.chapterResult!;
  return (
    <div className="modal-layer">
      <section className="decision-modal summary-card">
        <p className="eyebrow">章节总结 · {formatDate(state.date)}</p>
        <h2>{result.title}</h2>
        <div className="story-text">
          {result.lines.map((line) => <p key={line}>{line}</p>)}
        </div>
        <div className="preview-box">
          <p className="eyebrow">神树倾向</p>
          <h3>{result.tendency}</h3>
          {result.evidence.length > 0 ? result.evidence.map((line) => <p key={line}>{line}</p>) : <p>你的选择仍然保持暧昧，部落还无法完全判断神树的性情。</p>}
        </div>
        <div className="inline-actions">
          <button className="secondary-button" type="button" onClick={() => dispatch({ type: "RETURN_TO_TITLE" })}>返回标题</button>
          <button className="primary-button" type="button" onClick={() => dispatch({ type: "START_NEW_GAME" })}>
            <ShieldAlert size={18} />
            重新开始
          </button>
        </div>
      </section>
    </div>
  );
}

function ReportDetails({ report }: { report: GameReport }) {
  const groups = [
    ["资源变化", report.resources],
    ["收入变化", report.rates],
    ["进度变化", report.progress],
    ["新解锁", report.unlocks],
    ["后续影响", report.delayed]
  ] as const;
  return (
    <div className="report-grid">
      {groups.filter(([, items]) => items.length > 0).map(([title, items]) => (
        <section key={title} className="mini-panel">
          <h3>{title}</h3>
          {items.map((item, index) => (
            <p key={`${item.label}-${index}`}>
              <CircleDot size={12} />
              <span>{item.label}{item.before || item.after ? `：${item.before ?? ""}${item.before && item.after ? " -> " : ""}${item.after ?? ""}` : ""}</span>
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="fact"><small>{label}</small><strong>{value}</strong></div>;
}

function buildClues(state: GameState): string[] {
  const clues = [];
  if (state.tree.power >= state.tree.powerCap - 2) clues.push("神力接近上限，继续积蓄可能浪费每日收入。");
  if (Object.values(state.regions).some((region) => region.knowledge === "trace")) clues.push("根须已经捕捉到方向线索，下一次神意可以继续追索。");
  if (state.characters.mang.knowledge !== "hidden" && state.characters.mang.trust < state.characters.mang.fear) clues.push("芒更敬畏神树而非亲近神树。");
  if (state.moduleAccess.tribe === "full" && state.tribe.food < 30) clues.push("溪原部粮食偏紧，长期神谕可能被现实压力改写。");
  if (Number(state.flags["threat-clues"] ?? 0) > 0) clues.push("北方威胁已经留下线索。");
  return clues.length > 0 ? clues.slice(0, 4) : ["世界还没有暴露新的紧迫线索。"];
}

function oracleLabel(value: string) {
  const map: Record<string, string> = {
    food: "优先储粮",
    heal: "先照料伤者",
    explore: "探索周边",
    patrol: "加强警戒",
    autonomy: "让部落自行决定"
  };
  return map[value] ?? value;
}

function signed(value: number) {
  return value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}
