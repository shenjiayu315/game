import { Flame, Leaf, UsersRound } from "lucide-react";
import { totalAura, totalFaith, totalPowerIncome } from "../../engine/engine";
import type { GameState } from "../../engine/types";

export function LeftStatusPanel({ state }: { state: GameState }) {
  return (
    <aside className="side-panel left-panel">
      <section className="panel-block">
        <div className="panel-title">
          <Leaf size={18} />
          <h2>神树</h2>
        </div>
        <div className="meter-row"><span>神力</span><strong>{state.tree.power.toFixed(1)} / {state.tree.powerCap}</strong></div>
        <div className="meter"><span style={{ width: `${Math.min(100, (state.tree.power / state.tree.powerCap) * 100)}%` }} /></div>
        <dl className="stat-list">
          <div><dt>阶段</dt><dd>{state.tree.stage}</dd></div>
          <div><dt>感知</dt><dd>{state.tree.perception}</dd></div>
          <div><dt>每日收入</dt><dd>{totalPowerIncome(state).toFixed(1)}</dd></div>
          <div><dt>灵气</dt><dd>{totalAura(state).toFixed(1)}</dd></div>
          <div><dt>信仰</dt><dd>{totalFaith(state).toFixed(1)}</dd></div>
        </dl>
      </section>

      {state.moduleAccess.tribe !== "locked" ? (
        <section className="panel-block">
          <div className="panel-title">
            <UsersRound size={18} />
            <h2>部落</h2>
          </div>
          {state.moduleAccess.tribe === "hinted" || state.moduleAccess.tribe === "partial" ? (
            <p className="muted">树影外有人群正在靠近，但完整状态尚未明朗。</p>
          ) : (
            <>
              <dl className="stat-list">
                <div><dt>人口</dt><dd>{state.tribe.population}</dd></div>
                <div><dt>粮食</dt><dd>{state.tribe.food.toFixed(1)}</dd></div>
                <div><dt>伤病</dt><dd>{state.tribe.injuries}</dd></div>
                <div><dt>稳定</dt><dd>{state.tribe.stability.toFixed(1)}</dd></div>
                <div><dt>劳力</dt><dd>{state.tribe.labor}</dd></div>
              </dl>
              <RiskList state={state} />
              {state.tribe.plan ? (
                <div className="plan-box">
                  <p className="eyebrow">部落自主行动</p>
                  <h3>{state.tribe.plan.label}</h3>
                  <p>剩余{state.tribe.plan.remainingDays}日 · {state.tribe.plan.response}</p>
                  <ul>
                    {state.tribe.plan.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
              ) : <p className="muted">当前行动：{state.tribe.currentAction}</p>}
            </>
          )}
        </section>
      ) : null}

      {state.moduleAccess.faith !== "locked" ? (
        <section className="panel-block">
          <div className="panel-title">
            <Flame size={18} />
            <h2>信仰</h2>
          </div>
          <dl className="stat-list">
            <div><dt>信徒</dt><dd>{state.faith.believers}</dd></div>
            <div><dt>公开程度</dt><dd>{visibilityText(state.faith.visibility)}</dd></div>
            <div><dt>仪式</dt><dd>{state.faith.ritual}</dd></div>
            <div><dt>信仰</dt><dd>{state.faith.collectiveFaith.toFixed(1)}</dd></div>
            <div><dt>恐惧</dt><dd>{state.faith.collectiveFear.toFixed(1)}</dd></div>
          </dl>
        </section>
      ) : null}
    </aside>
  );
}

function RiskList({ state }: { state: GameState }) {
  const entries = [
    state.tribe.food < 18 ? "粮食低于安全线" : null,
    state.tribe.injuries > 2 ? "伤病正在拖慢劳力" : null,
    state.tribe.stability < 45 ? "部落稳定偏低" : null,
    state.faith.collectiveFear > state.faith.collectiveFaith + 10 ? "恐惧正在盖过信任" : null,
    Number(state.flags["threat-clues"] ?? 0) > 0 ? "北方威胁出现线索" : null,
    state.tribe.needs.length > 0 ? `当前需求：${state.tribe.needs.join("、")}` : null
  ].filter(Boolean).slice(0, 3) as string[];
  if (entries.length === 0) return <p className="muted">暂无突出风险。</p>;
  return (
    <div className="risk-list">
      {entries.map((entry) => <p key={entry}>{entry}</p>)}
    </div>
  );
}

function visibilityText(value: string) {
  const map: Record<string, string> = {
    none: "无",
    personal: "私人",
    "secret-group": "小群体",
    "restricted-public": "有限公开",
    public: "公开"
  };
  return map[value] ?? value;
}
