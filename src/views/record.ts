/**
 * 記録入力画面 / 記録入力フォーム
 * - 当日 or 指定日付の記録をまとめて編集
 * - 生理 / 基礎体温 / 体重 / 症状 / 気分 / メモ
 */
import {
  getBBT,
  getLifestyle,
  getNote,
  getPeriod,
  getSymptoms,
  getWeight,
  saveBBT,
  saveLifestyle,
  saveNote,
  savePeriod,
  saveSymptoms,
  saveWeight,
  deletePeriod,
} from "../db/repository";
import { getSettings } from "../db/schema";
import type {
  FlowLevel,
  MentalSymptom,
  PainLevel,
  PhysicalSymptom,
} from "../db/schema";
import { showToast } from "../components/toast";
import { today, formatJP, type DateStr } from "../utils/date";

const PHYSICAL_OPTIONS: { value: PhysicalSymptom; label: string; emoji: string }[] = [
  { value: "headache", label: "頭痛", emoji: "🤕" },
  { value: "stomachache", label: "腹痛", emoji: "😣" },
  { value: "backache", label: "腰痛", emoji: "🦴" },
  { value: "skinIssue", label: "肌荒れ", emoji: "💧" },
  { value: "swelling", label: "むくみ", emoji: "🫧" },
  { value: "drowsy", label: "眠気", emoji: "😴" },
];

const MENTAL_OPTIONS: { value: MentalSymptom; label: string; emoji: string }[] = [
  { value: "irritated", label: "イライラ", emoji: "💢" },
  { value: "depressed", label: "落ち込み", emoji: "😢" },
  { value: "anxious", label: "不安", emoji: "😟" },
  { value: "unmotivated", label: "やる気なし", emoji: "🫥" },
];

const FLOW_LEVELS: { value: FlowLevel; label: string }[] = [
  { value: 0, label: "なし" },
  { value: 1, label: "少量" },
  { value: 2, label: "普通" },
  { value: 3, label: "多量" },
  { value: 4, label: "とても多い" },
];

/**
 * 記録フォームを生成
 * - 指定された日付の既存記録をロードして表示
 */
