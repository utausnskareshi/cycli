/**
 * 妊娠モード用ロジック
 * - 最終月経日（LMP: Last Menstrual Period）から出産予定日を計算
 * - ネーゲレ概算法: LMP + 280日（妊娠40週）
 * - 妊娠週数: 経過日数 / 7
 */
import { addDays, diffDays, type DateStr } from "../utils/date";

export interface PregnancyInfo {
  lmp: DateStr;
  edd: DateStr; // 出産予定日
  weeks: number; // 妊娠週数 (0始まり)
  days: number; // 週内の日数 (0-6)
  daysUntilEdd: number; // 出産予定日まで何日
  trimester: 1 | 2 | 3; // 妊娠初期/中期/後期
}

/**
 * 最終月経開始日から妊娠情報を計算
 * - today: 今日の日付（テスタビリティのため引数化）
 */
export function calcPregnancy(lmp: DateStr, today: DateStr): PregnancyInfo {
  const edd = addDays(lmp, 280);
  const elapsed = diffDays(lmp, today);
  const weeks = Math.floor(elapsed / 7);
  const days = elapsed % 7;
  const daysUntilEdd = diffDays(today, edd);
  // 1-13週=初期、14-27=中期、28-=後期
  let trimester: 1 | 2 | 3 = 1;
  if (weeks >= 28) trimester = 3;
  else if (weeks >= 14) trimester = 2;
  return { lmp, edd, weeks, days, daysUntilEdd, trimester };
}

/** 妊娠週ごとの一言メッセージ */
export function pregnancyTip(weeks: number): string {
  if (weeks < 4) return "妊娠が分かったばかり。アルコール・喫煙は控えましょう。";
  if (weeks < 12) return "つわりが出やすい時期。無理せず休んで。";
  if (weeks < 20) return "安定期に入ります。体調に合わせて軽い運動を。";
  if (weeks < 28) return "おなかが目立ち始める頃。マタニティウェアの準備を。";
  if (weeks < 36) return "後期に突入。むくみ・腰痛対策を意識して。";
  if (weeks < 40) return "いつ陣痛がきても大丈夫なように準備を。";
  return "出産予定日を過ぎています。医師に相談しましょう。";
}
