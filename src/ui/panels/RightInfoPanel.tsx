import { BookOpen, Map, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { GameState } from "../../engine/types";

type TabId = "regions" | "characters" | "history";

export function RightInfoPanel({ state }: { state: GameState }) {
  const visibleTabs = useMemo(() => {
    const tabs: TabId[] = [];
    if (state.moduleAccess.map !== "locked") tabs.push("regions");
    if (state.moduleAccess.characters !== "locked") tabs.push("characters");
    if (state.history.length > 0) tabs.push("history");
    return tabs;
  }, [state.moduleAccess.map, state.moduleAccess.characters, state.history.length]);
  const [active, setActive] = useState<TabId>("regions");
  const current = visibleTabs.includes(active) ? active : visibleTabs[0];

  return (
    <aside className="side-panel right-panel">
      {visibleTabs.length === 0 ? (
        <section className="panel-block">
          <p className="eyebrow">信息</p>
          <p className="muted">未知的世界还没有向根须开放。</p>
        </section>
      ) : (
        <>
          <div className="tab-row">
            {visibleTabs.includes("regions") ? <button className={current === "regions" ? "tab active" : "tab"} type="button" onClick={() => setActive("regions")}><Map size={15} />地区</button> : null}
            {visibleTabs.includes("characters") ? <button className={current === "characters" ? "tab active" : "tab"} type="button" onClick={() => setActive("characters")}><UserRound size={15} />人物</button> : null}
            {visibleTabs.includes("history") ? <button className={current === "history" ? "tab active" : "tab"} type="button" onClick={() => setActive("history")}><BookOpen size={15} />历史</button> : null}
          </div>
          {current === "regions" ? <Regions state={state} /> : null}
          {current === "characters" ? <Characters state={state} /> : null}
          {current === "history" ? <History state={state} /> : null}
        </>
      )}
    </aside>
  );
}

function Regions({ state }: { state: GameState }) {
  const regions = Object.values(state.regions).filter((region) => region.knowledge !== "unknown");
  return (
    <section className="panel-block">
      <h2>已感知地区</h2>
      <div className="info-list">
        {regions.map((region) => (
          <article key={region.id} className={region.new ? "info-item new-item" : "info-item"}>
            <div className="info-head">
              <h3>{region.displayName}</h3>
              {region.new ? <span>新</span> : null}
            </div>
            <p>认知：{knowledgeText(region.knowledge)} · 连接：{connectionText(region.connection)}</p>
            <div className="progress-track slim"><span style={{ width: `${region.exploration}%` }} /></div>
            {region.knowledge === "known" || region.knowledge === "sensed" ? <p>{region.resource}；风险：{region.risk}</p> : <p className="muted">只知道方向与痕迹，尚不足以判断资源和风险。</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function Characters({ state }: { state: GameState }) {
  const characters = Object.values(state.characters).filter((character) => character.knowledge !== "hidden");
  return (
    <section className="panel-block">
      <h2>人物</h2>
      <div className="info-list">
        {characters.length === 0 ? <p className="muted">尚未有人真正进入神树认知。</p> : characters.map((character) => (
          <article key={character.id} className={character.new ? "info-item new-item" : "info-item"}>
            <div className="info-head">
              <h3>{character.knowledge === "mentioned" ? character.mentionName : character.name}</h3>
              {character.new ? <span>新</span> : null}
            </div>
            {character.knowledge === "mentioned" ? <p className="muted">只有传闻、脚步和别人的称呼。</p> : (
              <>
                <p>{character.role} · {character.location}</p>
                <dl className="compact-stats">
                  <div><dt>感应</dt><dd>{character.resonance}</dd></div>
                  <div><dt>信任</dt><dd>{character.trust}</dd></div>
                  <div><dt>恐惧</dt><dd>{character.fear}</dd></div>
                </dl>
                {character.memories.length > 0 ? <p className="muted">{character.memories[character.memories.length - 1]}</p> : null}
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function History({ state }: { state: GameState }) {
  return (
    <section className="panel-block">
      <h2>历史回声</h2>
      <div className="info-list">
        {[...state.history].reverse().slice(0, 10).map((entry) => (
          <article key={entry.id} className="info-item">
            <div className="info-head">
              <h3>{entry.title}</h3>
              <span>第{entry.day}日</span>
            </div>
            <p>{entry.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function knowledgeText(value: string) {
  const map: Record<string, string> = { trace: "痕迹", rumor: "传闻", sensed: "感知", known: "已知" };
  return map[value] ?? value;
}

function connectionText(value: string) {
  const map: Record<string, string> = { none: "无", weak: "微弱", stable: "稳定" };
  return map[value] ?? value;
}
