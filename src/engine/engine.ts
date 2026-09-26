import { loadContent } from "../content/loader";
import type {
  AccessLevel,
  BlockingReason,
  CharacterKnowledge,
  ConditionDefinition,
  DecisionOptionDefinition,
  DivineChoiceDefinition,
  EffectDefinition,
  EventDefinition,
  FeedbackItem,
  GameCommand,
  GameContent,
  GameDate,
  GameReport,
  GameState,
  ModuleId,
  OracleDefinition,
  RegionKnowledge,
  RootConnection
} from "./types";

const SCHEMA_VERSION = 2;
const DIVINE_INTERVAL = 6;
const ORACLE_INTERVAL = 10;
const SEASONS: GameDate["season"][] = ["春", "夏", "秋", "冬"];
const accessRank: Record<AccessLevel, number> = { locked: 0, hinted: 1, partial: 2, full: 3 };
const regionRank: Record<RegionKnowledge, number> = { unknown: 0, trace: 1, rumor: 2, sensed: 3, known: 4 };
const characterRank: Record<CharacterKnowledge, number> = { hidden: 0, mentioned: 1, known: 2, understood: 3 };
const connectionRank: Record<RootConnection, number> = { none: 0, weak: 1, stable: 2 };

export interface DecisionView {
  id: string;
  source: "world-event" | "divine-choice" | "oracle-review";
  sourceLabel: string;
  title: string;
  body: string[];
  options: DecisionOptionDefinition[];
}

export function createInitialGameState(seed = Date.now()): GameState {
  const content = loadContent();
  const firstPhase = content.phases.find((phase) => phase.id === "tree-awakening")!;
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: content.version,
    runId: `run-${seed}-${Math.floor(Math.random() * 100000)}`,
    seed,
    rngCursor: 0,
    date: { year: "初醒元年", season: "春", day: 1, absoluteDay: 1 },
    phaseId: "tree-awakening",
    runtimeMode: "decision",
    preferredSpeed: 1,
    blockingReasons: ["opening", "decision"],
    moduleAccess: {
      tree: firstPhase.moduleAccess.tree ?? "locked",
      map: firstPhase.moduleAccess.map ?? "locked",
      characters: firstPhase.moduleAccess.characters ?? "locked",
      tribe: firstPhase.moduleAccess.tribe ?? "locked",
      faith: firstPhase.moduleAccess.faith ?? "locked"
    },
    tree: {
      power: content.balance.initial.tree.power,
      powerCap: content.balance.initial.tree.powerCap,
      stage: content.balance.initial.tree.stage,
      perception: content.balance.initial.tree.perception,
      miracleTier: content.balance.initial.tree.miracleTier,
      auraSources: structuredClone(content.balance.initial.tree.auraSources),
      faithSources: []
    },
    regions: Object.fromEntries(content.regions.map((region) => [region.id, {
      id: region.id,
      name: region.name,
      traceName: region.traceName,
      displayName: region.initialKnowledge === "unknown" ? region.traceName : region.name,
      knowledge: region.initialKnowledge,
      connection: region.initialConnection,
      exploration: region.exploration,
      aura: region.aura,
      risk: region.risk,
      resource: region.resource,
      controller: region.controller,
      notes: region.notes ?? [],
      new: region.initialKnowledge !== "unknown"
    }])),
    characters: Object.fromEntries(content.characters.map((character) => [character.id, {
      ...character,
      memories: [],
      new: false
    }])),
    tribe: {
      ...structuredClone(content.balance.initial.tribe),
      plan: null,
      completedPlans: 0,
      foodFloorActive: false
    },
    faith: structuredClone(content.balance.initial.faith),
    currentDivineFocus: null,
    nextDivineChoiceDay: 4,
    currentOracleId: null,
    nextOracleReviewDay: null,
    pendingEvents: [],
    currentDecision: { id: "awakening", source: "world-event" },
    pendingResult: null,
    scheduledEffects: [],
    flags: {
      guardian: 0,
      dread: 0,
      silent: 0,
      "threat-clues": 0,
      "handled-events": "",
      "last-decision-day": 1
    },
    history: [],
    activityLog: [{ id: "a-1", day: 1, text: "神树在古树林地中苏醒。" }],
    chapterResult: null,
    recentMessage: "神树刚刚醒来。",
    lastDailyDelta: { power: 0, food: 0 },
    saveMessage: null
  };
}

export function reduceGame(state: GameState, command: GameCommand): GameState {
  const content = loadContent();
  switch (command.type) {
    case "START_NEW_GAME":
      return createInitialGameState(command.seed);
    case "LOAD_GAME":
      return command.state ? normalizeLoadedState(command.state) : state;
    case "SET_SPEED":
      return setSpeed(state, command.speed ?? 0);
    case "SET_BACKGROUND_PAUSE":
      return command.paused ? { ...state, preferredSpeed: 0, blockingReasons: addReason(state.blockingReasons, "background") } : { ...state, blockingReasons: removeReason(state.blockingReasons, "background") };
    case "ACKNOWLEDGE_RESULT":
      return acknowledge(state);
    case "CHOOSE_DECISION_OPTION":
      return chooseDecisionOption(state, content, command.decisionId!, command.optionId!);
    case "ADVANCE_DAY":
      return advanceDay(state, content);
    case "SAVE_GAME":
      return { ...state, saveMessage: `已保存：${formatDate(state.date)} · ${new Date().toLocaleTimeString()}` };
    case "RETURN_TO_TITLE":
      return state;
    default:
      return state;
  }
}

