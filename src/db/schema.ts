/**
 * Dexie（IndexedDB）スキーマ定義
 *
 * - 主キー: 日付文字列（YYYY-MM-DD）
 * - センシティブな値は暗号化された文字列フィールドとして保存
 *   暗号化が無効なら平文の文字列が入る
 * - 検索やソートに必要なメタは平文のままにする（日付など）
 */
import Dexie, { type Table } from "dexie";
import type { DateStr } from "../utils/date";

/** 経血量 0=なし, 1=少量, 2=普通, 3=多量, 4=非常に多量 */
export type FlowLevel = 0 | 1 | 2 | 3 | 4;

/** 痛みレベル 0=なし 〜 5=激痛 */
export type PainLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** ライフモード */
export type LifeMode = "menstrual" | "fertility" | "pregnant" | "junior";

/** 周期記録（生理） */
export interface PeriodRecord {
  /** YYYY-MM-DD: 生理開始日（同一周期内の各日は別エントリ） */
  date: DateStr;
  /** 開始日マーカー */
  isStart: boolean;
  /** 経血量 */
  flow: FlowLevel;
  /** 痛みレベル */
  pain: PainLevel;
  /** 薬を服用した */
  medication: boolean;
  /** 暗号化されたメモ */
  noteEncrypted?: string;
  /** 更新日時 */
  updatedAt: number;
}

/** 基礎体温 */
export interface BBTRecord {
  date: DateStr;
  /** 摂氏（小数2桁） */
  value: number;
  updatedAt: number;
}

/** 体重 */
export interface WeightRecord {
  date: DateStr;
  /** kg（小数1桁） */
  value: number;
  updatedAt: number;
}

/** 身体症状 */
export type PhysicalSymptom =
  | "headache" // 頭痛
  | "stomachache" // 腹痛
  | "backache" // 腰痛
  | "skinIssue" // 肌荒れ
  | "swelling" // むくみ
  | "drowsy"; // 眠気

/** 心の状態 */
export type MentalSymptom =
  | "irritated" // イライラ
  | "depressed" // 落ち込み
  | "anxious" // 不安
  | "unmotivated"; // やる気が出ない

export interface SymptomRecord {
  date: DateStr;
  physical: PhysicalSymptom[];
  mental: MentalSymptom[];
  updatedAt: number;
}

/** メモ（暗号化対象） */
export interface NoteRecord {
  date: DateStr;
  /** 暗号化された自由メモ */
  textEncrypted: string;
  updatedAt: number;
}

/** ピル服薬記録 */
export interface PillRecord {
  date: DateStr;
  taken: boolean;
  takenAt?: number; // unix ms
  updatedAt: number;
}

/** ライフスタイルログ（任意） */
export interface LifestyleRecord {
  date: DateStr;
  /** 睡眠時間（時間, 小数1桁） */
  sleepHours?: number;
  /** 水分摂取量（コップ数） */
  water?: number;
  /** 運動した分数 */
  exerciseMinutes?: number;
  /** おりもの観察（none/sticky/creamy/watery/eggwhite） */
  cervicalMucus?: "none" | "sticky" | "creamy" | "watery" | "eggwhite";
  /** 性交記録（妊活モード時に表示） */
  intercourse?: boolean;
  updatedAt: number;
}

/** 設定（単一行） */
export interface Settings {
  id: "default";
  /** 平均周期長（日） */
  cycleLength: number;
  /** 平均生理期間（日） */
  periodLength: number;
  /** ライフモード */
  mode: LifeMode;
  /** 通知ON/OFF */
  notificationsEnabled: boolean;
  /** 何日前にリマインドするか */
  reminderDaysBefore: number;
  /** 暗号化フラグ（実際の判定は localStorage 側） */
  encryptionInfo?: string;
  updatedAt: number;
}

class CycliDB extends Dexie {
  periods!: Table<PeriodRecord, DateStr>;
  bbt!: Table<BBTRecord, DateStr>;
  weight!: Table<WeightRecord, DateStr>;
  symptoms!: Table<SymptomRecord, DateStr>;
  notes!: Table<NoteRecord, DateStr>;
  pills!: Table<PillRecord, DateStr>;
  lifestyle!: Table<LifestyleRecord, DateStr>;
  settings!: Table<Settings, "default">;

  constructor() {
    super("cycli");
    // Why: IndexedDBのキーとして boolean は使えないため、
    //      isStart はインデックス化せずアプリ側で filter する
    this.version(2).stores({
      periods: "date, updatedAt",
      bbt: "date, updatedAt",
      weight: "date, updatedAt",
      symptoms: "date, updatedAt",
      notes: "date, updatedAt",
      pills: "date, updatedAt",
      settings: "id",
    });
    // v3: ライフスタイルログテーブル追加
    this.version(3).stores({
      lifestyle: "date, updatedAt",
    });
  }
}

export const db = new CycliDB();

/** 既定設定の取得（無ければ初期値で作成） */
export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get("default");
  if (existing) return existing;
  const defaults: Settings = {
    id: "default",
    cycleLength: 28,
    periodLength: 5,
    mode: "menstrual",
    notificationsEnabled: false,
    reminderDaysBefore: 2,
    updatedAt: Date.now(),
  };
  await db.settings.put(defaults);
  return defaults;
}

/** 設定の部分更新 */
export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, updatedAt: Date.now() });
}
