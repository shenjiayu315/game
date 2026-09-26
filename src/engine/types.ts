export type RuntimeMode = "observing" | "decision" | "result" | "summary";
export type BlockingReason = "opening" | "decision" | "result" | "background" | "loading";
export type AccessLevel = "locked" | "hinted" | "partial" | "full";
export type ModuleId = "tree" | "map" | "characters" | "tribe" | "faith";
export type Season = "春" | "夏" | "秋" | "冬";
export type RegionKnowledge = "unknown" | "trace" | "rumor" | "sensed" | "known";
export type RootConnection = "none" | "weak" | "stable";
export type CharacterKnowledge = "hidden" | "mentioned" | "known" | "understood";
export type WorshipVisibility = "none" | "personal" | "secret-group" | "restricted-public" | "public";

export interface GameDate {
  year: string;
  season: Season;
  day: number;
  absoluteDay: number;
}

export interface RateSource {
  id: string;
  label: string;
  amount: number;
  module: ModuleId;
  expiresOn?: number;
}

export interface TreeState {
  power: number;
  powerCap: number;
  stage: string;
  perception: number;
  miracleTier: string;
  auraSources: RateSource[];
  faithSources: RateSource[];
}

export interface RegionState {
  id: string;
  name: string;
  traceName: string;
  displayName: string;
  knowledge: RegionKnowledge;
  connection: RootConnection;
  exploration: number;
  aura: number;
  risk: string;
  resource: string;
  controller: string;
  notes: string[];
  new: boolean;
}

export interface CharacterState {
  id: string;
  name: string;
  mentionName: string;
  knowledge: CharacterKnowledge;
  resonance: number;
  trust: number;
  fear: number;
  influence: number;
  role: string;
  need: string;
  location: string;
  memories: string[];
  new: boolean;
}

export interface TribePlanState {
  id: string;
  label: string;
  remainingDays: number;
  totalDays: number;
  reasons: string[];
  response: "执行" | "调整" | "请求条件" | "拒绝";
}

export interface TribeState {
  name: string;
  population: number;
  food: number;
  baseProduction: number;
  baseConsumption: number;
  productionBonus: number;
  injuries: number;
  stability: number;
  labor: string;
  needs: string[];
  currentAction: string;
  plan: TribePlanState | null;
  completedPlans: number;
  foodFloorActive: boolean;
}

export interface FaithState {
  believers: number;
  visibility: WorshipVisibility;
  intensity: number;
  offeringCost: number;
  collectiveFaith: number;
  collectiveFear: number;
  interpreter: string | null;
  interpretationControl: number;
  ritual: string;
}

export interface DivineFocusState {
  id: string;
  label: string;
  sourceDecisionId: string;
  startedOn: number;
  endsOn: number;
  effects: EffectDefinition[];
  summary: string;
}

export interface CurrentDecisionState {
  id: string;
  source: "world-event" | "divine-choice" | "oracle-review";
}

export interface PendingEventState {
  eventId: string;
  queuedOn: number;
}

export interface FeedbackItem {
  label: string;
  detail?: string;
  before?: string;
  after?: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}

export interface GameReport {
  title: string;
  body: string[];
  action?: string;
  world?: string;
  interpretation?: string;
  resources: FeedbackItem[];
  rates: FeedbackItem[];
  progress: FeedbackItem[];
  unlocks: FeedbackItem[];
  delayed: FeedbackItem[];
}

export interface HistoryEntry {
  id: string;
  day: number;
  title: string;
  text: string;
}

export interface ActivityEntry {
  id: string;
  day: number;
  text: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}

export interface ChapterResult {
  title: string;
  lines: string[];
  tendency: string;
  evidence: string[];
}

export interface GameState {
  schemaVersion: number;
  contentVersion: string;
  runId: string;
  seed: number;
  rngCursor: number;
  date: GameDate;
  phaseId: string;
  runtimeMode: RuntimeMode;
  preferredSpeed: 0 | 1 | 3;
  blockingReasons: BlockingReason[];
  moduleAccess: Record<ModuleId, AccessLevel>;
  tree: TreeState;
  regions: Record<string, RegionState>;
  characters: Record<string, CharacterState>;
  tribe: TribeState;
  faith: FaithState;
  currentDivineFocus: DivineFocusState | null;
  nextDivineChoiceDay: number | null;
  currentOracleId: string | null;
  nextOracleReviewDay: number | null;
  pendingEvents: PendingEventState[];
  currentDecision: CurrentDecisionState | null;
  pendingResult: GameReport | null;
  scheduledEffects: ScheduledEffect[];
  flags: Record<string, boolean | number | string>;
  history: HistoryEntry[];
  activityLog: ActivityEntry[];
  chapterResult: ChapterResult | null;
  recentMessage: string;
  lastDailyDelta: {
    power: number;
    food: number;
  };
  saveMessage: string | null;
}

export interface ScheduledEffect {
  dueDay: number;
  effects: EffectDefinition[];
  source: string;
}

export interface GameCommand {
  type:
    | "START_NEW_GAME"
    | "SET_SPEED"
    | "ADVANCE_DAY"
    | "CHOOSE_DECISION_OPTION"
    | "ACKNOWLEDGE_RESULT"
    | "SAVE_GAME"
    | "LOAD_GAME"
    | "RETURN_TO_TITLE"
    | "SET_BACKGROUND_PAUSE";
  speed?: 0 | 1 | 3;
  decisionId?: string;
  optionId?: string;
  state?: GameState;
  paused?: boolean;
  seed?: number;
}