export function formatDate(date: GameDate): string {
  return `${date.year} · ${date.season} · 第${date.day}日`;
}

export function totalAura(state: GameState): number {
  return round1(state.tree.auraSources.reduce((sum, source) => sum + source.amount, 0));
}

export function totalFaith(state: GameState): number {
  return round1(state.tree.faithSources.reduce((sum, source) => sum + source.amount, 0));
}

export function totalPowerIncome(state: GameState): number {
  return round1(totalAura(state) + totalFaith(state));
}

export function isPaused(state: GameState): boolean {
  return state.preferredSpeed === 0 || state.blockingReasons.length > 0 || state.runtimeMode !== "observing";
}

export function getCurrentDecision(state: GameState, content = loadContent()): DecisionView | null {
  if (!state.currentDecision) return null;
  if (state.currentDecision.source === "world-event") {
    const event = content.events.find((item) => item.id === state.currentDecision?.id);
    if (!event) return null;
    return { id: event.id, source: "world-event", sourceLabel: event.kind === "urgent" ? "紧急事件" : "世界事件", title: event.title, body: event.body, options: event.options };
  }
  if (state.currentDecision.source === "divine-choice") {
    const decision = content.divineChoices.find((item) => item.id === state.currentDecision?.id);
    if (!decision) return null;
    return { id: decision.id, source: "divine-choice", sourceLabel: "神意抉择", title: decision.title, body: decision.body, options: decision.options };
  }
  return {
    id: "oracle-review",
    source: "oracle-review",
    sourceLabel: "长期神谕",
    title: "部落请求重新确认神谕",
    body: ["溪原部已经按照上一道方向生活了一段时间。现在他们需要知道，神树是否维持原意，还是改换长期方向。"],
    options: buildOracleOptions(state, content.oracles)
  };
}

export function getPhaseTitle(id: string, content = loadContent()): string {
  return content.phases.find((phase) => phase.id === id)?.title ?? id;
}

export function getPhaseSummary(id: string, content = loadContent()): string {
  return content.phases.find((phase) => phase.id === id)?.summary ?? "";
}

function normalizeLoadedState(state: GameState): GameState {
  const runtimeBlock = state.runtimeMode === "decision" ? "decision" : state.runtimeMode === "result" ? "result" : null;
  return {
    ...state,
    preferredSpeed: 0,
    blockingReasons: runtimeBlock ? [runtimeBlock] : [],
    saveMessage: null
  };
}

function acknowledge(state: GameState): GameState {
  let next: GameState = {
    ...state,
    pendingResult: null,
    saveMessage: null,
    blockingReasons: removeReason(removeReason(removeReason(state.blockingReasons, "result"), "opening"), "decision")
  };
  if (next.chapterResult) {
    return { ...next, runtimeMode: "summary", preferredSpeed: 0, blockingReasons: ["result"] };
  }
  return { ...next, runtimeMode: "observing" };
}

function setSpeed(state: GameState, speed: 0 | 1 | 3): GameState {
  if (speed === 0) return { ...state, preferredSpeed: 0, saveMessage: null };
  return { ...state, preferredSpeed: speed, blockingReasons: removeReason(removeReason(state.blockingReasons, "background"), "loading"), saveMessage: null };
}

function chooseDecisionOption(state: GameState, content: GameContent, decisionId: string, optionId: string): GameState {
  const decision = getCurrentDecision(state, content);
  if (!decision || decision.id !== decisionId) return state;
  const option = decision.options.find((item) => item.id === optionId);
  if (!option || (option.requirements && !checkCondition(state, option.requirements))) return state;

  let next = state;
  const immediate = applyEffects(next, option.effects, option.label);
  next = immediate.state;

  if (decision.source === "world-event") {
    next.flags["handled-events"] = appendCsv(String(next.flags["handled-events"] ?? ""), decision.id);
    next.pendingEvents = next.pendingEvents.filter((item) => item.eventId !== decision.id);
  }

  if (decision.source === "divine-choice") {
    next.currentDivineFocus = {
      id: option.id,
      label: option.label,
      sourceDecisionId: decision.id,
      startedOn: state.date.absoluteDay,
      endsOn: state.date.absoluteDay + DIVINE_INTERVAL,
      effects: structuredClone(option.ongoingEffects ?? []),
      summary: option.preview
    };
    next.nextDivineChoiceDay = state.date.absoluteDay + DIVINE_INTERVAL;
  }

  if (decision.source === "oracle-review") {
    next.currentOracleId = option.id;
    next.nextOracleReviewDay = state.date.absoluteDay + ORACLE_INTERVAL;
  }

  const report = makeReport({
    title: decision.title,
    body: option.resultText,
    action: option.label,
    world: decision.body.join(""),
    resources: immediate.resources,
    rates: immediate.rates,
    progress: immediate.progress,
    unlocks: immediate.unlocks,
    delayed: [
      ...immediate.delayed,
      ...(decision.source === "divine-choice" ? [{ label: "当前神意", after: `${option.label}，持续至第${state.date.absoluteDay + DIVINE_INTERVAL}日` }] : []),
      ...(decision.source === "oracle-review" ? [{ label: "长期神谕", after: option.label }] : [])
    ]
  });

  next = {
    ...next,
    currentDecision: null,
    pendingResult: report,
    runtimeMode: "result",
    blockingReasons: addReason(removeReason(removeReason(next.blockingReasons, "decision"), "opening"), "result"),
    history: appendHistory(next, decision.title, option.resultText[0] ?? option.label),
    activityLog: appendActivity(next, `选择：${option.label}`, "positive"),
    flags: { ...next.flags, "last-decision-day": state.date.absoluteDay }
  };

  return next;
}

