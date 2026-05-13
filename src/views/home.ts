/**
 * ホーム画面
 * - 「次の生理まで○日」サマリー
 * - 今日のフェーズとアドバイス
 * - ワンタップ記録ショートカット
 * - モード別の追加情報（妊活/妊娠中/ジュニア）
 * - ピル服薬リマインド
 */
import {
  getAllPeriodDates,
  getPeriodStartDates,
  markPeriodStartToday,
} from "../db/repository";
import { predictFromStartDates, getPhaseForDate, type CyclePhase } from "../domain/cycle";
import { getAdviceForPhase } from "../domain/diet-advice";
import { calcPregnancy, pregnancyTip } from "../domain/pregnancy";
import { getSettings } from "../db/schema";
import { today, diffDays, formatJP } from "../utils/date";
import { showToast } from "../components/toast";
import { navigate } from "../router";
import { shouldShowPillReminder, getPillScheduleText } from "./pill";

const PHASE_LABELS: Record<CyclePhase, { label: string; color: string }> = {
  period: { label: "生理中", color: "var(--color-period)" },
  periodPredicted: { label: "次回生理予定", color: "var(--color-period)" },
  fertile: { label: "受孕期", color: "var(--color-fertile)" },
  ovulation: { label: "排卵日", color: "var(--color-ovulation)" },
  pms: { label: "PMS警戒期", color: "var(--color-pms)" },
  follicular: { label: "卵胞期（痩せ期）", color: "var(--color-diet-loss)" },
  luteal: { label: "黄体期（溜め込み期）", color: "var(--color-diet-gain)" },
  none: { label: "通常期", color: "var(--color-text-sub)" },
};

