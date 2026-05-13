/**
 * カレンダー画面
 * - ①次回の生理予定日（色＋斜線）
 * - ②妊娠可能性の高い時期（受孕期 + 排卵日）
 * - ③PMS警戒期
 * - ④痩せ期／溜め込み期（下部バーで表示）
 *
 * 日付をタップすると、その日の詳細モーダルを開く
 */
import {
  getAllPeriodDates,
  getPeriodStartDates,
  getRecordedDatesInMonth,
} from "../db/repository";
import {
  getPhaseForDate,
  predictFromStartDates,
  type CyclePrediction,
} from "../domain/cycle";
import {
  daysInMonth,
  fromDateStr,
  startOfMonth,
  toDateStr,
  today,
  formatJPMonth,
  type DateStr,
} from "../utils/date";
import { openDayDetailModal } from "./day-detail";

interface CalendarState {
  year: number;
  month0: number;
  prediction: CyclePrediction;
  periodDates: Set<DateStr>;
  recordedDates: Set<DateStr>;
}

export async function renderCalendar(): Promise<HTMLElement> {
  const container = document.createElement("div");

  const t = today();
  const tDate = fromDateStr(t);
  const state: CalendarState = {
    year: tDate.getFullYear(),
    month0: tDate.getMonth(),
    prediction: predictFromStartDates(await getPeriodStartDates()),
    periodDates: await getAllPeriodDates(),
    recordedDates: await getRecordedDatesInMonth(tDate.getFullYear(), tDate.getMonth()),
  };

  container.innerHTML = `
    <div class="calendar">
      <div class="calendar-header">
        <button id="prev-month" aria-label="前の月">‹</button>
        <div class="calendar-title" id="cal-title"></div>
        <button id="next-month" aria-label="次の月">›</button>
      </div>
      <div class="calendar-weekdays">
        <div>日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div>土</div>
      </div>
      <div class="calendar-grid" id="cal-grid"></div>
      <div class="calendar-legend">
        <span class="legend-item"><span class="legend-swatch" style="background: var(--color-period-soft);"></span>生理</span>
        <span class="legend-item"><span class="legend-swatch" style="background: var(--color-period-soft); background-image: repeating-linear-gradient(45deg, var(--color-period-soft), var(--color-period-soft) 3px, transparent 3px, transparent 6px);"></span>生理予定</span>
        <span class="legend-item"><span class="legend-swatch" style="background: var(--color-ovulation-soft);"></span>排卵</span>
        <span class="legend-item"><span class="legend-swatch" style="background: var(--color-fertile-soft);"></span>受孕期</span>
        <span class="legend-item"><span class="legend-swatch" style="background: var(--color-pms-soft);"></span>PMS</span>
        <span class="legend-item"><span class="legend-swatch" style="background: var(--color-diet-loss);"></span>痩せ期</span>
        <span class="legend-item"><span class="legend-swatch" style="background: var(--color-diet-gain);"></span>溜め込み期</span>
        <span class="legend-item"><span class="legend-swatch" style="background: var(--color-accent-strong); border-radius:50%;"></span>記録あり</span>
      </div>
    </div>
  `;

  function refreshTitle(): void {
    const titleEl = container.querySelector("#cal-title") as HTMLElement;
    titleEl.textContent = formatJPMonth(state.year, state.month0);
  }

  function renderGrid(): void {
    const grid = container.querySelector("#cal-grid") as HTMLElement;
    grid.innerHTML = "";

    const first = startOfMonth(state.year, state.month0);
    const firstWeekday = first.getDay();
    const totalDays = daysInMonth(state.year, state.month0);

    // 前月分の空白
    for (let i = 0; i < firstWeekday; i++) {
      const empty = document.createElement("div");
      empty.className = "calendar-day out";
      grid.appendChild(empty);
    }

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(state.year, state.month0, d);
      const dateStr = toDateStr(date);
      const phase = getPhaseForDate(dateStr, state.periodDates, state.prediction);
      const btn = document.createElement("button");
      btn.className = "calendar-day";

      // メインフェーズに応じた背景クラス
      if (phase.primary === "period") btn.classList.add("phase-period");
      else if (phase.primary === "periodPredicted") btn.classList.add("phase-period-predicted");
      else if (phase.primary === "ovulation") btn.classList.add("phase-ovulation");
      else if (phase.primary === "fertile") btn.classList.add("phase-fertile");
      else if (phase.primary === "pms") btn.classList.add("phase-pms");

      // 卵胞期/黄体期は下のバーで表現
      if (phase.secondary === "follicular" || phase.secondary === "luteal") {
        const bar = document.createElement("div");
        bar.className = "phase-bar";
        bar.style.background =
          phase.secondary === "follicular"
            ? "var(--color-diet-loss)"
            : "var(--color-diet-gain)";
        bar.style.opacity = "0.6";
        btn.appendChild(bar);
      }

      btn.appendChild(document.createTextNode(String(d)));

      if (dateStr === today()) btn.classList.add("today");
      if (state.recordedDates.has(dateStr)) btn.classList.add("has-record");

      btn.addEventListener("click", () => {
        openDayDetailModal(dateStr, state.prediction, () => {
          // 詳細モーダルで記録更新後にカレンダー再描画
          void refresh();
        });
      });
      grid.appendChild(btn);
    }
  }

  async function refresh(): Promise<void> {
    state.prediction = predictFromStartDates(await getPeriodStartDates());
    state.periodDates = await getAllPeriodDates();
    state.recordedDates = await getRecordedDatesInMonth(state.year, state.month0);
    refreshTitle();
    renderGrid();
  }

  (container.querySelector("#prev-month") as HTMLElement).addEventListener("click", () => {
    state.month0 -= 1;
    if (state.month0 < 0) {
      state.month0 = 11;
      state.year -= 1;
    }
    void refresh();
  });
  (container.querySelector("#next-month") as HTMLElement).addEventListener("click", () => {
    state.month0 += 1;
    if (state.month0 > 11) {
      state.month0 = 0;
      state.year += 1;
    }
    void refresh();
  });

  refreshTitle();
  renderGrid();
  return container;
}