function advanceDay(state: GameState, content: GameContent): GameState {
  if (isPaused(state)) return state;
  let next: GameState = { ...state, date: nextDate(state.date), saveMessage: null };
  next = expireSources(next);
  const beforePower = next.tree.power;
  const beforeFood = next.tribe.food;
  next = runDailyEconomy(next);
  next = runDivineFocus(next);
  next = updateRegionKnowledge(next);
  next = applyScheduled(next);
  next = applyAutomaticPhase(next, content);
  next = runTribePlan(next);
  next.lastDailyDelta = { power: round1(next.tree.power - beforePower), food: round1(next.tribe.food - beforeFood) };
  next.activityLog = appendActivity(next, `神力 ${formatDelta(next.lastDailyDelta.power)}，粮食 ${formatDelta(next.lastDailyDelta.food)}。`, next.lastDailyDelta.food < 0 ? "warning" : "neutral");
  next = scheduleDecision(next, content);
  return next;
}

function runDailyEconomy(state: GameState): GameState {
  const next = structuredClone(state);
  const income = totalPowerIncome(next);
  next.tree.power = clamp(round1(next.tree.power + income), 0, next.tree.powerCap);
  const foodDelta = next.tribe.baseProduction + next.tribe.productionBonus - next.tribe.baseConsumption - next.faith.offeringCost;
  next.tribe.food = round1(next.tribe.food + foodDelta);
  if (next.moduleAccess.tribe !== "full" && next.tribe.food < 24) {
    next.tribe.food = 24;
    next.tribe.foodFloorActive = true;
  } else if (next.tribe.food <= 0) {
    next.tribe.food = 0;
    next.tribe.stability = clamp(next.tribe.stability - 1, 0, 100);
  } else if (next.tribe.food < 20 && next.date.absoluteDay % 5 === 0) {
    next.tribe.stability = clamp(next.tribe.stability - 2, 0, 100);
  }
  next.recentMessage = `今日神力 ${formatDelta(income)}，粮食 ${formatDelta(foodDelta)}。`;
  return next;
}

function runDivineFocus(state: GameState): GameState {
  if (!state.currentDivineFocus) return state;
  if (state.date.absoluteDay > state.currentDivineFocus.endsOn) {
    return { ...state, currentDivineFocus: null, activityLog: appendActivity(state, "上一段神意自然结束。") };
  }
  const result = applyEffects(state, state.currentDivineFocus.effects, state.currentDivineFocus.label);
  return { ...result.state, recentMessage: `${state.currentDivineFocus.label}仍在影响世界。` };
}

function applyAutomaticPhase(state: GameState, content: GameContent): GameState {
  let next = state;
  const day = next.date.absoluteDay;
  const target =
    day >= 85 ? "war-clouds" :
    day >= 66 ? "tribe-management" :
    day >= 61 ? "tribe-arrival" :
    day >= 55 ? "distant-tribe" :
    day >= 34 ? "private-offering" :
    day >= 24 ? "mang-arrival" :
    day >= 10 ? "roots-in-woods" :
    "tree-awakening";
  if (target !== next.phaseId) next = { ...next, phaseId: target, activityLog: appendActivity(next, `阶段推进：${getPhaseTitle(target, content)}。`, "positive") };
  const phase = content.phases.find((item) => item.id === next.phaseId);
  if (!phase) return next;
  const access = { ...next.moduleAccess };
  for (const [module, level] of Object.entries(phase.moduleAccess) as Array<[ModuleId, AccessLevel]>) {
    if (accessRank[level] > accessRank[access[module]]) access[module] = level;
  }
  return { ...next, moduleAccess: access };
}

function scheduleDecision(state: GameState, content: GameContent): GameState {
  if (state.currentDecision || state.pendingResult || state.chapterResult) return state;
  const lastDay = Number(state.flags["last-decision-day"] ?? 0);
  const canShowOrdinary = state.date.absoluteDay - lastDay >= 1;
  const candidates = content.events
    .filter((event) => event.phaseIds.includes(state.phaseId))
    .filter((event) => !event.once || !csvSet(String(state.flags["handled-events"] ?? "")).has(event.id))
    .filter((event) => !event.trigger || checkCondition(state, event.trigger))
    .sort((a, b) => b.priority - a.priority);
  const fixed = candidates.find((event) => event.kind === "urgent" || canShowOrdinary);
  if (fixed) return openDecision(state, { id: fixed.id, source: "world-event" });

  if (canShowOrdinary && state.currentOracleId && state.nextOracleReviewDay && state.date.absoluteDay >= state.nextOracleReviewDay && ["tribe-management", "war-clouds"].includes(state.phaseId)) {
    return openDecision(state, { id: "oracle-review", source: "oracle-review" });
  }

  if (canShowOrdinary && state.nextDivineChoiceDay && state.date.absoluteDay >= state.nextDivineChoiceDay && !["tribe-management", "war-clouds"].includes(state.phaseId)) {
    const decision = pickDivineChoice(state, content.divineChoices);
    if (decision) return openDecision(state, { id: decision.id, source: "divine-choice" });
  }
  return state;
}