export async function renderHome(): Promise<HTMLElement> {
  const container = document.createElement("div");

  const startDates = await getPeriodStartDates();
  const periodDates = await getAllPeriodDates();
  const prediction = predictFromStartDates(startDates);

  const t = today();
  const phase = getPhaseForDate(t, periodDates, prediction);
  const advice = getAdviceForPhase(
    phase.primary === "none" ? phase.secondary : phase.primary,
  );

  // 次回生理まで何日
  let daysUntil: number | null = null;
  if (prediction.nextPeriodStart !== null) {
    daysUntil = diffDays(t, prediction.nextPeriodStart);
  }

  // 今日のフェーズ表示
  const phaseInfo =
    phase.primary !== "none"
      ? PHASE_LABELS[phase.primary]
      : phase.secondary !== "none"
        ? PHASE_LABELS[phase.secondary]
        : PHASE_LABELS.none;

  // 記録がまだ無い場合
  if (startDates.length === 0) {
    container.innerHTML = `
      <div class="app-card text-center" style="background: linear-gradient(135deg, #FDE4EE 0%, #ECDCF0 100%);">
        <div class="emoji" style="font-size:48px;">🌸</div>
        <h2 style="margin-bottom: 8px;">Cycli へようこそ</h2>
        <p class="muted sub" style="margin-bottom: 16px;">
          まずは前回の生理開始日を記録しましょう。<br>
          数周期分の記録があると予測精度が上がります。
        </p>
        <button class="btn btn-primary" id="quick-mark">今日から生理が始まりました</button>
      </div>
      <div class="app-card">
        <h2>使い方のヒント</h2>
        <ul class="muted sub" style="padding-left:18px; line-height:1.8;">
          <li>毎日かんたんに体調・気分を記録</li>
          <li>基礎体温や体重を入力すると自動でグラフに</li>
          <li>カレンダーで次回生理・排卵日・PMS期が一目でわかります</li>
        </ul>
      </div>
    `;
    container.querySelector("#quick-mark")?.addEventListener("click", async () => {
      await markPeriodStartToday(t);
      showToast("記録しました。来月の予測ができるようになります🌷");
      // 画面を再描画したい→簡易にreload相当
      navigate("home");
      window.dispatchEvent(new Event("cycli:rerender"));
    });
    return container;
  }

  const cycleDayText =
    phase.cycleDay !== null ? `周期 ${phase.cycleDay} 日目` : "";

  // モード・リマインド情報
  const settings = await getSettings();
  const showPillReminder = await shouldShowPillReminder();

  // ===== 予定日リマインド（生理予定日が数日以内） =====
  let reminderHtml = "";
  if (daysUntil !== null && daysUntil >= 0 && daysUntil <= settings.reminderDaysBefore) {
    reminderHtml = `
      <div class="app-card" style="background: var(--color-pms-soft); border-color: var(--color-pms);">
        <div style="display:flex; gap:8px; align-items:center;">
          <span style="font-size:24px;">🔔</span>
          <div>
            <strong>もうすぐ生理予定日です</strong>
            <p class="muted sub" style="margin:4px 0 0;">あと${daysUntil}日。準備しておきましょう。</p>
          </div>
        </div>
      </div>
    `;
  }

  // ===== ピルリマインド =====
  let pillReminderHtml = "";
  if (showPillReminder) {
    pillReminderHtml = `
      <div class="app-card" style="background: var(--color-fertile-soft); border-color: var(--color-fertile);">
        <div style="display:flex; gap:8px; align-items:center;">
          <span style="font-size:24px;">💊</span>
          <div style="flex:1;">
            <strong>ピルの服薬時刻です</strong>
            <p class="muted sub" style="margin:4px 0 0;">予定時刻：${getPillScheduleText()}</p>
          </div>
          <button class="btn btn-primary" id="goto-pill">記録</button>
        </div>
      </div>
    `;
  }

  // ===== モード別の特別カード =====
  let modeSpecificHtml = "";
  if (settings.mode === "fertility") {
    const fertileText =
      prediction.fertileStart !== null && prediction.fertileEnd !== null
        ? `${formatJP(prediction.fertileStart)} 〜 ${formatJP(prediction.fertileEnd)}`
        : "—";
    modeSpecificHtml = `
      <div class="app-card" style="background: var(--color-fertile-soft); border-color: var(--color-fertile);">
        <h2>🌱 妊活モード</h2>
        <div class="muted sub" style="margin-bottom: 6px;">次の受孕期</div>
        <div style="font-weight:600;">${fertileText}</div>
        <p class="muted sub mt-2">
          排卵予定日：${prediction.nextOvulation !== null ? formatJP(prediction.nextOvulation) : "—"}
        </p>
      </div>
    `;
  } else if (settings.mode === "pregnant") {
    // 最後の生理開始日を妊娠開始日として扱う
    if (prediction.lastPeriodStart !== null) {
      const pregnancy = calcPregnancy(prediction.lastPeriodStart, t);
      modeSpecificHtml = `
        <div class="app-card" style="background: var(--color-primary-soft); border-color: var(--color-primary);">
          <h2>👶 妊娠中モード</h2>
          <div class="big-number" style="font-size:32px; margin: 8px 0;">
            ${pregnancy.weeks}<span class="unit">週</span>${pregnancy.days}<span class="unit">日</span>
          </div>
          <div class="muted sub">
            出産予定日：${formatJP(pregnancy.edd)}
            （あと${Math.max(0, pregnancy.daysUntilEdd)}日）
          </div>
          <p class="muted sub mt-2">${pregnancyTip(pregnancy.weeks)}</p>
        </div>
      `;
    }
  } else if (settings.mode === "junior") {
    modeSpecificHtml = `
      <div class="app-card" style="background: var(--color-diet-loss-soft); border-color: var(--color-diet-loss);">
        <h2>🌷 ジュニアモード</h2>
        <p class="muted sub">
          初経・周期がまだ安定しない時期は、変動が大きいのが普通です。
          記録を続けることで自分のリズムが見えてきます。
        </p>
        <ul class="muted sub mt-2" style="padding-left:18px; line-height:1.8;">
          <li>初経から2〜3年は周期が不規則でも心配しすぎないで</li>
          <li>強い痛みや出血が続くときは保護者・婦人科に相談を</li>
        </ul>
      </div>
    `;
  }

  container.innerHTML = `
    ${reminderHtml}
    ${pillReminderHtml}
    ${modeSpecificHtml}
    <div class="app-card text-center" style="background: linear-gradient(135deg, #FDE4EE 0%, #ECDCF0 100%);">
      <div class="muted sub">次の生理予定日まで</div>
      <div class="big-number" style="margin-top:8px;">
        ${daysUntil !== null ? (daysUntil >= 0 ? daysUntil : 0) : "?"}<span class="unit">日</span>
      </div>
      <div class="muted sub mt-2">
        ${prediction.nextPeriodStart !== null ? `予定日：${formatJP(prediction.nextPeriodStart)}` : ""}
      </div>
      <div class="mt-4" style="display:inline-flex; align-items:center; gap:8px; padding:6px 16px; background:#fff; border-radius:9999px; box-shadow: var(--shadow-sm);">
        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${phaseInfo.color};"></span>
        <span style="color: var(--color-text); font-weight:600;">${phaseInfo.label}</span>
        ${cycleDayText !== "" ? `<span class="muted sub">/ ${cycleDayText}</span>` : ""}
      </div>
    </div>

    <div class="app-card">
      <h2>今日のアドバイス</h2>
      <div style="font-weight:600; margin-bottom:6px;">${advice.title}</div>
      <p class="muted sub" style="margin: 0 0 12px;">${advice.description}</p>
      <ul class="muted sub" style="padding-left:18px; line-height:1.8; margin:0;">
        ${advice.tips.map((tip) => `<li>${tip}</li>`).join("")}
      </ul>
    </div>

    <div class="app-card">
      <h2>クイック記録</h2>
      <div class="flex gap-2" style="flex-wrap:wrap;">
        <button class="btn btn-primary" id="quick-period">🩸 生理がきた</button>
        <button class="btn btn-secondary" id="quick-record">📝 今日の体調を記録</button>
      </div>
    </div>

    <div class="app-card">
      <h2>周期の傾向</h2>
      <div class="stat-grid">
        <div class="stat-tile">
          <div class="label">平均周期</div>
          <div class="value">${prediction.estimatedCycleLength}<span class="unit">日</span></div>
        </div>
        <div class="stat-tile">
          <div class="label">周期安定度</div>
          <div class="value">${prediction.stabilityScore}<span class="unit">点</span></div>
        </div>
        <div class="stat-tile">
          <div class="label">記録した周期</div>
          <div class="value">${startDates.length}<span class="unit">回</span></div>
        </div>
        <div class="stat-tile">
          <div class="label">排卵予定日</div>
          <div class="value" style="font-size:18px;">${prediction.nextOvulation !== null ? formatJP(prediction.nextOvulation).replace(/^\d{4}年/, "") : "—"}</div>
        </div>
      </div>
    </div>
  `;

  container.querySelector("#quick-period")?.addEventListener("click", async () => {
    await markPeriodStartToday(t);
    showToast("今日から生理開始として記録しました");
    window.dispatchEvent(new Event("cycli:rerender"));
  });
  container.querySelector("#quick-record")?.addEventListener("click", () => {
    navigate("record");
  });
  container.querySelector("#goto-pill")?.addEventListener("click", () => {
    navigate("pill");
  });

  return container;
}
