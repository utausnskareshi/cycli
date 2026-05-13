/**
 * オンボーディング（初回起動時の3ステップ）
 * 1. アプリ紹介
 * 2. ライフモード選択
 * 3. 前回の生理開始日入力（任意）
 *
 * 完了したら localStorage に終了フラグをセット
 */
import { markPeriodStartToday, savePeriod } from "../db/repository";
import { updateSettings, type LifeMode } from "../db/schema";
import { today } from "../utils/date";

const ONBOARDING_KEY = "cycli.onboardingDone";

export function isOnboardingDone(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function markOnboardingDone(): void {
  localStorage.setItem(ONBOARDING_KEY, "true");
}

interface OnboardingState {
  step: 1 | 2 | 3;
  mode: LifeMode;
  lastPeriodDate: string;
}

export function showOnboarding(onDone: () => void): void {
  const root = document.createElement("div");
  root.className = "passcode-screen";
  // styleを書き直し
  root.style.background =
    "linear-gradient(180deg, #FDE4EE 0%, #ECDCF0 50%, #D5C5E8 100%)";
  root.style.color = "#4A4A4A";
  document.body.appendChild(root);

  const state: OnboardingState = {
    step: 1,
    mode: "menstrual",
    lastPeriodDate: today(),
  };

  function render(): void {
    if (state.step === 1) {
      root.innerHTML = `
        <div style="text-align:center; padding: 32px;">
          <div style="font-size: 64px; margin-bottom: 16px;">🌸</div>
          <h2 style="font-size: 28px; margin-bottom: 8px; color: var(--color-accent-strong);">Cycli へようこそ</h2>
          <p style="color: var(--color-text-sub); margin-bottom: 32px; line-height: 1.7;">
            あなたのリズムをやさしく寄りそって<br>
            記録・予測するアプリです。<br><br>
            3ステップで始めましょう。
          </p>
          <button class="btn btn-primary" id="next">次へ</button>
        </div>
      `;
    } else if (state.step === 2) {
      const modes: { v: LifeMode; label: string; emoji: string; desc: string }[] = [
        { v: "menstrual", label: "月経管理", emoji: "🌷", desc: "周期を把握したい" },
        { v: "fertility", label: "妊活", emoji: "🌱", desc: "妊娠を希望" },
        { v: "pregnant", label: "妊娠中", emoji: "👶", desc: "妊娠週数を管理" },
        { v: "junior", label: "ジュニア", emoji: "🎀", desc: "初経〜10代向け" },
      ];
      root.innerHTML = `
        <div style="text-align:center; padding: 32px; max-width: 360px;">
          <h2 style="font-size: 24px; margin-bottom: 8px;">目的を選んでください</h2>
          <p style="color: var(--color-text-sub); margin-bottom: 24px;">あとから変更できます</p>
          <div style="display: grid; gap: 12px; margin-bottom: 24px;">
            ${modes
              .map(
                (m) => `
              <button class="onb-mode" data-v="${m.v}" style="
                background: ${state.mode === m.v ? "var(--color-primary)" : "#fff"};
                color: ${state.mode === m.v ? "#fff" : "var(--color-text)"};
                border: 2px solid ${state.mode === m.v ? "var(--color-primary-strong)" : "var(--color-border)"};
                padding: 16px; border-radius: 12px; text-align: left; display: flex; gap: 12px; align-items: center;
              ">
                <span style="font-size: 28px;">${m.emoji}</span>
                <div>
                  <div style="font-weight: 700;">${m.label}</div>
                  <div style="font-size: 12px; opacity: 0.7;">${m.desc}</div>
                </div>
              </button>
            `,
              )
              .join("")}
          </div>
          <div class="flex" style="gap: 8px; justify-content: center;">
            <button class="btn btn-secondary" id="back">戻る</button>
            <button class="btn btn-primary" id="next">次へ</button>
          </div>
        </div>
      `;

      root.querySelectorAll(".onb-mode").forEach((b) => {
        b.addEventListener("click", () => {
          state.mode = (b as HTMLElement).dataset.v as LifeMode;
          render();
        });
      });
    } else {
      // step 3
      root.innerHTML = `
        <div style="text-align:center; padding: 32px; max-width: 360px;">
          <div style="font-size: 48px; margin-bottom: 12px;">📅</div>
          <h2 style="font-size: 24px; margin-bottom: 8px;">最後に — 前回の生理開始日</h2>
          <p style="color: var(--color-text-sub); margin-bottom: 24px;">
            分かれば入力してください。後から記録もできます。
          </p>
          <input type="date" class="input" id="last-period" value="${state.lastPeriodDate}" style="margin-bottom: 16px;"/>
          <div class="flex" style="gap: 8px; justify-content: center; margin-bottom: 12px;">
            <button class="btn btn-secondary" id="back">戻る</button>
            <button class="btn btn-primary" id="finish">はじめる</button>
          </div>
          <button class="btn btn-secondary" id="skip" style="width:100%;">スキップする</button>
        </div>
      `;
    }

    root.querySelector("#next")?.addEventListener("click", () => {
      state.step = (state.step + 1) as OnboardingState["step"];
      render();
    });
    root.querySelector("#back")?.addEventListener("click", () => {
      state.step = (state.step - 1) as OnboardingState["step"];
      render();
    });
    root.querySelector("#skip")?.addEventListener("click", async () => {
      await updateSettings({ mode: state.mode });
      markOnboardingDone();
      root.remove();
      onDone();
    });
    root.querySelector("#finish")?.addEventListener("click", async () => {
      const dateInput = root.querySelector("#last-period") as HTMLInputElement;
      const lastDate = dateInput.value;
      await updateSettings({ mode: state.mode });
      if (lastDate !== "") {
        if (lastDate === today()) {
          await markPeriodStartToday(lastDate);
        } else {
          await savePeriod({
            date: lastDate,
            isStart: true,
            flow: 2,
            pain: 0,
            medication: false,
          });
        }
      }
      markOnboardingDone();
      root.remove();
      onDone();
    });
  }

  render();
}