function openDecision(state: GameState, decision: GameState["currentDecision"]): GameState {
  return {
    ...state,
    currentDecision: decision,
    runtimeMode: "decision",
    blockingReasons: addReason(state.blockingReasons, "decision"),
    flags: { ...state.flags, "last-decision-day": state.date.absoluteDay }
  };
}

function pickDivineChoice(state: GameState, choices: DivineChoiceDefinition[]): DivineChoiceDefinition | null {
  return choices
    .filter((choice) => choice.phaseIds.includes(state.phaseId))
    .filter((choice) => !choice.trigger || checkCondition(state, choice.trigger))
    .sort((a, b) => b.priority - a.priority)[0] ?? choices[0] ?? null;
}

function buildOracleOptions(state: GameState, oracles: OracleDefinition[]): DecisionOptionDefinition[] {
  return oracles
    .filter((oracle) => !oracle.requirements || checkCondition(state, oracle.requirements))
    .map((oracle) => ({
      id: oracle.id,
      label: oracle.id === state.currentOracleId ? `维持：${oracle.label}` : oracle.label,
      preview: oracle.description,
      relatedModules: ["tribe"],
      effects: oracle.effects ?? [{ setOracle: oracle.id }],
      resultText: oracle.id === state.currentOracleId
        ? [`神树没有改变长期方向。${oracle.label}继续影响溪原部的自主行动。`]
        : [`新的长期神谕落向溪原部：${oracle.label}。他们会理解、变通，或在现实压力下部分执行。`]
    }));
}

function runTribePlan(state: GameState): GameState {
  if (state.moduleAccess.tribe !== "full") return state;
  let next = structuredClone(state);
  if (!next.tribe.plan) {
    next.tribe.plan = chooseTribePlan(next);
    next.tribe.currentAction = next.tribe.plan.label;
    next.activityLog = appendActivity(next, `部落选择：${next.tribe.plan.label}。原因：${next.tribe.plan.reasons.slice(0, 2).join("；")}`);
    return next;
  }
  next.tribe.plan.remainingDays -= 1;
  if (next.tribe.plan.remainingDays > 0) return next;
  const plan = next.tribe.plan;
  next = applyTribePlanResult(next, plan.id);
  next.tribe.completedPlans += 1;
  next.tribe.plan = null;
  next.activityLog = appendActivity(next, `部落完成：${plan.label}。${plan.reasons[0] ?? ""}`, "positive");
  return next;
}

function chooseTribePlan(state: GameState) {
  const candidates = [
    scorePlan(state, "stream", "沿清溪采集"),
    scorePlan(state, "hunt", "前往南坡狩猎"),
    scorePlan(state, "heal", "留营照料伤者"),
    scorePlan(state, "worship", "维持限制祭祀"),
    scorePlan(state, "patrol", "巡查北方林缘")
  ].filter((item) => item.score > -999).sort((a, b) => b.score - a.score);
  const chosen = candidates[0] ?? { id: "heal", label: "留营照料伤者", score: 0, reasons: ["没有更可靠的外出条件", "伤病仍然占用劳力"] };
  const response = state.currentOracleId && chosen.reasons.some((reason) => reason.includes("神谕")) ? "执行" : chosen.score < 7 ? "调整" : "执行";
  const totalDays = chosen.id === "worship" ? 3 : chosen.id === "patrol" ? 4 : 5;
  return { id: chosen.id, label: chosen.label, remainingDays: totalDays, totalDays, reasons: chosen.reasons.slice(0, 3), response } as const;
}

function scorePlan(state: GameState, id: string, label: string) {
  let score = 0;
  const reasons: string[] = [];
  const oracle = state.currentOracleId;
  if (id === "stream") {
    if (regionRank[state.regions["clear-stream"].knowledge] < regionRank.sensed) return { id, label, score: -999, reasons: [] };
    score = 8;
    reasons.push("清溪方向已经可用");
    if (state.tribe.food < 36) { score += 10; reasons.push("粮食紧张"); }
    if (oracle === "food") { score += 8; reasons.push("神谕要求储粮"); }
  }
  if (id === "hunt") {
    if (regionRank[state.regions["south-slope"].knowledge] < regionRank.trace) return { id, label, score: -999, reasons: [] };
    score = 7 + Math.max(0, 4 - state.tribe.injuries * 2);
    reasons.push("南坡有兽道线索");
    if (state.tribe.food < 36) { score += 8; reasons.push("粮食紧张"); }
    if (oracle === "food") { score += 4; reasons.push("神谕要求储粮"); }
  }
  if (id === "heal") {
    score = 5 + state.tribe.injuries * 6;
    reasons.push(`伤病${state.tribe.injuries}人`);
    if (oracle === "heal") { score += 10; reasons.push("神谕指向伤者"); }
    if (state.tribe.food < 20) { score -= 3; reasons.push("粮食短缺压低照料规模"); }
  }
  if (id === "worship") {
    score = 3 + Math.floor(state.faith.collectiveFaith / 10);
    reasons.push("祭祀能巩固解释权");
    if (state.tribe.food < 24) { score -= 8; reasons.push("粮食压力让祭祀受限"); }
  }
  if (id === "patrol") {
    score = 2 + Number(state.flags["threat-clues"] ?? 0) * 6;
    reasons.push("北方线索需要确认");
    if (oracle === "patrol") { score += 10; reasons.push("神谕要求警戒"); }
    if (state.tribe.injuries >= 3) { score -= 4; reasons.push("伤病削弱外出能力"); }
  }
  if (oracle === "explore" && ["stream", "hunt", "patrol"].includes(id)) { score += 5; reasons.push("神谕要求探索周边"); }
  return { id, label, score, reasons };
}

