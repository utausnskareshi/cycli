/**
 * 日付ユーティリティ
 * - すべて「YYYY-MM-DD」形式の文字列で扱う（タイムゾーンの混乱を避けるため）
 * - 内部計算は Date オブジェクトで行うが、保存・比較は文字列ベース
 */

/** YYYY-MM-DD 形式の日付文字列 */
export type DateStr = string;

/** Date → YYYY-MM-DD（ローカルタイム基準） */
export function toDateStr(d: Date): DateStr {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** YYYY-MM-DD → Date（ローカルタイム0時） */
export function fromDateStr(s: DateStr): Date {
  const [yStr, mStr, dStr] = s.split("-");
  const y = Number(yStr ?? 0);
  const m = Number(mStr ?? 1);
  const d = Number(dStr ?? 1);
  return new Date(y, m - 1, d);
}

/** 今日の日付文字列 */
export function today(): DateStr {
  return toDateStr(new Date());
}

/** 日付に n 日を加算 */
export function addDays(s: DateStr, n: number): DateStr {
  const d = fromDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** 2日付の差分（日数）: b - a */
export function diffDays(a: DateStr, b: DateStr): number {
  const da = fromDateStr(a).getTime();
  const db = fromDateStr(b).getTime();
  return Math.round((db - da) / 86400000);
}

/** 範囲チェック (inclusive) */
export function isBetween(target: DateStr, from: DateStr, to: DateStr): boolean {
  return target >= from && target <= to;
}

/** 月初の日付 */
export function startOfMonth(year: number, month0: number): Date {
  return new Date(year, month0, 1);
}

/** 月の日数 */
export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** 日付の曜日（0=日 〜 6=土） */
export function weekday(s: DateStr): number {
  return fromDateStr(s).getDay();
}

/** 表示用: yyyy年m月d日 */
export function formatJP(s: DateStr): string {
  const d = fromDateStr(s);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 表示用: yyyy年m月 */
export function formatJPMonth(year: number, month0: number): string {
  return `${year}年${month0 + 1}月`;
}
