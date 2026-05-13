/**
 * フェーズに応じたダイエット・体調アドバイス
 *
 * - 卵胞期（生理〜排卵）: エストロゲン優位、代謝高め、痩せやすい
 * - 排卵期: ホルモン切り替わり、肌調子◎
 * - 黄体期（排卵後〜次回生理）: プロゲステロン優位、水分・脂肪を溜め込む
 * - 月経期: 鉄分補給を意識
 */
import type { CyclePhase } from "./cycle";

export interface PhaseAdvice {
  title: string;
  description: string;
  tips: string[];
}

export function getAdviceForPhase(phase: CyclePhase | "follicular" | "luteal"): PhaseAdvice {
  switch (phase) {
    case "period":
      return {
        title: "月経期（鉄分補給）",
        description:
          "経血で鉄分を消費しやすい時期。無理せず体を休めて、ゆったり過ごしましょう。",
        tips: [
          "鉄分（赤身肉・レバー・ほうれん草・ひじき）を意識的に摂る",
          "ビタミンCを一緒に摂ると鉄の吸収が上がる",
          "激しい運動はお休み、ストレッチや軽い散歩程度に",
          "湯船で体を温めて巡りを良くする",
        ],
      };
    case "follicular":
      return {
        title: "卵胞期（痩せやすい時期）✨",
        description:
          "エストロゲンが優位で代謝が上がり、心身ともにアクティブに動きやすい時期。新しい習慣を始めるのにも◎。",
        tips: [
          "有酸素運動・筋トレなど運動効果が出やすい",
          "糖質と脂質をコントロールしてダイエット成果を狙う",
          "新しいことに挑戦しやすいタイミング",
          "肌の調子も良くなりやすい時期",
        ],
      };
    case "ovulation":
    case "fertile":
      return {
        title: "排卵期（バランス重視）",
        description:
          "ホルモンが切り替わるタイミング。コンディションは良好ですが、急に疲れることも。",
        tips: [
          "タンパク質をしっかり、バランス重視の食事を",
          "水分を多めに、デトックスを意識",
          "妊活モードの方はゴールデンタイム",
        ],
      };
    case "pms":
    case "luteal":
      return {
        title: "黄体期（溜め込み期）⚠️",
        description:
          "プロゲステロン優位で、水分・脂肪を溜め込みやすく、食欲も増えがちな時期。無理しすぎないで。",
        tips: [
          "甘いもの・しょっぱいものへの欲求が増えても自分を責めない",
          "塩分控えめにしてむくみ対策",
          "豆腐・ナッツ・大豆製品（マグネシウム）でPMS緩和",
          "ヨガ・ストレッチ・ウォーキングなど穏やかな運動を",
          "睡眠を多めにとる",
        ],
      };
    default:
      return {
        title: "通常期",
        description: "今日も穏やかに過ごしましょう。",
        tips: [
          "体調の変化を記録しておくと、後で振り返りやすいです",
        ],
      };
  }
}
