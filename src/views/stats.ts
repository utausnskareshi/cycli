/**
 * 統計・グラフ画面
 * - 基礎体温の折れ線グラフ（5日移動平均付き）
 * - 体重推移
 * - 周期長の推移
 */
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  BarController,
  BarElement,
} from "chart.js";
import {
  getAllBBT,
  getAllWeight,
  getPeriodStartDates,
} from "../db/repository";
import { predictFromStartDates } from "../domain/cycle";
import { diffDays } from "../utils/date";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  BarController,
  BarElement,
);

/** 配列の移動平均 */
function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1).filter((v): v is number => v !== null);
    if (slice.length === 0) return null;
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

export async function renderStats(): Promise<HTMLElement> {
  const root = document.createElement("div");
  root.innerHTML = `
    <div class="app-card">
      <h2>📈 周期サマリー</h2>
      <div class="stat-grid" id="cycle-summary"></div>
    </div>
    <div class="app-card">
      <h2>🌡 基礎体温</h2>
      <p class="muted sub">直近30日の推移と5日移動平均。</p>
      <div style="height: 240px; position:relative;">
        <canvas id="bbt-chart"></canvas>
      </div>
    </div>
    <div class="app-card">
      <h2>⚖️ 体重</h2>
      <p class="muted sub">直近30日の推移。</p>
      <div style="height: 240px; position:relative;">
        <canvas id="weight-chart"></canvas>
      </div>
    </div>
    <div class="app-card">
      <h2>🔁 周期長の推移</h2>
      <p class="muted sub">過去の周期長（日数）。安定しているとよいです。</p>
      <div style="height: 220px; position:relative;">
        <canvas id="cycle-chart"></canvas>
      </div>
    </div>
  `;

  // ----- 周期サマリー -----
  const startDates = await getPeriodStartDates();
  const prediction = predictFromStartDates(startDates);
  const cycleSummary = root.querySelector("#cycle-summary") as HTMLElement;
  cycleSummary.innerHTML = `
    <div class="stat-tile">
      <div class="label">記録した周期</div>
      <div class="value">${startDates.length}<span class="unit">回</span></div>
    </div>
    <div class="stat-tile">
      <div class="label">平均周期長</div>
      <div class="value">${prediction.estimatedCycleLength}<span class="unit">日</span></div>
    </div>
    <div class="stat-tile">
      <div class="label">安定度スコア</div>
      <div class="value">${prediction.stabilityScore}<span class="unit">点</span></div>
    </div>
    <div class="stat-tile">
      <div class="label">最短〜最長</div>
      <div class="value" style="font-size:18px;">
        ${prediction.cycleHistory.length > 0 ? `${Math.min(...prediction.cycleHistory)}〜${Math.max(...prediction.cycleHistory)}` : "—"}
        <span class="unit">日</span>
      </div>
    </div>
  `;

  // ----- 基礎体温チャート -----
  const allBBT = await getAllBBT();
  const recent = allBBT.slice(-30);
  const bbtLabels = recent.map((r) => r.date.slice(5));
  const bbtValues = recent.map((r) => r.value);
  const bbtMA = movingAverage(bbtValues, 5);

  const bbtCanvas = root.querySelector("#bbt-chart") as HTMLCanvasElement;
  if (recent.length === 0) {
    bbtCanvas.parentElement!.innerHTML = `<div class="empty-state"><div class="emoji">🌡</div><div>まだ基礎体温の記録がありません</div></div>`;
  } else {
    new Chart(bbtCanvas, {
      type: "line",
      data: {
        labels: bbtLabels,
        datasets: [
          {
            label: "実測",
            data: bbtValues,
            borderColor: "#E57373",
            backgroundColor: "#E5737322",
            tension: 0.3,
            pointRadius: 3,
            fill: true,
          },
          {
            label: "5日移動平均",
            data: bbtMA,
            borderColor: "#CE93D8",
            borderDash: [4, 4],
            pointRadius: 0,
            tension: 0.3,
            fill: false,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        scales: {
          y: { suggestedMin: 35.8, suggestedMax: 37.2 },
        },
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12 } },
        },
      },
    });
  }

  // ----- 体重チャート -----
  const allW = await getAllWeight();
  const wRecent = allW.slice(-30);
  const wCanvas = root.querySelector("#weight-chart") as HTMLCanvasElement;
  if (wRecent.length === 0) {
    wCanvas.parentElement!.innerHTML = `<div class="empty-state"><div class="emoji">⚖️</div><div>まだ体重の記録がありません</div></div>`;
  } else {
    new Chart(wCanvas, {
      type: "line",
      data: {
        labels: wRecent.map((r) => r.date.slice(5)),
        datasets: [
          {
            label: "体重 (kg)",
            data: wRecent.map((r) => r.value),
            borderColor: "#64B5F6",
            backgroundColor: "#64B5F622",
            tension: 0.3,
            pointRadius: 3,
            fill: true,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  // ----- 周期長チャート -----
  const cycleCanvas = root.querySelector("#cycle-chart") as HTMLCanvasElement;
  if (prediction.cycleHistory.length === 0) {
    cycleCanvas.parentElement!.innerHTML = `<div class="empty-state"><div class="emoji">🔁</div><div>周期は2回分以上の記録が必要です</div></div>`;
  } else {
    // 周期番号 1, 2, 3, ...
    const labels = prediction.cycleHistory.map((_, i) => `#${i + 1}`);
    new Chart(cycleCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "周期長 (日)",
            data: prediction.cycleHistory,
            backgroundColor: "#F8BBD0",
            borderColor: "#EC9BBE",
            borderWidth: 1,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        scales: {
          y: { suggestedMin: 20, suggestedMax: 40 },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  // 周期計算のために使った変数を捨てない
  void diffDays;

  return root;
}
