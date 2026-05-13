/**
 * 周期予測ロジック
 *
 * 用語:
 *  - 周期開始日: 生理初日
 *  - 周期長 (cycleLength): 開始日から次の開始日までの日数（平均28日）
 *  - 生理期間 (periodLength): 経血が見られる日数（平均5日）
 *  - 排卵日 (ovulationDay): 次回開始日の14日前（黄体期は比較的固定14日とされる）
 *  - 受孕期 (fertile window): 排卵日の前5日 〜 排卵日の翌1日（妊娠可能性が高い期間）
 *  - PMS警戒期: 生理予定日の7日前 〜 1日前
 *  - 卵胞期（痩せ期）: 生理開始 〜 排卵日前後（エストロゲン優位、代謝高め）
 *  - 黄体期（溜め込み期）: 排卵後 〜 次の生理前（プロゲステロン優位、水分溜め込み）
 */
import { addDays, diffDays, isBetween, type DateStr } from "../utils/date";

export interface CyclePrediction {
  /** 過去の周期長の履歴 */
  cycleHistory: number[];
  /** 推定周期長（中央値ベース） */
  estimatedCycleLength: number;
  /** 推定生理期間 */
  estimatedPeriodLength: number;
  /** 直近の生理開始日 */
  lastPeriodStart: DateStr | null;
  /** 次回生理予定日 */
  nextPeriodStart: DateStr | null;
  /** 次回生理予定終了日 */
  nextPeriodEnd: DateStr | null;
  /** 次回排卵予定日 */
  nextOvulation: DateStr | null;
  /** 受孕期（開始） */
  fertileStart: DateStr | null;
  /** 受孕期（終了） */
  fertileEnd: DateStr | null;
  /** PMS警戒期（開始） */
  pmsStart: DateStr | null;
  /** PMS警戒期（終了） */
  pmsEnd: DateStr | null;
  /** 痩せ期（卵胞期） */
  followicularStart: DateStr | null;
  followicularEnd: DateStr | null;
  /** 溜め込み期（黄体期） */
  lutealStart: DateStr | null;
  lutealEnd: DateStr | null;
  /** 周期安定度スコア(0-100) — 履歴のばらつきから算出 */
  stabilityScore: number;
}

export interface CycleConfig {
  /** デフォルト周期長（記録がない場合） */
  defaultCycleLength: number;
  /** デフォルト生理期間 */
  defaultPeriodLength: number;
}

const DEFAULT_CONFIG: CycleConfig = {
  defaultCycleLength: 28,
  defaultPeriodLength: 5,
};

/** 数値配列の中央値 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** 標準偏差 */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * 生理開始日のリスト（昇順）から予測を生成
 * - startDates: 各周期の「開始日」だけのリスト
 */
export function predictFromStartDates(
  startDates: DateStr[],
  config: Partial<CycleConfig> = {},
): CyclePrediction {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const sorted = [...startDates].sort();

  // 周期長の履歴
  const cycleHistory: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev === undefined || curr === undefined) continue;
    const days = diffDays(prev, curr);
    // 異常値除去（10日未満 or 90日超は異常とみなして除外）
    if (days >= 10 && days <= 90) {
      cycleHistory.push(days);
    }
  }

  const estimatedCycleLength =
    cycleHistory.length === 0
      ? cfg.defaultCycleLength
      : Math.round(median(cycleHistory));

  const estimatedPeriodLength = cfg.defaultPeriodLength;

  const lastPeriodStart = sorted.length > 0 ? (sorted[sorted.length - 1] ?? null) : null;

  // 次回予定日
  let nextPeriodStart: DateStr | null = null;
  let nextPeriodEnd: DateStr | null = null;
  let nextOvulation: DateStr | null = null;
  let fertileStart: DateStr | null = null;
  let fertileEnd: DateStr | null = null;
  let pmsStart: DateStr | null = null;
  let pmsEnd: DateStr | null = null;
  let follicularStart: DateStr | null = null;
  let follicularEnd: DateStr | null = null;
  let lutealStart: DateStr | null = null;
  let lutealEnd: DateStr | null = null;

  if (lastPeriodStart !== null) {
    nextPeriodStart = addDays(lastPeriodStart, estimatedCycleLength);
    nextPeriodEnd = addDays(nextPeriodStart, estimatedPeriodLength - 1);
    // 排卵日: 次回開始 - 14日
    nextOvulation = addDays(nextPeriodStart, -14);
    fertileStart = addDays(nextOvulation, -5);
    fertileEnd = addDays(nextOvulation, 1);
    pmsStart = addDays(nextPeriodStart, -7);
    pmsEnd = addDays(nextPeriodStart, -1);
    // 卵胞期: 直近の生理開始 〜 排卵前日
    follicularStart = lastPeriodStart;
    follicularEnd = addDays(nextOvulation, -1);
    // 黄体期: 排卵日翌日 〜 次回生理前日
    lutealStart = addDays(nextOvulation, 1);
    lutealEnd = addDays(nextPeriodStart, -1);
  }

  // 周期安定度: 標準偏差が小さいほど高得点
  const stabilityScore = (() => {
    if (cycleHistory.length < 2) return 50;
    const sd = stddev(cycleHistory);
    // sd=0 → 100点, sd>=7 → 0点 のように線形マッピング
    const score = Math.max(0, Math.min(100, Math.round(100 - sd * 14)));
    return score;
  })();

  return {
    cycleHistory,
    estimatedCycleLength,
    estimatedPeriodLength,
    lastPeriodStart,
    nextPeriodStart,
    nextPeriodEnd,
    nextOvulation,
    fertileStart,
    fertileEnd,
    pmsStart,
    pmsEnd,
    followicularStart: follicularStart,
    followicularEnd: follicularEnd,
    lutealStart,
    lutealEnd,
    stabilityScore,
  };
}

