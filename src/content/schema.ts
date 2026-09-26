import { z } from "zod";

const access = z.enum(["locked", "hinted", "partial", "full"]);
const moduleId = z.enum(["tree", "map", "characters", "tribe", "faith"]);
const regionKnowledge = z.enum(["unknown", "trace", "rumor", "sensed", "known"]);
const rootConnection = z.enum(["none", "weak", "stable"]);
const characterKnowledge = z.enum(["hidden", "mentioned", "known", "understood"]);
const worshipVisibility = z.enum(["none", "personal", "secret-group", "restricted-public", "public"]);

const rateSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amount: z.number().finite(),
  module: moduleId,
  expiresOn: z.number().int().optional()
});

export const balanceSchema = z.object({
  version: z.string().min(1),
  initial: z.object({
    tree: z.object({
      power: z.number().finite(),
      powerCap: z.number().finite().positive(),
      stage: z.string().min(1),
      perception: z.number().int(),
      miracleTier: z.string().min(1),
      auraSources: z.array(rateSourceSchema)
    }),
    tribe: z.object({
      name: z.string().min(1),
      population: z.number().int().positive(),
      food: z.number().finite(),
      baseProduction: z.number().finite(),
      baseConsumption: z.number().finite(),
      productionBonus: z.number().finite(),
      injuries: z.number().int().min(0),
      stability: z.number().finite().min(0).max(100),
      labor: z.string().min(1),
      needs: z.array(z.string().min(1)),
      currentAction: z.string().min(1)
    }),
    faith: z.object({
      believers: z.number().int().min(0),
      visibility: worshipVisibility,
      intensity: z.number().int().min(0),
      offeringCost: z.number().finite().min(0),
      collectiveFaith: z.number().finite().min(0).max(100),
      collectiveFear: z.number().finite().min(0).max(100),
      interpreter: z.string().nullable(),
      interpretationControl: z.number().finite(),
      ritual: z.string()
    })
  })
});

export const phaseFileSchema = z.object({
  phases: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    order: z.number().int(),
    moduleAccess: z.partialRecord(moduleId, access),
    milestone: z.array(z.string().min(1))
  })).min(1)
});

export const regionFileSchema = z.object({
  regions: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    traceName: z.string().min(1),
    initialKnowledge: regionKnowledge,
    initialConnection: rootConnection,
    exploration: z.number().finite().min(0).max(100),
    aura: z.number().finite().min(0),
    risk: z.string(),
    resource: z.string(),
    controller: z.string(),
    notes: z.array(z.string()).optional()
  })).min(1)
});

export const characterFileSchema = z.object({
  characters: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    mentionName: z.string().min(1),
    role: z.string().min(1),
    need: z.string().min(1),
    location: z.string().min(1),
    resonance: z.number().finite().min(0).max(100),
    trust: z.number().finite().min(0).max(100),
    fear: z.number().finite().min(0).max(100),
    influence: z.number().finite(),
    knowledge: characterKnowledge
  })).min(1)
});

export const conditionSchema: z.ZodTypeAny = z.lazy(() => z.union([
  z.object({ all: z.array(conditionSchema) }),
  z.object({ any: z.array(conditionSchema) }),
  z.object({ not: conditionSchema }),
  z.object({ phase: z.string().min(1) }),
  z.object({ dateAtLeast: z.number().int().min(1) }),
  z.object({ dateAtMost: z.number().int().min(1) }),
  z.object({ flag: z.string().min(1) }),
  z.object({ notFlag: z.string().min(1) }),
  z.object({ eventHandled: z.string().min(1) }),
  z.object({ divineFocus: z.string().min(1) }),
  z.object({ oracle: z.string().min(1) }),
  z.object({ moduleAccessAtLeast: z.object({ module: moduleId, level: access }) }),
  z.object({ resourceAtLeast: z.object({ resource: z.enum(["power", "food"]), value: z.number().finite() }) }),
  z.object({ relationAtLeast: z.object({ character: z.string().min(1), stat: z.enum(["resonance", "trust", "fear"]), value: z.number().finite() }) }),
  z.object({ regionKnowledgeAtLeast: z.object({ region: z.string().min(1), level: regionKnowledge }) }),
  z.object({ regionExplorationAtLeast: z.object({ region: z.string().min(1), value: z.number().finite() }) }),
  z.object({ tribePlansAtLeast: z.number().int().min(0) }),
  z.object({ threatAtLeast: z.number().int().min(0) })
]));

