import { z } from "zod";
import type { GameState } from "../types";

export const SAVE_KEY = "spirit-tree-dynamic.save.v2";

const saveEnvelopeSchema = z.object({
  schemaVersion: z.literal(2),
  contentVersion: z.string(),
  savedAt: z.string(),
  state: z.unknown()
});

export interface SaveEnvelope {
  schemaVersion: 2;
  contentVersion: string;
  savedAt: string;
  state: GameState;
}

export function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function saveGame(state: GameState): { ok: true; savedAt: string } | { ok: false; error: string } {
  if (!canUseStorage()) return { ok: false, error: "当前环境不可使用本地存储。" };
  try {
    const envelope: SaveEnvelope = {
      schemaVersion: 2,
      contentVersion: state.contentVersion,
      savedAt: new Date().toISOString(),
      state
    };
    saveEnvelopeSchema.parse(envelope);
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
    saveEnvelopeSchema.parse(JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? ""));
    return { ok: true, savedAt: envelope.savedAt };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "保存失败。" };
  }
}

export function loadSavedGame(expectedContentVersion: string): { ok: true; state: GameState; savedAt: string } | { ok: false; reason: string } {
  if (!canUseStorage()) return { ok: false, reason: "当前环境不可读取本地存储。" };
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) return { ok: false, reason: "尚无存档" };
  try {
    const parsed = saveEnvelopeSchema.parse(JSON.parse(raw)) as SaveEnvelope;
    if (parsed.contentVersion !== expectedContentVersion) return { ok: false, reason: "存档与当前版本不兼容" };
    if (!parsed.state || typeof parsed.state !== "object") return { ok: false, reason: "存档损坏" };
    return { ok: true, state: parsed.state, savedAt: parsed.savedAt };
  } catch {
    return { ok: false, reason: "存档损坏" };
  }
}

export function getSaveStatus(expectedContentVersion: string): { hasSave: boolean; reason: string; savedAt?: string } {
  const loaded = loadSavedGame(expectedContentVersion);
  if (loaded.ok) return { hasSave: true, reason: "可继续游戏", savedAt: loaded.savedAt };
  return { hasSave: false, reason: loaded.reason };
}
