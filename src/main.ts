/**
 * Cycli アプリのエントリーポイント
 *
 * 起動シーケンス:
 *  1. テーマ適用（ライト/ダーク/自動）
 *  2. ダミーモード有効ならカモフラージュ画面 → 長押し解除後に通常起動
 *  3. パスコード設定済みなら、解錠画面 → 解錠成功後にアプリ起動
 *  4. オンボーディング未完了なら 3 ステップオンボーディング
 *  5. ストレージ永続化要求 → 通常起動
 *  6. レイアウト構築 → ルート別レンダリング
 */
import { initRouter, onRouteChange, getCurrentRoute, type Route } from "./router";
import { renderLayout } from "./views/layout";
import { renderHome } from "./views/home";
import { renderCalendar } from "./views/calendar";
import { renderRecord } from "./views/record";
import { renderStats } from "./views/stats";
import { renderSettings } from "./views/settings";
import { renderPill } from "./views/pill";
import { renderReport } from "./views/report";
import { hasPasscode, isEncryptionEnabled, unlockWithPasscode } from "./db/crypto";
import { showPasscodeScreen } from "./components/passcode";
import { applyTheme, watchSystemTheme } from "./utils/theme";
import { isDummyModeEnabled, showDummyScreen } from "./views/dummy";
import { isOnboardingDone, showOnboarding } from "./views/onboarding";

/** ストレージ永続化要求（OS による削除を防ぐ） */
async function requestPersistentStorage(): Promise<void> {
  if (navigator.storage && typeof navigator.storage.persist === "function") {
    try {
      await navigator.storage.persist();
    } catch {
      // 失敗しても致命的ではないので握りつぶす
    }
  }
}

function hideSplash(): void {
  const splash = document.getElementById("splash");
  if (splash) splash.classList.add("hidden");
}

const ROUTE_TITLES: Record<Route, string> = {
  home: "Cycli",
  calendar: "カレンダー",
  record: "記録",
  stats: "統計",
  pill: "ピル管理",
  report: "レポート",
  settings: "設定",
};

async function startApp(): Promise<void> {
  await requestPersistentStorage();

  const layout = renderLayout();

  async function dispatchRoute(route: Route): Promise<void> {
    layout.setActiveRoute(route);
    layout.setTitle(ROUTE_TITLES[route]);
    try {
      let view: HTMLElement;
      switch (route) {
        case "home":
          view = await renderHome();
          break;
        case "calendar":
          view = await renderCalendar();
          break;
        case "record":
          view = await renderRecord();
          break;
        case "stats":
          view = await renderStats();
          break;
        case "pill":
          view = await renderPill();
          break;
        case "report":
          view = await renderReport();
          break;
        case "settings":
          view = await renderSettings();
          break;
      }
      layout.setMainContent(view);
    } catch (err) {
      console.error("画面描画に失敗しました:", err);
      const errEl = document.createElement("div");
      errEl.className = "app-card";
      errEl.innerHTML = `
        <h2>エラーが発生しました</h2>
        <p class="muted sub">${err instanceof Error ? err.message : String(err)}</p>
      `;
      layout.setMainContent(errEl);
    }
  }

  onRouteChange((r) => {
    void dispatchRoute(r);
  });

  /**
   * 同じルートの強制再描画用カスタムイベント
   * Why: location.reload() を使うとパスコード再入力が必要になり、
   *      また書き込み直後の reload は IndexedDB のトランザクションが
   *      確定する前にページが終了することがあるため使わない。
   */
  window.addEventListener("cycli:rerender", () => {
    void dispatchRoute(getCurrentRoute());
  });

  initRouter();
  void dispatchRoute(getCurrentRoute());

  hideSplash();

  window.addEventListener("appinstalled", () => {
    console.log("Cycliがインストールされました");
  });
}

/** オンボーディング → 起動 */
function maybeOnboardingThenStart(): void {
  if (!isOnboardingDone()) {
    hideSplash();
    showOnboarding(() => {
      void startApp();
    });
  } else {
    void startApp();
  }
}

/** ロック画面 → 解錠後にオンボ判定 */
function showUnlockAndStart(): void {
  showPasscodeScreen({
    mode: "unlock",
    title: "Cycli ロック解除",
    hint: "設定したパスコードを入力してください",
    onSubmit: async (pc) => unlockWithPasscode(pc),
    onSuccess: () => maybeOnboardingThenStart(),
  });
}

/**
 * iOS Safari の standalone モード（ホーム画面から起動）を検出して、
 * body に `data-standalone="true"` を付与する。
 * Why: standalone 時はSafariのUIが無いため、ノッチ/ホームインジケーターを
 *      考慮した余白が必要。CSS の env(safe-area-inset-*) と組み合わせて使う。
 */
function detectStandalone(): void {
  const isIosStandalone =
    "standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true;
  const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
  if (isIosStandalone || isDisplayStandalone) {
    document.body.dataset.standalone = "true";
  }
}

/** メイン */
(async () => {
  // テーマ適用
  applyTheme();
  watchSystemTheme();
  detectStandalone();

  // ダミーモード → 解除後に通常フロー
  const enterAppFlow = (): void => {
    if (hasPasscode() && isEncryptionEnabled()) {
      hideSplash();
      showUnlockAndStart();
    } else {
      maybeOnboardingThenStart();
    }
  };

  if (isDummyModeEnabled()) {
    hideSplash();
    showDummyScreen(() => enterAppFlow());
  } else {
    enterAppFlow();
  }
})().catch((err) => {
  console.error("起動エラー:", err);
  const root = document.getElementById("app-root");
  if (root) {
    root.innerHTML = `
      <div style="padding:32px; text-align:center;">
        <h2>起動に失敗しました</h2>
        <p>${err instanceof Error ? err.message : String(err)}</p>
        <button onclick="location.reload()" class="btn btn-primary" style="margin-top:16px;">再読み込み</button>
      </div>
    `;
  }
});
