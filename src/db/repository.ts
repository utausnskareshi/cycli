/**
 * データアクセス層
 * - schema.ts のテーブルを使いやすく包み、暗号化/復号を吸収する
 * - View 層は repository のみを通じてデータを読み書きする
 */
import {
  db,
  type BBTRecord,
  type LifestyleRecord,
  type NoteRecord,
  type PeriodRecord,
  type PillRecord,
  type Settings,
  type SymptomRecord,
  type WeightRecord,
} from "./schema";
import { decryptText, encryptText, isEncryptionEnabled } from "./crypto";
import type { DateStr } from "../utils/date";

/** 生理：開始日のみ取得（予測に使う） */
export async function getPeriodStartDates(): Promise<DateStr[]> {
  // isStart は boolean のためインデックス検索せず、全件 filter する
  const rows = await db.periods.toArray();
  return rows.filter((r) => r.isStart).map((r) => r.date).sort();
}

/** 全生理日（範囲塗り用、Set） */
export async function getAllPeriodDates(): Promise<Set<DateStr>> {
  const rows = await db.periods.toArray();
  return new Set(rows.map((r) => r.date));
}

/** 生理レコード保存 */
export async function savePeriod(record: Omit<PeriodRecord, "updatedAt">): Promise<void> {
  await db.periods.put({
    ...record,
    updatedAt: Date.now(),
  });
}

/** 生理レコード取得 */
export async function getPeriod(date: DateStr): Promise<PeriodRecord | undefined> {
  return db.periods.get(date);
}

/** 生理レコード削除 */
export async function deletePeriod(date: DateStr): Promise<void> {
  await db.periods.delete(date);
}

/** 「今日生理が来た」ワンタップ用 */
export async function markPeriodStartToday(date: DateStr): Promise<void> {
  await savePeriod({
    date,
    isStart: true,
    flow: 2,
    pain: 0,
    medication: false,
  });
}

/** 基礎体温 */
export async function saveBBT(date: DateStr, value: number): Promise<void> {
  await db.bbt.put({ date, value, updatedAt: Date.now() });
}

export async function getBBT(date: DateStr): Promise<BBTRecord | undefined> {
  return db.bbt.get(date);
}

export async function getBBTRange(from: DateStr, to: DateStr): Promise<BBTRecord[]> {
  return db.bbt.where("date").between(from, to, true, true).toArray();
}

export async function getAllBBT(): Promise<BBTRecord[]> {
  return db.bbt.orderBy("date").toArray();
}

/** 体重 */
export async function saveWeight(date: DateStr, value: number): Promise<void> {
  await db.weight.put({ date, value, updatedAt: Date.now() });
}

export async function getWeight(date: DateStr): Promise<WeightRecord | undefined> {
  return db.weight.get(date);
}

export async function getAllWeight(): Promise<WeightRecord[]> {
  return db.weight.orderBy("date").toArray();
}

/** 症状 */
export async function saveSymptoms(record: Omit<SymptomRecord, "updatedAt">): Promise<void> {
  await db.symptoms.put({ ...record, updatedAt: Date.now() });
}

export async function getSymptoms(date: DateStr): Promise<SymptomRecord | undefined> {
  return db.symptoms.get(date);
}

/** メモ（暗号化対象） */
export async function saveNote(date: DateStr, text: string): Promise<void> {
  if (text.trim().length === 0) {
    await db.notes.delete(date);
    return;
  }
  const encrypted = await encryptText(text);
  await db.notes.put({
    date,
    textEncrypted: encrypted,
    updatedAt: Date.now(),
  });
}

export async function getNote(date: DateStr): Promise<string | null> {
  const row = await db.notes.get(date);
  if (!row) return null;
  try {
    return await decryptText(row.textEncrypted);
  } catch {
    return null;
  }
}

/** ピル */
export async function savePill(record: Omit<PillRecord, "updatedAt">): Promise<void> {
  await db.pills.put({ ...record, updatedAt: Date.now() });
}

export async function getPill(date: DateStr): Promise<PillRecord | undefined> {
  return db.pills.get(date);
}

/** ライフスタイル（任意項目） */
export async function saveLifestyle(
  date: DateStr,
  patch: Omit<LifestyleRecord, "date" | "updatedAt">,
): Promise<void> {
  const existing = await db.lifestyle.get(date);
  const merged: LifestyleRecord = {
    date,
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };
  await db.lifestyle.put(merged);
}

export async function getLifestyle(date: DateStr): Promise<LifestyleRecord | undefined> {
  return db.lifestyle.get(date);
}

export async function getAllLifestyle(): Promise<LifestyleRecord[]> {
  return db.lifestyle.orderBy("date").toArray();
}

/** ある日付に何らかの記録があるか（カレンダーのドット用） */
export async function hasAnyRecord(date: DateStr): Promise<boolean> {
  const [p, b, w, s, n] = await Promise.all([
    db.periods.get(date),
    db.bbt.get(date),
    db.weight.get(date),
    db.symptoms.get(date),
    db.notes.get(date),
  ]);
  return Boolean(p ?? b ?? w ?? s ?? n);
}