function applyTribePlanResult(state: GameState, id: string): GameState {
  if (id === "stream") return applyEffects(state, [{ changeFood: 7 }, { changeRegionExploration: { region: "clear-stream", amount: 8 } }], "部落采集").state;
  if (id === "hunt") return applyEffects(state, [{ changeFood: 8 }, { changeInjuries: random01(state) > 0.75 ? 1 : 0 }, { changeRegionExploration: { region: "south-slope", amount: 8 } }], "部落狩猎").state;
  if (id === "heal") return applyEffects(state, [{ changeInjuries: -1 }, { changeStability: 2 }], "照料伤者").state;
  if (id === "worship") return applyEffects(state, [{ changeCollectiveFaith: 3 }, { changeFood: -2 }], "限制祭祀").state;
  if (id === "patrol") return applyEffects(state, [{ changeFlag: { flag: "threat-clues", amount: 1 } }, { changeFood: -1 }], "林缘巡查").state;
  return state;
}

function checkCondition(state: GameState, condition: ConditionDefinition): boolean {
  if ("all" in condition) return condition.all.every((item) => checkCondition(state, item));
  if ("any" in condition) return condition.any.some((item) => checkCondition(state, item));
  if ("not" in condition) return !checkCondition(state, condition.not);
  if ("phase" in condition) return state.phaseId === condition.phase;
  if ("dateAtLeast" in condition) return state.date.absoluteDay >= condition.dateAtLeast;
  if ("dateAtMost" in condition) return state.date.absoluteDay <= condition.dateAtMost;
  if ("flag" in condition) return Boolean(state.flags[condition.flag]);
  if ("notFlag" in condition) return !state.flags[condition.notFlag];
  if ("eventHandled" in condition) return csvSet(String(state.flags["handled-events"] ?? "")).has(condition.eventHandled);
  if ("divineFocus" in condition) return state.currentDivineFocus?.id === condition.divineFocus;
  if ("oracle" in condition) return state.currentOracleId === condition.oracle;
  if ("moduleAccessAtLeast" in condition) return accessRank[state.moduleAccess[condition.moduleAccessAtLeast.module]] >= accessRank[condition.moduleAccessAtLeast.level];
  if ("resourceAtLeast" in condition) return condition.resourceAtLeast.resource === "power" ? state.tree.power >= condition.resourceAtLeast.value : state.tribe.food >= condition.resourceAtLeast.value;
  if ("relationAtLeast" in condition) return (state.characters[condition.relationAtLeast.character]?.[condition.relationAtLeast.stat] ?? 0) >= condition.relationAtLeast.value;
  if ("regionKnowledgeAtLeast" in condition) return regionRank[state.regions[condition.regionKnowledgeAtLeast.region]?.knowledge ?? "unknown"] >= regionRank[condition.regionKnowledgeAtLeast.level];
  if ("regionExplorationAtLeast" in condition) return (state.regions[condition.regionExplorationAtLeast.region]?.exploration ?? 0) >= condition.regionExplorationAtLeast.value;
  if ("tribePlansAtLeast" in condition) return state.tribe.completedPlans >= condition.tribePlansAtLeast;
  if ("threatAtLeast" in condition) return Number(state.flags["threat-clues"] ?? 0) >= condition.threatAtLeast;
  return false;
}

