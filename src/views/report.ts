/**
 * 医療機関向けレポート画面
 * - 直近3〜6周期の生理履歴、基礎体温、症状、メモを一覧化
 * - ブラウザの「印刷」機能でPDF保存可能（@media print 対応）
 * - 産婦人科の問診時に画面を見せる/印刷して持参できる
 */
import {
  getAllBBT,
  getAllWeight,
  getPeriodStartDates,
  getNote,
} from "../db/repository";
import { db } from "../db/schema";
import { predictFromStartDates } from "../domain/cycle";
import { diffDays, formatJP, today } from "../utils/date";

export async function renderReport(): Promise<HTMLElement> {
  const root = document.createElement("div");
  const t = today();

  const [startDates, allBBT, allW] = await Promise.all([
    getPeriodStartDates(),
    getAllBBT(),
    getAllWeight(),
  ]);
  const allPeriods = await db.periods.toArray();
  const allSymptoms = await db.symptoms.toArray();
  const prediction = predictFromStartDates(startDates);

  // 周期長履歴を「年月日 - 期間（日）」で表示
  const cycleRows: { start: string; length: number | null }[] = [];
  for (let i = 0; i < startDates.length; i++) {
    const s = startDates[i];
    if (s === undefined) continue;
    const next = startDates[i + 1];
    cycleRows.push({
      start: s,
      length: next !== undefined ? diffDays(s, next) : null,
    });
  }

  // 直近30日の症状サマリー
  const recent30Symptoms = allSymptoms.filter((s) => diffDays(s.date, t) >= 0 && diffDays(s.date, t) <= 30);
  const physCount = new Map<string, number>();
  const mentCount = new Map<string, number>();
  for (const s of recent30Symptoms) {
    for (const p of s.physical) physCount.set(p, (physCount.get(p) ?? 0) + 1);
    for (const m of s.mental) mentCount.set(m, (mentCount.get(m) ?? 0) + 1);
  }

  const physLabel: Record<string, string> = {
    headache: "頭痛",
    stomachache: "腹痛",
    backache: "腰痛",
    skinIssue: "肌荒れ",
    swelling: "むくみ",
    drowsy: "眠気",
  };
  const mentLabel: Record<string, string> = {
    irritated: "イライラ",
    depressed: "落ち込み",
    anxious: "不安",
    unmotivated: "やる気が出ない",
  };

  // メモ（直近30日、復号できなければ「(暗号化)」）
  const recentNoteDates = (await db.notes.toArray())
    .filter((n) => diffDays(n.date, t) >= 0 && diffDays(n.date, t) <= 30)
    .map((n) => n.date)
    .sort();

  const memoEntries: { date: string; text: string }[] = [];
  for (const d of recentNoteDates) {
    const text = await getNote(d);
    if (text !== null) memoEntries.push({ date: d, text });
  }

  // 痛み・経血の代表値
  const flowAvg =
    allPeriods.length > 0
      ? Math.round((allPeriods.reduce((s, p) => s + p.flow, 0) / allPeriods.length) * 10) / 10
      : 0;
  const painAvg =
    allPeriods.length > 0
      ? Math.round((allPeriods.reduce((s, p) => s + p.pain, 0) / allPeriods.length) * 10) / 10
      : 0;

  // 体温・体重サマリー
  const bbtAvg =
    allBBT.length > 0
      ? Math.round((allBBT.reduce((s, b) => s + b.value, 0) / allBBT.length) * 100) / 100
      : 0;
  const weightLatest = allW.length > 0 ? (allW[allW.length - 1]?.value ?? 0) : 0;

  root.innerHTML = `
    <div class="report-page" id="report-page">
      <header class="report-header">
        <h1>Cycli 記録レポート</h1>
        <div class="muted sub">
          出力日：${formatJP(t)}
        </div>
        <div class="muted sub" style="margin-top:4px;">
          ※本レポートは利用者の自己記録です。診断や治療には医師の判断が必要です。
        </div>
      </header>

      <section class="report-section">
        <h2>1. サマリー</h2>
        <table class="report-table">
          <tr><th>記録した周期数</th><td>${startDates.length}回</td></tr>
          <tr><th>推定平均周期長</th><td>${prediction.estimatedCycleLength}日</td></tr>
          <tr><th>周期安定度（自社指標）</th><td>${prediction.stabilityScore}/100</td></tr>
          <tr><th>直近の生理開始日</th><td>${prediction.lastPeriodStart !== null ? formatJP(prediction.lastPeriodStart) : "—"}</td></tr>
          <tr><th>次回生理予定日</th><td>${prediction.nextPeriodStart !== null ? formatJP(prediction.nextPeriodStart) : "—"}</td></tr>
          <tr><th>経血量（平均, 0-4）</th><td>${flowAvg}</td></tr>
          <tr><th>痛みレベル（平均, 0-5）</th><td>${painAvg}</td></tr>
          <tr><th>基礎体温（記録の平均）</th><td>${bbtAvg} ℃</td></tr>
          <tr><th>直近の体重</th><td>${weightLatest} kg</td></tr>
        </table>
      </section>

      <section class="report-section">
        <h2>2. 周期長の履歴</h2>
        ${
          cycleRows.length === 0
            ? '<p class="muted sub">記録なし</p>'
            : `
          <table class="report-table">
            <thead><tr><th>生理開始日</th><th>次回開始までの日数</th></tr></thead>
            <tbody>
              ${cycleRows
                .map(
                  (r) => `
                <tr>
                  <td>${formatJP(r.start)}</td>
                  <td>${r.length !== null ? `${r.length} 日` : "（最終）"}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        `
        }
      </section>

      <section class="report-section">
        <h2>3. 直近30日の症状頻度</h2>
        <table class="report-table">
          <thead><tr><th>身体症状</th><th>日数</th></tr></thead>
          <tbody>
            ${
              [...physCount.entries()].length === 0
                ? '<tr><td colspan="2" class="muted">記録なし</td></tr>'
                : [...physCount.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => `<tr><td>${physLabel[k] ?? k}</td><td>${v} 日</td></tr>`)
                    .join("")
            }
          </tbody>
        </table>
        <table class="report-table mt-4">
          <thead><tr><th>心の状態</th><th>日数</th></tr></thead>
          <tbody>
            ${
              [...mentCount.entries()].length === 0
                ? '<tr><td colspan="2" class="muted">記録なし</td></tr>'
                : [...mentCount.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => `<tr><td>${mentLabel[k] ?? k}</td><td>${v} 日</td></tr>`)
                    .join("")
            }
          </tbody>
        </table>
      </section>

      <section class="report-section">
        <h2>4. 直近のメモ（30日以内）</h2>
        ${
          memoEntries.length === 0
            ? '<p class="muted sub">記録なし</p>'
            : `
          <ul class="report-memo-list">
            ${memoEntries
              .map((m) => `<li><strong>${formatJP(m.date)}</strong>：${escapeHtml(m.text)}</li>`)
              .join("")}
          </ul>
        `
        }
      </section>

      <footer class="report-footer">
        <p class="muted sub">Cycli — オフライン記録アプリ</p>
      </footer>
    </div>

    <div class="no-print" style="margin-top: 16px;">
      <button class="btn btn-primary btn-block" id="print-btn">🖨 印刷 / PDF 保存</button>
      <p class="muted sub mt-2 text-center">
        ※「PDF として保存」を選ぶとPDF化できます。
      </p>
    </div>
  `;

  root.querySelector("#print-btn")?.addEventListener("click", () => {
    window.print();
  });

  return root;
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