export async function renderRecordForm(
  date: DateStr,
  onSaved?: () => void,
): Promise<HTMLElement> {
  const [period, bbt, weight, symptoms, note, lifestyle, settings] = await Promise.all([
    getPeriod(date),
    getBBT(date),
    getWeight(date),
    getSymptoms(date),
    getNote(date),
    getLifestyle(date),
    getSettings(),
  ]);

  // フォームの状態
  const state = {
    periodActive: period !== undefined,
    isStart: period?.isStart ?? false,
    flow: period?.flow ?? (1 as FlowLevel),
    pain: period?.pain ?? (0 as PainLevel),
    medication: period?.medication ?? false,
    bbt: bbt?.value ?? null,
    weight: weight?.value ?? null,
    physical: new Set<PhysicalSymptom>(symptoms?.physical ?? []),
    mental: new Set<MentalSymptom>(symptoms?.mental ?? []),
    note: note ?? "",
    sleepHours: lifestyle?.sleepHours ?? null,
    water: lifestyle?.water ?? null,
    exerciseMinutes: lifestyle?.exerciseMinutes ?? null,
    cervicalMucus: lifestyle?.cervicalMucus ?? null,
    intercourse: lifestyle?.intercourse ?? false,
  };

  const isFertilityMode = settings.mode === "fertility";

  const root = document.createElement("div");
  root.innerHTML = `
    <div class="muted sub" style="margin-bottom: 12px;">${formatJP(date)}</div>

    <!-- 生理 -->
    <div class="app-card">
      <h2>🩸 生理</h2>
      <div class="field">
        <label>記録する</label>
        <div class="segment" id="seg-period">
          <button data-v="off">記録しない</button>
          <button data-v="on">記録する</button>
          <button data-v="start">開始日</button>
        </div>
      </div>
      <div id="period-detail" style="display:none;">
        <div class="field">
          <label>経血量</label>
          <div class="level-picker" id="flow-picker"></div>
        </div>
        <div class="field">
          <label>痛みのレベル（0=なし 〜 5=激痛）</label>
          <div class="level-picker" id="pain-picker" style="grid-template-columns: repeat(6, 1fr);"></div>
        </div>
        <div class="field">
          <label class="flex" style="align-items:center; gap:8px;">
            <input type="checkbox" id="med-check" style="width:20px; height:20px;"/>
            <span>薬を服用した</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 基礎体温 -->
    <div class="app-card">
      <h2>🌡 基礎体温</h2>
      <div class="field">
        <label>℃（例：36.50）</label>
        <input type="number" inputmode="decimal" step="0.01" min="34" max="40"
          class="input" id="bbt-input" placeholder="36.50" />
      </div>
    </div>

    <!-- 体重 -->
    <div class="app-card">
      <h2>⚖️ 体重</h2>
      <div class="field">
        <label>kg（小数1桁まで）</label>
        <input type="number" inputmode="decimal" step="0.1" min="20" max="200"
          class="input" id="weight-input" placeholder="例：52.3" />
      </div>
    </div>

    <!-- 身体症状 -->
    <div class="app-card">
      <h2>💢 身体の症状</h2>
      <div class="chip-group" id="physical-chips"></div>
    </div>

    <!-- メンタル -->
    <div class="app-card">
      <h2>💭 心の状態</h2>
      <div class="chip-group" id="mental-chips"></div>
    </div>

    <!-- ライフスタイル -->
    <div class="app-card">
      <h2>🌙 ライフスタイル（任意）</h2>
      <div class="field">
        <label>睡眠時間（時間, 小数1桁）</label>
        <input type="number" inputmode="decimal" step="0.5" min="0" max="24"
          class="input" id="sleep-input" placeholder="例：7.5" />
      </div>
      <div class="field">
        <label>水分摂取量（コップ数）</label>
        <div class="level-picker" id="water-picker" style="grid-template-columns: repeat(9, 1fr);"></div>
      </div>
      <div class="field">
        <label>運動した時間（分）</label>
        <input type="number" inputmode="numeric" step="5" min="0" max="600"
          class="input" id="exercise-input" placeholder="例：30" />
      </div>
      ${
        isFertilityMode
          ? `
      <div class="field">
        <label>おりもの観察（妊活モード）</label>
        <div class="chip-group" id="mucus-chips"></div>
      </div>
      <div class="field">
        <label class="flex" style="align-items:center; gap:8px;">
          <input type="checkbox" id="intercourse-check" style="width:20px; height:20px;"/>
          <span>性交の記録</span>
        </label>
      </div>
      `
          : ""
      }
    </div>

    <!-- メモ -->
    <div class="app-card">
      <h2>📝 メモ</h2>
      <textarea class="textarea" id="note-input" placeholder="例：薬を飲んだ／通院した／睡眠不足"></textarea>
      <p class="muted sub mt-2">※メモは端末内で暗号化されます</p>
    </div>

    <button class="btn btn-primary btn-block" id="save-btn" style="margin-bottom: 24px;">保存する</button>
  `;

  // ----- 生理セグメント -----
  const segPeriod = root.querySelector("#seg-period") as HTMLElement;
  const periodDetail = root.querySelector("#period-detail") as HTMLElement;
  function refreshPeriodSeg(): void {
    segPeriod.querySelectorAll("button").forEach((b) => {
      const v = (b as HTMLElement).dataset.v;
      const active =
        (v === "off" && !state.periodActive) ||
        (v === "on" && state.periodActive && !state.isStart) ||
        (v === "start" && state.periodActive && state.isStart);
      b.classList.toggle("active", active);
    });
    periodDetail.style.display = state.periodActive ? "" : "none";
  }
  segPeriod.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      const v = (b as HTMLElement).dataset.v;
      if (v === "off") {
        state.periodActive = false;
        state.isStart = false;
      } else if (v === "on") {
        state.periodActive = true;
        state.isStart = false;
      } else if (v === "start") {
        state.periodActive = true;
        state.isStart = true;
      }
      refreshPeriodSeg();
    });
  });
  refreshPeriodSeg();

  // ----- 経血レベル -----
  const flowPicker = root.querySelector("#flow-picker") as HTMLElement;
  FLOW_LEVELS.forEach((opt) => {
    const b = document.createElement("button");
    b.textContent = opt.label;
    b.addEventListener("click", () => {
      state.flow = opt.value;
      flowPicker.querySelectorAll("button").forEach((x, i) => {
        x.classList.toggle("selected", FLOW_LEVELS[i]?.value === state.flow);
      });
    });
    flowPicker.appendChild(b);
  });
  flowPicker.querySelectorAll("button").forEach((x, i) => {
    x.classList.toggle("selected", FLOW_LEVELS[i]?.value === state.flow);
  });

  // ----- 痛みレベル -----
  const painPicker = root.querySelector("#pain-picker") as HTMLElement;
  for (let i = 0; i <= 5; i++) {
    const b = document.createElement("button");
    b.textContent = String(i);
    b.addEventListener("click", () => {
      state.pain = i as PainLevel;
      painPicker.querySelectorAll("button").forEach((x, idx) => {
        x.classList.toggle("selected", idx === i);
      });
    });
    painPicker.appendChild(b);
  }
  painPicker.querySelectorAll("button").forEach((x, idx) => {
    x.classList.toggle("selected", idx === state.pain);
  });

  // ----- 薬 -----
  const medCheck = root.querySelector("#med-check") as HTMLInputElement;
  medCheck.checked = state.medication;
  medCheck.addEventListener("change", () => {
    state.medication = medCheck.checked;
  });

  // ----- BBT -----
  const bbtInput = root.querySelector("#bbt-input") as HTMLInputElement;
  if (state.bbt !== null) bbtInput.value = state.bbt.toFixed(2);
  bbtInput.addEventListener("input", () => {
    const v = parseFloat(bbtInput.value);
    state.bbt = isNaN(v) ? null : v;
  });

  // ----- 体重 -----
  const weightInput = root.querySelector("#weight-input") as HTMLInputElement;
  if (state.weight !== null) weightInput.value = state.weight.toFixed(1);
  weightInput.addEventListener("input", () => {
    const v = parseFloat(weightInput.value);
    state.weight = isNaN(v) ? null : v;
  });

  // ----- 身体症状チップ -----
  const physGroup = root.querySelector("#physical-chips") as HTMLElement;
  PHYSICAL_OPTIONS.forEach((opt) => {
    const c = document.createElement("button");
    c.className = "chip" + (state.physical.has(opt.value) ? " selected" : "");
    c.innerHTML = `<span>${opt.emoji}</span><span>${opt.label}</span>`;
    c.addEventListener("click", () => {
      if (state.physical.has(opt.value)) state.physical.delete(opt.value);
      else state.physical.add(opt.value);
      c.classList.toggle("selected", state.physical.has(opt.value));
    });
    physGroup.appendChild(c);
  });

  // ----- メンタルチップ -----
  const menGroup = root.querySelector("#mental-chips") as HTMLElement;
  MENTAL_OPTIONS.forEach((opt) => {
    const c = document.createElement("button");
    c.className = "chip" + (state.mental.has(opt.value) ? " selected" : "");
    c.innerHTML = `<span>${opt.emoji}</span><span>${opt.label}</span>`;
    c.addEventListener("click", () => {
      if (state.mental.has(opt.value)) state.mental.delete(opt.value);
      else state.mental.add(opt.value);
      c.classList.toggle("selected", state.mental.has(opt.value));
    });
    menGroup.appendChild(c);
  });

  // ----- 睡眠 -----
  const sleepInput = root.querySelector("#sleep-input") as HTMLInputElement;
  if (state.sleepHours !== null) sleepInput.value = state.sleepHours.toFixed(1);
  sleepInput.addEventListener("input", () => {
    const v = parseFloat(sleepInput.value);
    state.sleepHours = isNaN(v) ? null : v;
  });

  // ----- 水分（0〜8コップ） -----
  const waterPicker = root.querySelector("#water-picker") as HTMLElement;
  for (let i = 0; i <= 8; i++) {
    const b = document.createElement("button");
    b.textContent = String(i);
    b.addEventListener("click", () => {
      state.water = i;
      waterPicker.querySelectorAll("button").forEach((x, idx) => {
        x.classList.toggle("selected", idx === i);
      });
    });
    waterPicker.appendChild(b);
  }
  if (state.water !== null) {
    waterPicker.querySelectorAll("button").forEach((x, idx) => {
      x.classList.toggle("selected", idx === state.water);
    });
  }

  // ----- 運動 -----
  const exerciseInput = root.querySelector("#exercise-input") as HTMLInputElement;
  if (state.exerciseMinutes !== null) exerciseInput.value = String(state.exerciseMinutes);
  exerciseInput.addEventListener("input", () => {
    const v = parseInt(exerciseInput.value, 10);
    state.exerciseMinutes = isNaN(v) ? null : v;
  });

  // ----- おりもの観察（妊活モード） -----
  if (isFertilityMode) {
    const mucusGroup = root.querySelector("#mucus-chips") as HTMLElement;
    const mucusOptions: { v: NonNullable<typeof state.cervicalMucus>; label: string; emoji: string }[] = [
      { v: "none", label: "なし", emoji: "—" },
      { v: "sticky", label: "ねばつき", emoji: "🟫" },
      { v: "creamy", label: "クリーム状", emoji: "🟡" },
      { v: "watery", label: "水っぽい", emoji: "💧" },
      { v: "eggwhite", label: "卵白状", emoji: "🥚" },
    ];
    for (const opt of mucusOptions) {
      const c = document.createElement("button");
      c.className = "chip" + (state.cervicalMucus === opt.v ? " selected" : "");
      c.innerHTML = `<span>${opt.emoji}</span><span>${opt.label}</span>`;
      c.addEventListener("click", () => {
        state.cervicalMucus = state.cervicalMucus === opt.v ? null : opt.v;
        mucusGroup.querySelectorAll(".chip").forEach((x) => x.classList.remove("selected"));
        if (state.cervicalMucus === opt.v) c.classList.add("selected");
      });
      mucusGroup.appendChild(c);
    }

    const interCheck = root.querySelector("#intercourse-check") as HTMLInputElement;
    interCheck.checked = state.intercourse;
    interCheck.addEventListener("change", () => {
      state.intercourse = interCheck.checked;
    });
  }

  // ----- メモ -----
  const noteInput = root.querySelector("#note-input") as HTMLTextAreaElement;
  noteInput.value = state.note;
  noteInput.addEventListener("input", () => {
    state.note = noteInput.value;
  });

  // ----- 保存 -----
  (root.querySelector("#save-btn") as HTMLElement).addEventListener("click", async () => {
    try {
      if (state.periodActive) {
        await savePeriod({
          date,
          isStart: state.isStart,
          flow: state.flow,
          pain: state.pain,
          medication: state.medication,
        });
      } else if (period !== undefined) {
        // 「記録しない」に変更したら削除
        await deletePeriod(date);
      }
      if (state.bbt !== null) await saveBBT(date, state.bbt);
      if (state.weight !== null) await saveWeight(date, state.weight);
      await saveSymptoms({
        date,
        physical: [...state.physical],
        mental: [...state.mental],
      });
      const lifestylePatch: Parameters<typeof saveLifestyle>[1] = {};
      if (state.sleepHours !== null) lifestylePatch.sleepHours = state.sleepHours;
      if (state.water !== null) lifestylePatch.water = state.water;
      if (state.exerciseMinutes !== null) lifestylePatch.exerciseMinutes = state.exerciseMinutes;
      if (state.cervicalMucus !== null) lifestylePatch.cervicalMucus = state.cervicalMucus;
      if (state.intercourse) lifestylePatch.intercourse = true;
      if (Object.keys(lifestylePatch).length > 0) {
        await saveLifestyle(date, lifestylePatch);
      }
      await saveNote(date, state.note);
      showToast("保存しました🌸");
      onSaved?.();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "保存に失敗しました");
    }
  });

  return root;
}

/** 記録画面（今日のフォーム） */
export async function renderRecord(): Promise<HTMLElement> {
  const wrap = document.createElement("div");
  const heading = document.createElement("div");
  heading.className = "app-card";
  heading.innerHTML = `
    <h2>今日の記録</h2>
    <p class="muted sub">あてはまるものをタップしていくだけで保存できます。</p>
  `;
  wrap.appendChild(heading);
  const form = await renderRecordForm(today());
  wrap.appendChild(form);
  return wrap;
}
