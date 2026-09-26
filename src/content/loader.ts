import { parse } from "yaml";
import type { GameContent } from "../engine/types";
import {
  balanceSchema,
  characterFileSchema,
  contentSchema,
  divineChoiceFileSchema,
  eventSchema,
  oracleFileSchema,
  phaseFileSchema,
  regionFileSchema
} from "./schema";

type RawFiles = Record<string, string>;

const rawFiles = import.meta.env
  ? import.meta.glob("./phase-01/**/*.yaml", { query: "?raw", import: "default", eager: true }) as RawFiles
  : {};

let cached: GameContent | null = null;

export function loadContent(): GameContent {
  if (cached) return cached;
  cached = parseContentFiles(rawFiles);
  return cached;
}

export function setLoadedContentForTests(content: GameContent): void {
  cached = content;
}

export function parseContentFiles(files: RawFiles): GameContent {
  const read = (suffix: string) => {
    const entry = Object.entries(files).find(([path]) => path.endsWith(suffix));
    if (!entry) throw new Error(`内容文件缺失：${suffix}`);
    try {
      return { path: entry[0], data: parse(entry[1]) };
    } catch (error) {
      throw new Error(`YAML解析失败：${entry[0]}：${String(error)}`);
    }
  };

  const parseWithPath = <T>(path: string, data: unknown, parser: { parse: (value: unknown) => T }): T => {
    try {
      return parser.parse(data);
    } catch (error) {
      throw new Error(`内容校验失败：${path}\n${String(error)}`);
    }
  };

  const balanceRaw = read("balance.yaml");
  const phasesRaw = read("phase.yaml");
  const regionsRaw = read("regions.yaml");
  const charactersRaw = read("characters.yaml");
  const divineChoicesRaw = read("divine-choices.yaml");
  const oraclesRaw = read("oracles.yaml");

  const balance = parseWithPath(balanceRaw.path, balanceRaw.data, balanceSchema);
  const phases = parseWithPath(phasesRaw.path, phasesRaw.data, phaseFileSchema).phases;
  const regions = parseWithPath(regionsRaw.path, regionsRaw.data, regionFileSchema).regions;
  const characters = parseWithPath(charactersRaw.path, charactersRaw.data, characterFileSchema).characters;
  const divineChoices = parseWithPath(divineChoicesRaw.path, divineChoicesRaw.data, divineChoiceFileSchema).divineChoices;
  const oracles = parseWithPath(oraclesRaw.path, oraclesRaw.data, oracleFileSchema).oracles;
  const events = Object.entries(files)
    .filter(([path]) => path.includes("/events-v011/") || path.includes("\\events-v011\\"))
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([path, text]) => {
      const data = parse(text);
      if (data && typeof data === "object" && Array.isArray((data as { events?: unknown[] }).events)) {
        return (data as { events: unknown[] }).events.map((event, index) => parseWithPath(`${path}#${index}`, event, eventSchema));
      }
      return [parseWithPath(path, data, eventSchema)];
    });

  const content = contentSchema.parse({
    version: balance.version,
    balance,
    phases,
    regions,
    characters,
    divineChoices,
    oracles,
    events
  }) as unknown as GameContent;
  validateReferences(content);
  return content;
}

export function validateReferences(content: GameContent): void {
  const ids = (values: Array<{ id: string }>, label: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value.id)) throw new Error(`${label} ID重复：${value.id}`);
      seen.add(value.id);
    }
    return seen;
  };
  const phases = ids(content.phases, "阶段");
  const regions = ids(content.regions, "地区");
  const characters = ids(content.characters, "人物");
  const divineChoices = ids(content.divineChoices, "神意");
  const oracles = ids(content.oracles, "神谕");
  const events = ids(content.events, "事件");

  for (const decision of content.divineChoices) {
    for (const phaseId of decision.phaseIds) {
      if (!phases.has(phaseId)) throw new Error(`神意 ${decision.id} 引用了不存在的阶段 ${phaseId}`);
    }
    const moduleCoverage = new Set(decision.options.flatMap((option) => option.relatedModules ?? []));
    if (moduleCoverage.size < 2) throw new Error(`神意 ${decision.id} 至少需要覆盖两个战略方向`);
  }

  for (const event of content.events) {
    for (const phaseId of event.phaseIds) {
      if (!phases.has(phaseId)) throw new Error(`事件 ${event.id} 引用了不存在的阶段 ${phaseId}`);
    }
    if (!event.options.length) throw new Error(`事件 ${event.id} 没有选项`);
  }

  const requiredEvents = [
    "awakening",
    "roots-stirring",
    "forest-after-rain",
    "blood-in-soil",
    "mang-wounded",
    "mang-returns",
    "mang-tests-sign",
    "storm-under-tree",
    "first-offering",
    "distant-hunger",
    "request-for-wounded",
    "divided-story",
    "people-under-tree",
    "public-proof",
    "first-oracle",
    "who-speaks",
    "offering-form",
    "survival-pressure",
    "human-footprints",
    "fires-beyond-woods"
  ];
  for (const id of requiredEvents) {
    if (!events.has(id)) throw new Error(`v0.1.1主流程事件缺失：${id}`);
  }

  for (const region of content.regions) regions.add(region.id);
  for (const character of content.characters) characters.add(character.id);
  if (!oracles.has("autonomy")) throw new Error("神谕内容必须包含 autonomy");
  if (!divineChoices.size) throw new Error("至少需要一个神意抉择定义");
}