/** ある日付がどのフェーズに該当するかを判定 */
export type CyclePhase =
  | "period" // 生理中
  | "periodPredicted" // 次回予定の生理日
  | "fertile" // 受孕期
  | "ovulation" // 排卵日
  | "pms" // PMS警戒期
  | "follicular" // 卵胞期（痩せ期）
  | "luteal" // 黄体期（溜め込み期）
  | "none";

export interface PhaseInfo {
  primary: CyclePhase;
  secondary: CyclePhase; // 痩せ期/溜め込み期は同時に成立しうる
  /** 周期内の何日目か（1始まり、計算不能ならnull） */
  cycleDay: number | null;
}

/**
 * 指定日のフェーズを判定（過去の生理記録と予測を使用）
 * - actualPeriodDates: 実際に生理だった日（範囲塗り用）
 */
export function getPhaseForDate(
  target: DateStr,
  actualPeriodDates: Set<DateStr>,
  prediction: CyclePrediction,
): PhaseInfo {
  let primary: CyclePhase = "none";
  let secondary: CyclePhase = "none";

  // 実際の生理日
  if (actualPeriodDates.has(target)) {
    primary = "period";
  }
  // 次回生理予定（実記録より優先しない）
  else if (
    prediction.nextPeriodStart !== null &&
    prediction.nextPeriodEnd !== null &&
    isBetween(target, prediction.nextPeriodStart, prediction.nextPeriodEnd)
  ) {
    primary = "periodPredicted";
  }
  // 排卵日
  else if (target === prediction.nextOvulation) {
    primary = "ovulation";
  }
  // 受孕期
  else if (
    prediction.fertileStart !== null &&
    prediction.fertileEnd !== null &&
    isBetween(target, prediction.fertileStart, prediction.fertileEnd)
  ) {
    primary = "fertile";
  }
  // PMS警戒期
  else if (
    prediction.pmsStart !== null &&
    prediction.pmsEnd !== null &&
    isBetween(target, prediction.pmsStart, prediction.pmsEnd)
  ) {
    primary = "pms";
  }

  // 卵胞期/黄体期は背景的に重ね合わせる
  if (
    prediction.followicularStart !== null &&
    prediction.followicularEnd !== null &&
    isBetween(target, prediction.followicularStart, prediction.followicularEnd)
  ) {
    secondary = "follicular";
  } else if (
    prediction.lutealStart !== null &&
    prediction.lutealEnd !== null &&
    isBetween(target, prediction.lutealStart, prediction.lutealEnd)
  ) {
    secondary = "luteal";
  }

  // 周期日数
  let cycleDay: number | null = null;
  if (prediction.lastPeriodStart !== null) {
    const d = diffDays(prediction.lastPeriodStart, target);
    if (d >= 0 && d < prediction.estimatedCycleLength * 2) {
      cycleDay = d + 1;
    }
  }

  return { primary, secondary, cycleDay };
}
