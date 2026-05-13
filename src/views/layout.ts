/**
 * アプリ全体のレイアウト（ヘッダー、メイン、ボトムナビ、FAB）
 */
import { navigate, type Route } from "../router";

/**
 * ボトムナビは5項目固定（モバイルUXの定石）
 * ピル・レポートは「設定」内、または「ホーム」のリマインドから入る
 */
const NAV_ITEMS: { route: Route; label: string; icon: string }[] = [
  { route: "home", label: "ホーム", icon: "🏠" },
  { route: "calendar", label: "カレンダー", icon: "📅" },
  { route: "record", label: "記録", icon: "📝" },
  { route: "stats", label: "統計", icon: "📊" },
  { route: "settings", label: "設定", icon: "⚙️" },
];

/** レイアウトを構築。中身は #main-content に差し替える */
export function renderLayout(): {
  setActiveRoute: (r: Route) => void;
  setMainContent: (el: HTMLElement) => void;
  setTitle: (title: string) => void;
} {
  const root = document.getElementById("app-root");
  if (!root) throw new Error("#app-root が見つかりません");

  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <button class="icon-btn" id="header-left" aria-label="メニュー">☰</button>
        <h1 id="header-title">Cycli</h1>
        <button class="icon-btn" id="header-right" aria-label="記録">＋</button>
      </header>
      <main class="app-main" id="main-content"></main>
      <button class="fab" id="fab" aria-label="クイック記録">＋</button>
      <nav class="bottom-nav" id="bottom-nav"></nav>
    </div>
  `;

  const nav = root.querySelector("#bottom-nav") as HTMLElement;
  for (const item of NAV_ITEMS) {
    const btn = document.createElement("button");
    btn.dataset.route = item.route;
    btn.innerHTML = `<span class="nav-icon">${item.icon}</span><span>${item.label}</span>`;
    btn.addEventListener("click", () => navigate(item.route));
    nav.appendChild(btn);
  }

  // FAB は記録モーダルを開く（実装は record.ts で関数を export）
  const fab = root.querySelector("#fab") as HTMLElement;
  fab.addEventListener("click", () => {
    // ハッシュナビで記録画面へ
    navigate("record");
  });

  // ヘッダーの＋ボタンも同じ
  (root.querySelector("#header-right") as HTMLElement).addEventListener(
    "click",
    () => navigate("record"),
  );
  (root.querySelector("#header-left") as HTMLElement).addEventListener(
    "click",
    () => navigate("settings"),
  );

  const main = root.querySelector("#main-content") as HTMLElement;
  const titleEl = root.querySelector("#header-title") as HTMLElement;

  return {
    setActiveRoute(r: Route) {
      nav.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("active", (b as HTMLElement).dataset.route === r);
      });
    },
    setMainContent(el: HTMLElement) {
      main.innerHTML = "";
      main.appendChild(el);
      main.scrollTop = 0;
    },
    setTitle(t: string) {
      titleEl.textContent = t;
    },
  };
}
