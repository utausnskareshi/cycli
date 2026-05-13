/**
 * ダミーモード（カモフラージュ画面）
 * - 他人にスマホを見られそうな時に「電卓っぽい画面」を表示
 * - 「= = = =」を3秒長押しすると本物のアプリへ戻る
 * - データそのものは保護しないが、画面上はそれっぽく見せる
 */

const DUMMY_FLAG = "cycli.dummyMode";

export function isDummyModeEnabled(): boolean {
  return localStorage.getItem(DUMMY_FLAG) === "true";
}

export function setDummyMode(enabled: boolean): void {
  localStorage.setItem(DUMMY_FLAG, enabled ? "true" : "false");
}

/** ダミー画面を表示。dismiss()で消える */
export function showDummyScreen(onUnlock: () => void): () => void {
  const root = document.createElement("div");
  root.className = "dummy-app";
  root.innerHTML = `
    <div class="dummy-card">
      <h2 style="margin:0 0 16px; font-size:20px;">電卓</h2>
      <div style="font-size:24px; text-align:right; background:#f0f0f0; padding:12px; border-radius:6px; margin-bottom:16px; min-height:40px;" id="dummy-display">0</div>
      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">
        ${["7","8","9","÷","4","5","6","×","1","2","3","-","0",".","=","+"].map(c => `<button class="dummy-btn" data-c="${c}" style="padding:14px; border-radius:8px; background:#fff; border:1px solid #ddd; font-size:18px;">${c}</button>`).join("")}
      </div>
      <p style="font-size:11px; color:#999; margin-top:12px;">＝を長押し（3秒）でCycliへ戻ります</p>
    </div>
  `;
  document.body.appendChild(root);

  const display = root.querySelector("#dummy-display") as HTMLElement;
  let expr = "";

  const updateDisplay = () => {
    display.textContent = expr === "" ? "0" : expr;
  };

  let holdTimer: number | null = null;
  let didUnlock = false;

  root.querySelectorAll(".dummy-btn").forEach((b) => {
    const ch = (b as HTMLElement).dataset.c ?? "";
    b.addEventListener("pointerdown", () => {
      if (ch === "=") {
        // 長押しタイマー開始
        holdTimer = window.setTimeout(() => {
          didUnlock = true;
          root.remove();
          onUnlock();
        }, 3000);
      }
    });
    b.addEventListener("pointerup", () => {
      if (didUnlock) return;
      if (holdTimer !== null) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (ch === "=") {
        // 軽量な式評価（電卓っぽい挙動だけ）
        try {
          const safe = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/[^0-9+\-*/.]/g, "");
          // eslint-disable-next-line no-new-func
          const v = Function(`"use strict";return (${safe || "0"})`)();
          expr = String(v);
        } catch {
          expr = "0";
        }
      } else {
        expr += ch;
      }
      updateDisplay();
    });
    b.addEventListener("pointerleave", () => {
      if (holdTimer !== null) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    });
  });

  return () => root.remove();
}