function applyEffects(state: GameState, effects: EffectDefinition[], source: string) {
  let next = structuredClone(state);
  const resources: FeedbackItem[] = [];
  const rates: FeedbackItem[] = [];
  const progress: FeedbackItem[] = [];
  const unlocks: FeedbackItem[] = [];
  const delayed: FeedbackItem[] = [];
  for (const effect of effects) {
    if ("changePower" in effect) {
      const before = next.tree.power;
      next.tree.power = clamp(round1(next.tree.power + effect.changePower), 0, next.tree.powerCap);
      resources.push({ label: "神力", before: fmt(before), after: fmt(next.tree.power), tone: effect.changePower >= 0 ? "positive" : "warning" });
    } else if ("changePowerCap" in effect) {
      const before = next.tree.powerCap;
      next.tree.powerCap = Math.max(1, next.tree.powerCap + effect.changePowerCap);
      resources.push({ label: "神力上限", before: fmt(before), after: fmt(next.tree.powerCap), tone: "positive" });
    } else if ("changePerception" in effect) {
      const before = next.tree.perception;
      next.tree.perception += effect.changePerception;
      progress.push({ label: "感知等级", before: String(before), after: String(next.tree.perception) });
    } else if ("setTreeStage" in effect) {
      const before = next.tree.stage;
      next.tree.stage = effect.setTreeStage;
      unlocks.push({ label: "神树阶段", before, after: next.tree.stage });
    } else if ("addAuraSource" in effect) {
      next.tree.auraSources = replaceSource(next.tree.auraSources, effect.addAuraSource, next.date.absoluteDay);
      rates.push({ label: effect.addAuraSource.label, after: `+${effect.addAuraSource.amount}/日` });
    } else if ("removeAuraSource" in effect) {
      next.tree.auraSources = next.tree.auraSources.filter((item) => item.id !== effect.removeAuraSource);
    } else if ("addFaithSource" in effect) {
      next.tree.faithSources = replaceSource(next.tree.faithSources, effect.addFaithSource, next.date.absoluteDay);
      rates.push({ label: effect.addFaithSource.label, after: `+${effect.addFaithSource.amount}/日`, tone: "positive" });
    } else if ("removeFaithSource" in effect) {
      next.tree.faithSources = next.tree.faithSources.filter((item) => item.id !== effect.removeFaithSource);
    } else if ("changeRegionExploration" in effect) {
      const region = next.regions[effect.changeRegionExploration.region];
      if (!region) continue;
      const before = region.exploration;
      region.exploration = clamp(region.exploration + effect.changeRegionExploration.amount, 0, 100);
      progress.push({ label: `${region.displayName}探索`, before: `${before}%`, after: `${region.exploration}%` });
    } else if ("setRegionKnowledge" in effect) {
      const region = next.regions[effect.setRegionKnowledge.region];
      if (!region) continue;
      const before = region.knowledge;
      region.knowledge = rankUpgrade(region.knowledge, effect.setRegionKnowledge.knowledge);
      region.displayName = region.knowledge === "trace" ? region.traceName : region.name;
      if (regionRank[region.knowledge] > regionRank[before]) {
        region.new = true;
        unlocks.push({ label: `地区：${region.displayName}`, before, after: region.knowledge });
      }
    } else if ("setRegionConnection" in effect) {
      const region = next.regions[effect.setRegionConnection.region];
      if (!region) continue;
      const before = region.connection;
      region.connection = connectionRank[region.connection] > connectionRank[effect.setRegionConnection.connection] ? region.connection : effect.setRegionConnection.connection;
      progress.push({ label: `${region.displayName}连接`, before, after: region.connection });
      if (region.connection === "stable" && region.aura > 0) {
        next.tree.auraSources = replaceSource(next.tree.auraSources, { id: region.id, label: `${region.name}灵气`, amount: region.aura, module: "map" }, next.date.absoluteDay);
        rates.push({ label: `${region.name}灵气`, after: `+${region.aura}/日` });
      }
    } else if ("changeCharacter" in effect) {
      const character = next.characters[effect.changeCharacter.character];
      if (!character) continue;
      const before = character[effect.changeCharacter.stat];
      character[effect.changeCharacter.stat] = clamp(before + effect.changeCharacter.amount, 0, 100);
      resources.push({ label: `${character.knowledge === "hidden" ? character.mentionName : character.name}${relationLabel(effect.changeCharacter.stat)}`, before: fmt(before), after: fmt(character[effect.changeCharacter.stat]) });
    } else if ("setCharacterKnowledge" in effect) {
      const character = next.characters[effect.setCharacterKnowledge.character];
      if (!character) continue;
      const before = character.knowledge;
      if (characterRank[effect.setCharacterKnowledge.knowledge] > characterRank[before]) {
        character.knowledge = effect.setCharacterKnowledge.knowledge;
        character.new = true;
        unlocks.push({ label: `人物：${character.knowledge === "mentioned" ? character.mentionName : character.name}`, before, after: character.knowledge });
      }
    } else if ("addMemory" in effect) {
      const character = next.characters[effect.addMemory.character];
      if (character) character.memories = [...character.memories, effect.addMemory.text].slice(-5);
    } else if ("changeFood" in effect) {
      const before = next.tribe.food;
      next.tribe.food = Math.max(0, round1(next.tribe.food + effect.changeFood));
      resources.push({ label: "粮食", before: fmt(before), after: fmt(next.tribe.food), tone: effect.changeFood >= 0 ? "positive" : "warning" });
    } else if ("changeFoodProduction" in effect) {
      const before = next.tribe.productionBonus;
      next.tribe.productionBonus = round1(next.tribe.productionBonus + effect.changeFoodProduction);
      rates.push({ label: "粮食生产修正", before: fmt(before), after: fmt(next.tribe.productionBonus) });
    } else if ("changeInjuries" in effect) {
      const before = next.tribe.injuries;
      next.tribe.injuries = Math.max(0, next.tribe.injuries + effect.changeInjuries);
      resources.push({ label: "伤病", before: String(before), after: String(next.tribe.injuries), tone: effect.changeInjuries <= 0 ? "positive" : "warning" });
    } else if ("changeStability" in effect) {
      const before = next.tribe.stability;
      next.tribe.stability = clamp(next.tribe.stability + effect.changeStability, 0, 100);
      resources.push({ label: "稳定", before: fmt(before), after: fmt(next.tribe.stability) });
    } else if ("setTribeNeed" in effect) {
      next.tribe.needs = effect.setTribeNeed;
    } else if ("setTribeAction" in effect) {
      next.tribe.currentAction = effect.setTribeAction;
    } else if ("changeBelievers" in effect) {
      const before = next.faith.believers;
      next.faith.believers = Math.max(0, next.faith.believers + effect.changeBelievers);
      resources.push({ label: "信徒", before: String(before), after: String(next.faith.believers) });
    } else if ("setWorshipVisibility" in effect) {
      const before = next.faith.visibility;
      next.faith.visibility = effect.setWorshipVisibility;
      unlocks.push({ label: "祭祀公开程度", before, after: next.faith.visibility });
    } else if ("changeWorshipIntensity" in effect) {
      next.faith.intensity = clamp(next.faith.intensity + effect.changeWorshipIntensity, 0, 3);
    } else if ("changeOfferingCost" in effect) {
      next.faith.offeringCost = Math.max(0, round1(next.faith.offeringCost + effect.changeOfferingCost));
    } else if ("changeCollectiveFaith" in effect) {
      next.faith.collectiveFaith = clamp(next.faith.collectiveFaith + effect.changeCollectiveFaith, 0, 100);
    } else if ("changeCollectiveFear" in effect) {
      next.faith.collectiveFear = clamp(next.faith.collectiveFear + effect.changeCollectiveFear, 0, 100);
    } else if ("setInterpreter" in effect) {
      next.faith.interpreter = effect.setInterpreter;
      unlocks.push({ label: "解释者", after: effect.setInterpreter === "mang" ? "芒" : effect.setInterpreter === "cen" ? "岑" : effect.setInterpreter });
    } else if ("setRitual" in effect) {
      next.faith.ritual = effect.setRitual;
      unlocks.push({ label: "公共祭祀", after: effect.setRitual });
    } else if ("setFlag" in effect) {
      next.flags[effect.setFlag.flag] = effect.setFlag.value;
      delayed.push({ label: "标记", detail: `${effect.setFlag.flag}=${effect.setFlag.value}` });
    } else if ("changeFlag" in effect) {
      next.flags[effect.changeFlag.flag] = Number(next.flags[effect.changeFlag.flag] ?? 0) + effect.changeFlag.amount;
    } else if ("openModule" in effect) {
      const before = next.moduleAccess[effect.openModule.module];
      if (accessRank[effect.openModule.access] > accessRank[before]) {
        next.moduleAccess[effect.openModule.module] = effect.openModule.access;
        unlocks.push({ label: `模块：${moduleLabel(effect.openModule.module)}`, before, after: effect.openModule.access });
      }
    } else if ("setPhase" in effect) {
      next.phaseId = effect.setPhase;
    } else if ("queueEvent" in effect) {
      next.pendingEvents.push({ eventId: effect.queueEvent, queuedOn: next.date.absoluteDay });
    } else if ("addHistory" in effect) {
      next.history = appendHistory(next, effect.addHistory.title, effect.addHistory.text);
    } else if ("addActivity" in effect) {
      next.activityLog = appendActivity(next, effect.addActivity.text, effect.addActivity.tone);
    } else if ("addTendency" in effect) {
      next.flags[effect.addTendency] = Number(next.flags[effect.addTendency] ?? 0) + 1;
    } else if ("setWarDirection" in effect) {
      next.flags["war-direction"] = effect.setWarDirection;
      delayed.push({ label: "战前方向", after: warDirectionLabel(effect.setWarDirection) });
    } else if ("setOracle" in effect) {
      next.currentOracleId = effect.setOracle;
      next.nextOracleReviewDay = next.date.absoluteDay + ORACLE_INTERVAL;
      delayed.push({ label: "长期神谕", after: oracleLabel(effect.setOracle) });
    } else if ("chapterSummary" in effect) {
      next.chapterResult = buildChapterResult(next);
    }
  }
  return { state: next, resources, rates, progress, unlocks, delayed };
}

