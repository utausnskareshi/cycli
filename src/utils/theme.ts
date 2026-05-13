/**
 * テーマ切替（ライト/ダーク）
 * - 設定はlocalStorageに保存
 * - 「system」を選ぶとOSのprefers-color-schemeに従う
 */

export type Theme = "light" | "dark" | "system";

const THEME_KEY = "cycli.theme";

export function getTheme(): Theme {
  const v = localStorage.getItem(THEME_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
}

/** 現在の設定をDOMに適用 */
export function applyTheme(): void {
  const t = getTheme();
  let active: "light" | "dark";
  if (t === "system") {
    active = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } else {
    active = t;
  }
  document.documentElement.dataset.theme = active;
  // theme-colorメタも更新（ステータスバー色）
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", active === "dark" ? "#1a1418" : "#F8BBD0");
  }
}

/** OS設定変更の追従 */
export function watchSystemTheme(): void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    if (getTheme() === "system") applyTheme();
  });
}