export interface GameContent {
  version: string;
  balance: BalanceDefinition;
  phases: PhaseDefinition[];
  regions: RegionDefinition[];
  characters: CharacterDefinition[];
  divineChoices: DivineChoiceDefinition[];
  oracles: OracleDefinition[];
  events: EventDefinition[];
}

export interface BalanceDefinition {
  initial: {
    tree: {
      power: number;
      powerCap: number;
      stage: string;
      perception: number;
      miracleTier: string;
      auraSources: RateSource[];
    };
    tribe: Omit<TribeState, "plan" | "completedPlans" | "foodFloorActive">;
    faith: FaithState;
  };
}

export interface PhaseDefinition {
  id: string;
  title: string;
  summary: string;
  order: number;
  moduleAccess: Partial<Record<ModuleId, AccessLevel>>;
  milestone: string[];
}

export interface RegionDefinition {
  id: string;
  name: string;
  traceName: string;
  initialKnowledge: RegionKnowledge;
  initialConnection: RootConnection;
  exploration: number;
  aura: number;
  risk: string;
  resource: string;
  controller: string;
  notes?: string[];
}

export interface CharacterDefinition {
  id: string;
  name: string;
  mentionName: string;
  role: string;
  need: string;
  location: string;
  resonance: number;
  trust: number;
  fear: number;
  influence: number;
  knowledge: CharacterKnowledge;
}

export interface DecisionOptionDefinition {
  id: string;
  label: string;
  preview: string;
  costHint?: string;
  impactHint?: string;
  relatedModules?: ModuleId[];
  requirements?: ConditionDefinition;
  effects: EffectDefinition[];
  ongoingEffects?: EffectDefinition[];
  resultText: string[];
}

export interface DivineChoiceDefinition {
  id: string;
  title: string;
  body: string[];
  phaseIds: string[];
  priority: number;
  trigger?: ConditionDefinition;
  options: DecisionOptionDefinition[];
}

export interface OracleDefinition {
  id: string;
  label: string;
  description: string;
  requirements?: ConditionDefinition;
  effects?: EffectDefinition[];
}

export interface EventDefinition {
  id: string;
  kind: "urgent" | "fixed" | "condition" | "random";
  title: string;
  body: string[];
  phaseIds: string[];
  priority: number;
  once: boolean;
  trigger?: ConditionDefinition;
  deadlineDay?: number;
  weight?: number;
  options: DecisionOptionDefinition[];
}

export type ConditionDefinition =
  | { all: ConditionDefinition[] }
  | { any: ConditionDefinition[] }
  | { not: ConditionDefinition }
  | { phase: string }
  | { dateAtLeast: number }
  | { dateAtMost: number }
  | { flag: string }
  | { notFlag: string }
  | { eventHandled: string }
  | { divineFocus: string }
  | { oracle: string }
  | { moduleAccessAtLeast: { module: ModuleId; level: AccessLevel } }
  | { resourceAtLeast: { resource: "power" | "food"; value: number } }
  | { relationAtLeast: { character: string; stat: "resonance" | "trust" | "fear"; value: number } }
  | { regionKnowledgeAtLeast: { region: string; level: RegionKnowledge } }
  | { regionExplorationAtLeast: { region: string; value: number } }
  | { tribePlansAtLeast: number }
  | { threatAtLeast: number };

export type EffectDefinition =
  | { changePower: number }
  | { changePowerCap: number }
  | { changePerception: number }
  | { setTreeStage: string }
  | { addAuraSource: RateSource }
  | { removeAuraSource: string }
  | { addFaithSource: RateSource }
  | { removeFaithSource: string }
  | { changeRegionExploration: { region: string; amount: number } }
  | { setRegionKnowledge: { region: string; knowledge: RegionKnowledge } }
  | { setRegionConnection: { region: string; connection: RootConnection } }
  | { changeCharacter: { character: string; stat: "resonance" | "trust" | "fear" | "influence"; amount: number } }
  | { setCharacterKnowledge: { character: string; knowledge: CharacterKnowledge } }
  | { addMemory: { character: string; text: string } }
  | { changeFood: number }
  | { changeFoodProduction: number }
  | { changeInjuries: number }
  | { changeStability: number }
  | { setTribeNeed: string[] }
  | { setTribeAction: string }
  | { changeBelievers: number }
  | { setWorshipVisibility: WorshipVisibility }
  | { changeWorshipIntensity: number }
  | { changeOfferingCost: number }
  | { changeCollectiveFaith: number }
  | { changeCollectiveFear: number }
  | { setInterpreter: string }
  | { setRitual: string }
  | { setFlag: { flag: string; value: boolean | number | string } }
  | { changeFlag: { flag: string; amount: number } }
  | { openModule: { module: ModuleId; access: AccessLevel } }
  | { setPhase: string }
  | { queueEvent: string }
  | { addHistory: { title: string; text: string } }
  | { addActivity: { text: string; tone?: "neutral" | "positive" | "warning" | "danger" } }
  | { addTendency: "guardian" | "dread" | "silent" }
  | { setWarDirection: string }
  | { setOracle: string }
  | { chapterSummary: true };