function updateRegionKnowledge(state: GameState): GameState {
  const next = structuredClone(state);
  for (const region of Object.values(next.regions)) {
    const before = region.knowledge;
    if (region.id === "ancient-woods") continue;
    if (region.exploration >= 100) {
      region.knowledge = "known";
      region.displayName = region.name;
      if (region.connection === "none" && region.id !== "northern-edge") region.connection = "weak";
    } else if (region.exploration >= 60) {
      region.knowledge = rankUpgrade(region.knowledge, "sensed");
      region.displayName = region.name;
    } else if (region.exploration >= 20) {
      region.knowledge = rankUpgrade(region.knowledge, "trace");
      region.displayName = region.traceName;
    }
    if (regionRank[region.knowledge] > regionRank[before]) {
      region.new = true;
      next.activityLog = appendActivity(next, `${region.displayName}的认知提高。`, "positive");
    }
  }
  return next;
}

function applyScheduled(state: GameState): GameState {
  let next = state;
  const due = next.scheduledEffects.filter((item) => item.dueDay <= next.date.absoluteDay);
  for (const item of due) next = applyEffects(next, item.effects, item.source).state;
  return { ...next, scheduledEffects: next.scheduledEffects.filter((item) => item.dueDay > next.date.absoluteDay) };
}

function expireSources(state: GameState): GameState {
  return {
    ...state,
    tree: {
      ...state.tree,
      auraSources: state.tree.auraSources.filter((source) => !source.expiresOn || source.expiresOn > state.date.absoluteDay),
      faithSources: state.tree.faithSources.filter((source) => !source.expiresOn || source.expiresOn > state.date.absoluteDay)
    }
  };
}

function makeReport(input: Partial<GameReport> & { title: string; body: string[] }): GameReport {
  return {
    title: input.title,
    body: input.body,
    action: input.action,
    world: input.world,
    interpretation: input.interpretation,
    resources: input.resources ?? [],
    rates: input.rates ?? [],
    progress: input.progress ?? [],
    unlocks: input.unlocks ?? [],
    delayed: input.delayed ?? []
  };
}