/** ある月の記録ありの日付セット */
export async function getRecordedDatesInMonth(year: number, month0: number): Promise<Set<DateStr>> {
  const m = String(month0 + 1).padStart(2, "0");
  const prefix = `${year}-${m}`;
  const [periods, bbts, weights, symptoms, notes] = await Promise.all([
    db.periods.where("date").startsWith(prefix).primaryKeys(),
    db.bbt.where("date").startsWith(prefix).primaryKeys(),
    db.weight.where("date").startsWith(prefix).primaryKeys(),
    db.symptoms.where("date").startsWith(prefix).primaryKeys(),
    db.notes.where("date").startsWith(prefix).primaryKeys(),
  ]);
  const set = new Set<DateStr>();
  for (const arr of [periods, bbts, weights, symptoms, notes]) {
    for (const k of arr) set.add(String(k));
  }
  return set;
}

export interface ExportData {
  version: 2;
  encryptionEnabled: boolean;
  exportedAt: number;
  periods: PeriodRecord[];
  bbt: BBTRecord[];
  weight: WeightRecord[];
  symptoms: SymptomRecord[];
  notes: NoteRecord[];
  pills: PillRecord[];
  lifestyle: LifestyleRecord[];
  settings: Settings[];
}

/** 全データのエクスポート（メモは暗号化済み文字列のまま） */
export async function exportAll(): Promise<ExportData> {
  const [periods, bbt, weight, symptoms, notes, pills, lifestyle, settings] =
    await Promise.all([
      db.periods.toArray(),
      db.bbt.toArray(),
      db.weight.toArray(),
      db.symptoms.toArray(),
      db.notes.toArray(),
      db.pills.toArray(),
      db.lifestyle.toArray(),
      db.settings.toArray(),
    ]);
  return {
    version: 2,
    encryptionEnabled: isEncryptionEnabled(),
    exportedAt: Date.now(),
    periods,
    bbt,
    weight,
    symptoms,
    notes,
    pills,
    lifestyle,
    settings,
  };
}

/** インポート結果 */
export interface ImportResult {
  ok: boolean;
  imported: {
    periods: number;
    bbt: number;
    weight: number;
    symptoms: number;
    notes: number;
    pills: number;
    lifestyle: number;
  };
  error?: string;
}

/**
 * JSONインポート
 * - 既存データは置き換え（merge=falseの場合）
 * - 暗号化されたメモは別端末では復号できないため、現端末と同じパスコードが必要
 */
export async function importAll(
  data: unknown,
  options: { merge?: boolean } = { merge: false },
): Promise<ImportResult> {
  if (typeof data !== "object" || data === null) {
    return {
      ok: false,
      imported: { periods: 0, bbt: 0, weight: 0, symptoms: 0, notes: 0, pills: 0, lifestyle: 0 },
      error: "JSON形式が不正です",
    };
  }
  const d = data as Partial<ExportData>;
  // 旧バージョン(1)も読み込めるよう version は number として比較
  const ver = (d as { version?: number }).version;
  if (ver !== 1 && ver !== 2) {
    return {
      ok: false,
      imported: { periods: 0, bbt: 0, weight: 0, symptoms: 0, notes: 0, pills: 0, lifestyle: 0 },
      error: "対応していないバージョンです",
    };
  }

  try {
    await db.transaction(
      "rw",
      [db.periods, db.bbt, db.weight, db.symptoms, db.notes, db.pills, db.lifestyle, db.settings],
      async () => {
        if (options.merge !== true) {
          await db.periods.clear();
          await db.bbt.clear();
          await db.weight.clear();
          await db.symptoms.clear();
          await db.notes.clear();
          await db.pills.clear();
          await db.lifestyle.clear();
        }
        if (Array.isArray(d.periods)) await db.periods.bulkPut(d.periods);
        if (Array.isArray(d.bbt)) await db.bbt.bulkPut(d.bbt);
        if (Array.isArray(d.weight)) await db.weight.bulkPut(d.weight);
        if (Array.isArray(d.symptoms)) await db.symptoms.bulkPut(d.symptoms);
        if (Array.isArray(d.notes)) await db.notes.bulkPut(d.notes);
        if (Array.isArray(d.pills)) await db.pills.bulkPut(d.pills);
        if (Array.isArray(d.lifestyle)) await db.lifestyle.bulkPut(d.lifestyle);
        if (Array.isArray(d.settings)) await db.settings.bulkPut(d.settings);
      },
    );
    return {
      ok: true,
      imported: {
        periods: d.periods?.length ?? 0,
        bbt: d.bbt?.length ?? 0,
        weight: d.weight?.length ?? 0,
        symptoms: d.symptoms?.length ?? 0,
        notes: d.notes?.length ?? 0,
        pills: d.pills?.length ?? 0,
        lifestyle: d.lifestyle?.length ?? 0,
      },
    };
  } catch (err) {
    return {
      ok: false,
      imported: { periods: 0, bbt: 0, weight: 0, symptoms: 0, notes: 0, pills: 0, lifestyle: 0 },
      error: err instanceof Error ? err.message : "インポート失敗",
    };
  }
}
