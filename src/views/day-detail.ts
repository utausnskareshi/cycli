/**
 * 日付詳細モーダル
 * - カレンダーの日付タップで表示
 * - その日の予測フェーズ / 記録の有無 / クイック編集ボタン
 */
import { openModal } from "../components/modal";
import { formatJP, type DateStr } from "../utils/date";
import { getPhaseForDate, type CyclePrediction } from "../domain/cycle";
import {
  getBBT,
  getNote,
  getPeriod,
  getSymptoms,
  getWeight,
  getAllPeriodDates,
} from "../db/repository";
import { renderRecordForm } from "./record";

const PHYSICAL_LABEL: Record<string, string> = {
  headache: "頭痛",
  stomachache: "腹痛",
  backache: "腰痛",
  skinIssue: "肌荒れ",
  swelling: "むくみ",
  drowsy: "眠気",
};

const MENTAL_LABEL: Record<string, string> = {
  irritated: "イライラ",
  depressed: "落ち込み",
  anxious: "不安",
  unmotivated: "やる気が出ない",
};

const PHASE_TEXT: Record<string, string> = {
  period: "生理中",
  periodPredicted: "生理予定日",
  fertile: "受孕期",
  ovulation: "排卵日",
  pms: "PMS警戒期",
  follicular: "卵胞期（痩せ期）",
  luteal: "黄体期（溜め込み期）",
  none: "—",
};

export async function openDayDetailModal(
  date: DateStr,
  prediction: CyclePrediction,
  onChanged: () => void,
): Promise<void> {
  const periodDates = await getAllPeriodDates();
  const phase = getPhaseForDate(date, periodDates, prediction);

  const [period, bbt, weight, symptoms, note] = await Promise.all([
    getPeriod(date),
    getBBT(date),
    getWeight(date),
    getSymptoms(date),
    getNote(date),
  ]);

  const content = document.createElement("div");
  content.innerHTML = `
    <div class="muted sub" style="margin-bottom:8px;">${formatJP(date)}</div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
      ${
        phase.primary !== "none"
          ? `<span class="chip selected">${PHASE_TEXT[phase.primary] ?? ""}</span>`
          : ""
      }
      ${
        phase.secondary !== "none"
          ? `<span class="chip">${PHASE_TEXT[phase.secondary] ?? ""}</span>`
          : ""
      }
      ${phase.cycleDay !== null ? `<span class="chip">周期${phase.cycleDay}日目</span>` : ""}
    </div>

    <div class="app-card" style="margin-bottom:12px;">
      <h2>記録</h2>
      <div class="muted sub" style="display:grid; gap:6px; margin-top:8px;">
        <div>🩸 生理：${period ? `経血Lv${period.flow} / 痛みLv${period.pain}${period.medication ? " / 薬服用" : ""}` : "—"}</div>
        <div>🌡 基礎体温：${bbt ? `${bbt.value.toFixed(2)} ℃` : "—"}</div>
        <div>⚖️ 体重：${weight ? `${weight.value.toFixed(1)} kg` : "—"}</div>
        <div>💢 身体症状：${
          symptoms && symptoms.physical.length > 0
            ? symptoms.physical.map((s) => PHYSICAL_LABEL[s] ?? s).join("・")
            : "—"
        }</div>
        <div>💭 気分：${
          symptoms && symptoms.mental.length > 0
            ? symptoms.mental.map((s) => MENTAL_LABEL[s] ?? s).join("・")
            : "—"
        }</div>
        <div>📝 メモ：${note !== null && note !== "" ? escapeHtml(note) : "—"}</div>
      </div>
    </div>

    <button class="btn btn-primary btn-block" id="edit-btn">この日の記録を編集</button>
  `;

  const close = openModal({ title: "日付詳細", content });

  content.querySelector("#edit-btn")?.addEventListener("click", async () => {
    close();
    // 記録フォームをモーダルで開く
    const form = await renderRecordForm(date, () => {
      onChanged();
    });
    openModal({ title: `${formatJP(date)} の記録`, content: form });
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
