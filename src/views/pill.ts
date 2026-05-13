/**
 * ピル服薬管理画面
 * - 当日の服薬チェック
 * - 過去14日のヒートマップ（飲んだ◯/飲んでない×）
 * - 服薬時刻の登録（HH:MM）
 * - 「今日まだ飲んでない」場合の警告表示
 */
import { getPill, savePill } from "../db/repository";
import { addDays, today, type DateStr } from "../utils/date";
import { showToast } from "../components/toast";

interface PillSettings {
  scheduledHour: number;
  scheduledMinute: number;
}

const PILL_SCHEDULE_KEY = "cycli.pillSchedule";

function getPillSchedule(): PillSettings {
  const raw = localStorage.getItem(PILL_SCHEDULE_KEY);
  if (raw === null) return { scheduledHour: 21, scheduledMinute: 0 };
  try {
    return JSON.parse(raw) as PillSettings;
  } catch {
    return { scheduledHour: 21, scheduledMinute: 0 };
  }
}

function setPillSchedule(s: PillSettings): void {
  localStorage.setItem(PILL_SCHEDULE_KEY, JSON.stringify(s));
}

export async function renderPill(): Promise<HTMLElement> {
  const root = document.createElement("div");
  const t = today();
  const todayPill = await getPill(t);
  const schedule = getPillSchedule();

  // 過去14日
  const days: { date: DateStr; taken: boolean }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t, -i);
    const rec = await getPill(d);
    days.push({ date: d, taken: rec?.taken === true });
  }

  // 連続服薬日数
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i]?.taken === true) streak++;
    else break;
  }

  const taken = todayPill?.taken === true;

  root.innerHTML = `
    <div class="app-card text-center" style="background: linear-gradient(135deg, #FDE4EE 0%, #ECDCF0 100%);">
      <div class="muted sub">今日のピル</div>
      <div class="big-number" style="margin-top:8px;">
        ${taken ? "✓" : "○"}<span class="unit">${taken ? "服薬済み" : "未服薬"}</span>
      </div>
      <div class="muted sub mt-2">
        予定時刻：${String(schedule.scheduledHour).padStart(2, "0")}:${String(schedule.scheduledMinute).padStart(2, "0")}
      </div>
      <button class="btn ${taken ? "btn-secondary" : "btn-primary"} mt-4" id="toggle-pill">
        ${taken ? "取り消す" : "今日のピルを飲んだ"}
      </button>
    </div>

    <div class="app-card">
      <h2>📅 直近14日</h2>
      <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-top: 8px;">
        ${days
          .map(
            (d) => `
          <div title="${d.date}" style="aspect-ratio:1; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:12px; background: ${d.taken ? "var(--color-ovulation-soft)" : "var(--color-surface-soft)"}; color: ${d.taken ? "var(--color-ovulation)" : "var(--color-text-muted)"}; font-weight:600;">
            ${d.taken ? "✓" : d.date.slice(8)}
          </div>
        `,
          )
          .join("")}
      </div>
      <p class="muted sub mt-4">
        ${streak > 0 ? `🌷 ${streak}日連続で服薬中です` : "今日から始めましょう"}
      </p>
    </div>

    <div class="app-card">
      <h2>⏰ 服薬予定時刻</h2>
      <p class="muted sub" style="margin-bottom: 12px;">
        この時刻を過ぎてアプリを開くと、未服薬の場合にリマインドが出ます。
      </p>
      <div class="flex gap-2" style="align-items:center;">
        <input type="number" class="input" id="pill-hour" min="0" max="23" value="${schedule.scheduledHour}" style="width:80px;"/>
        <span>時</span>
        <input type="number" class="input" id="pill-minute" min="0" max="59" value="${schedule.scheduledMinute}" style="width:80px;"/>
        <span>分</span>
      </div>
      <button class="btn btn-primary mt-4" id="save-schedule">時刻を保存</button>
    </div>

    <div class="app-card">
      <h2>ℹ️ ピル管理のヒント</h2>
      <ul class="muted sub" style="padding-left:18px; line-height:1.8;">
        <li>毎日同じ時刻に服用するのが基本です</li>
        <li>飲み忘れに気づいたら、添付文書または医師の指示に従ってください</li>
        <li>体調に変化があるときは医療機関に相談を</li>
      </ul>
    </div>
  `;

  // ----- 服薬トグル -----
  root.querySelector("#toggle-pill")?.addEventListener("click", async () => {
    await savePill({
      date: t,
      taken: !taken,
      takenAt: !taken ? Date.now() : undefined,
    });
    showToast(!taken ? "今日のピルを記録しました🌷" : "記録を取り消しました");
    window.dispatchEvent(new Event("cycli:rerender"));
  });

  // ----- 予定時刻 -----
  root.querySelector("#save-schedule")?.addEventListener("click", () => {
    const h = parseInt((root.querySelector("#pill-hour") as HTMLInputElement).value, 10);
    const m = parseInt((root.querySelector("#pill-minute") as HTMLInputElement).value, 10);
    setPillSchedule({
      scheduledHour: isNaN(h) ? 21 : Math.max(0, Math.min(23, h)),
      scheduledMinute: isNaN(m) ? 0 : Math.max(0, Math.min(59, m)),
    });
    showToast("予定時刻を保存しました");
    window.dispatchEvent(new Event("cycli:rerender"));
  });

  return root;
}

/** 服薬リマインドを判定（ホーム画面で使用） */
export async function shouldShowPillReminder(): Promise<boolean> {
  const t = today();
  const todayPill = await getPill(t);
  if (todayPill?.taken === true) return false;
  const schedule = getPillSchedule();
  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(schedule.scheduledHour, schedule.scheduledMinute, 0, 0);
  return now >= scheduled;
}

/** 服薬予定時刻の文字列 */
export function getPillScheduleText(): string {
  const s = getPillSchedule();
  return `${String(s.scheduledHour).padStart(2, "0")}:${String(s.scheduledMinute).padStart(2, "0")}`;
}