export const effectSchema: z.ZodTypeAny = z.union([
  z.object({ changePower: z.number().finite() }),
  z.object({ changePowerCap: z.number().finite() }),
  z.object({ changePerception: z.number().finite() }),
  z.object({ setTreeStage: z.string().min(1) }),
  z.object({ addAuraSource: rateSourceSchema }),
  z.object({ removeAuraSource: z.string().min(1) }),
  z.object({ addFaithSource: rateSourceSchema }),
  z.object({ removeFaithSource: z.string().min(1) }),
  z.object({ changeRegionExploration: z.object({ region: z.string().min(1), amount: z.number().finite() }) }),
  z.object({ setRegionKnowledge: z.object({ region: z.string().min(1), knowledge: regionKnowledge }) }),
  z.object({ setRegionConnection: z.object({ region: z.string().min(1), connection: rootConnection }) }),
  z.object({ changeCharacter: z.object({ character: z.string().min(1), stat: z.enum(["resonance", "trust", "fear", "influence"]), amount: z.number().finite() }) }),
  z.object({ setCharacterKnowledge: z.object({ character: z.string().min(1), knowledge: characterKnowledge }) }),
  z.object({ addMemory: z.object({ character: z.string().min(1), text: z.string().min(1) }) }),
  z.object({ changeFood: z.number().finite() }),
  z.object({ changeFoodProduction: z.number().finite() }),
  z.object({ changeInjuries: z.number().int() }),
  z.object({ changeStability: z.number().finite() }),
  z.object({ setTribeNeed: z.array(z.string().min(1)) }),
  z.object({ setTribeAction: z.string().min(1) }),
  z.object({ changeBelievers: z.number().int() }),
  z.object({ setWorshipVisibility: worshipVisibility }),
  z.object({ changeWorshipIntensity: z.number().int() }),
  z.object({ changeOfferingCost: z.number().finite() }),
  z.object({ changeCollectiveFaith: z.number().finite() }),
  z.object({ changeCollectiveFear: z.number().finite() }),
  z.object({ setInterpreter: z.string().min(1) }),
  z.object({ setRitual: z.string().min(1) }),
  z.object({ setFlag: z.object({ flag: z.string().min(1), value: z.union([z.boolean(), z.number(), z.string()]) }) }),
  z.object({ changeFlag: z.object({ flag: z.string().min(1), amount: z.number().finite() }) }),
  z.object({ openModule: z.object({ module: moduleId, access }) }),
  z.object({ setPhase: z.string().min(1) }),
  z.object({ queueEvent: z.string().min(1) }),
  z.object({ addHistory: z.object({ title: z.string().min(1), text: z.string().min(1) }) }),
  z.object({ addActivity: z.object({ text: z.string().min(1), tone: z.enum(["neutral", "positive", "warning", "danger"]).optional() }) }),
  z.object({ addTendency: z.enum(["guardian", "dread", "silent"]) }),
  z.object({ setWarDirection: z.string().min(1) }),
  z.object({ setOracle: z.string().min(1) }),
  z.object({ chapterSummary: z.literal(true) })
]);

const decisionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  preview: z.string().min(1),
  costHint: z.string().optional(),
  impactHint: z.string().optional(),
  relatedModules: z.array(moduleId).optional(),
  requirements: conditionSchema.optional(),
  effects: z.array(effectSchema).default([]),
  ongoingEffects: z.array(effectSchema).optional(),
  resultText: z.array(z.string().min(1))
});

export const divineChoiceFileSchema = z.object({
  divineChoices: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    body: z.array(z.string().min(1)),
    phaseIds: z.array(z.string().min(1)),
    priority: z.number().int().default(40),
    trigger: conditionSchema.optional(),
    options: z.array(decisionOptionSchema).min(3)
  })).min(1)
});

export const oracleFileSchema = z.object({
  oracles: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
    requirements: conditionSchema.optional(),
    effects: z.array(effectSchema).optional()
  })).min(1)
});

export const eventSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["urgent", "fixed", "condition", "random"]),
  title: z.string().min(1),
  body: z.array(z.string().min(1)),
  phaseIds: z.array(z.string().min(1)),
  priority: z.number().int(),
  once: z.boolean(),
  trigger: conditionSchema.optional(),
  deadlineDay: z.number().int().min(1).optional(),
  weight: z.number().finite().min(0).optional(),
  options: z.array(decisionOptionSchema).min(1)
});

export const contentSchema = z.object({
  version: z.string().min(1),
  balance: balanceSchema,
  phases: phaseFileSchema.shape.phases,
  regions: regionFileSchema.shape.regions,
  characters: characterFileSchema.shape.characters,
  divineChoices: divineChoiceFileSchema.shape.divineChoices,
  oracles: oracleFileSchema.shape.oracles,
  events: z.array(eventSchema)
});