function buildChapterResult(state: GameState) {
  const tendency = tendencyLabel(state);
  return {
    title: "从初醒到临战",
    tendency,
    evidence: tendencyEvidence(state),
    lines: [
      `最终日期：${formatDate(state.date)}。`,
      `神力：${fmt(state.tree.power)}/${fmt(state.tree.powerCap)}，每日收入 ${fmt(totalPowerIncome(state))}。`,
      `地区：${Object.values(state.regions).filter((r) => r.knowledge !== "unknown").map((r) => `${r.displayName}(${r.knowledge}/${r.connection})`).join("；")}。`,
      `芒：${attitudeText(state.characters.mang)}；岑：${attitudeText(state.characters.cen)}。`,
      `溪原部：人口${state.tribe.population}，粮食${fmt(state.tribe.food)}，伤病${state.tribe.injuries}，稳定${fmt(state.tribe.stability)}。`,
      `信仰：信徒${state.faith.believers}，仪式“${state.faith.ritual}”，集体恐惧${fmt(state.faith.collectiveFear)}。`,
      `长期神谕：${oracleLabel(String(state.currentOracleId ?? "autonomy"))}。`,
      `战前方向：${warDirectionLabel(String(state.flags["war-direction"] ?? "autonomous"))}。`
    ]
  };
}

function nextDate(date: GameDate): GameDate {
  const absoluteDay = date.absoluteDay + 1;
  const seasonIndex = Math.floor((absoluteDay - 1) / 30) % 4;
  const day = ((absoluteDay - 1) % 30) + 1;
  return { ...date, absoluteDay, season: SEASONS[seasonIndex], day };
}

function replaceSource<T extends { id: string; expiresOn?: number }>(sources: T[], source: T, currentDay: number): T[] {
  const normalized = source.expiresOn ? { ...source, expiresOn: currentDay + source.expiresOn } : source;
  return [...sources.filter((item) => item.id !== source.id), normalized];
}

function addReason(reasons: BlockingReason[], reason: BlockingReason): BlockingReason[] {
  return reasons.includes(reason) ? reasons : [...reasons, reason];
}

function removeReason(reasons: BlockingReason[], reason: BlockingReason): BlockingReason[] {
  return reasons.filter((item) => item !== reason);
}

function appendCsv(value: string, id: string): string {
  const set = csvSet(value);
  set.add(id);
  return [...set].join(",");
}

function csvSet(value: string): Set<string> {
  return new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
}

function appendHistory(state: GameState, title: string, text: string) {
  return [...state.history, { id: `h-${state.history.length + 1}`, day: state.date.absoluteDay, title, text }].slice(-30);
}

function appendActivity(state: GameState, text: string, tone: "neutral" | "positive" | "warning" | "danger" = "neutral") {
  return [...state.activityLog, { id: `a-${state.activityLog.length + 1}-${state.date.absoluteDay}`, day: state.date.absoluteDay, text, tone }].slice(-30);
}

function rankUpgrade(current: RegionKnowledge, next: RegionKnowledge): RegionKnowledge {
  return regionRank[next] > regionRank[current] ? next : current;
}

function random01(state: GameState): number {
  const x = Math.sin(state.seed + state.rngCursor * 999) * 10000;
  state.rngCursor += 1;
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function fmt(value: number): string {
  return round1(value).toFixed(1);
}

function formatDelta(value: number): string {
  return value >= 0 ? `+${fmt(value)}` : fmt(value);
}

function relationLabel(stat: string) {
  if (stat === "resonance") return "感应";
  if (stat === "trust") return "信任";
  if (stat === "fear") return "恐惧";
  return "影响";
}

function moduleLabel(module: ModuleId) {
  if (module === "tree") return "神树";
  if (module === "map") return "地图";
  if (module === "characters") return "人物";
  if (module === "tribe") return "部落";
  return "信仰";
}

function attitudeText(character: { trust: number; fear: number }) {
  if (character.trust - character.fear >= 15) return "亲近";
  if (character.fear - character.trust >= 15) return "敬畏";
  if (character.trust >= 30 && character.fear >= 30) return "依赖且畏惧";
  if (character.trust < 20 && character.fear < 20) return "怀疑";
  return "谨慎承认";
}

function tendencyLabel(state: GameState): string {
  const scores = [
    ["守护", Number(state.flags.guardian ?? 0)],
    ["威慑", Number(state.flags.dread ?? 0)],
    ["沉默", Number(state.flags.silent ?? 0)]
  ] as const;
  const sorted = [...scores].sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] - sorted[1][1] <= 2) return `${sorted[0][0]}与${sorted[1][0]}混合`;
  return sorted[0][0];
}

function tendencyEvidence(state: GameState): string[] {
  const evidence = [];
  if (Number(state.flags.guardian ?? 0) > 0) evidence.push("你曾选择治疗、庇护或减轻祭祀负担。");
  if (Number(state.flags.dread ?? 0) > 0) evidence.push("你曾用威慑、索取或神威迫使人群服从。");
  if (Number(state.flags.silent ?? 0) > 0) evidence.push("你多次保持沉默，让人物和部落自行解释。");
  return evidence.slice(0, 3);
}

function warDirectionLabel(value: string) {
  if (value === "defend") return "储粮守卫";
  if (value === "divine-show") return "展示神威";
  if (value === "withdraw") return "准备迁避";
  return "部落自行决定";
}

function oracleLabel(value: string) {
  if (value === "food") return "优先储粮";
  if (value === "heal") return "先照料伤者";
  if (value === "explore") return "探索周边";
  if (value === "patrol") return "加强警戒";
  return "让部落自行决定";
}
