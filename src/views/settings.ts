/**
 * 設定画面（フル機能版）
 * - 周期設定 / ライフモード
 * - パスコード（暗号化）
 * - エクスポート / インポート
 * - ダークモード
 * - ダミーモード
 * - ピル管理・医療レポートへのリンク
 * - データ全削除
 */
import { getSettings, updateSettings, type LifeMode } from "../db/schema";
import {
  disablePasscode,
  hasPasscode,
  isEncryptionEnabled,
  setupPasscode,
} from "../db/crypto";
import { showPasscodeScreen } from "../components/passcode";
import { showToast } from "../components/toast";
import { exportAll, importAll } from "../db/repository";
import { db } from "../db/schema";
import { getTheme, setTheme, type Theme } from "../utils/theme";
import { isDummyModeEnabled, setDummyMode, showDummyScreen } from "./dummy";
import { navigate } from "../router";

export async function renderSettings(): Promise<HTMLElement> {
  const settings = await getSettings();

  const root = document.createElement("div");
  root.innerHTML = `
    <div class="app-card">
      <h2>🌷 周期の設定</h2>
      <div class="field">
        <label>平均周期長（日）</label>
        <input type="number" class="input" id="cycle-len" min="20" max="45" value="${settings.cycleLength}" />
      </div>
      <div class="field">
        <label>平均生理期間（日）</label>
        <input type="number" class="input" id="period-len" min="2" max="10" value="${settings.periodLength}" />
      </div>
      <div class="field">
        <label>リマインドする日数（生理予定日の何日前）</label>
        <input type="number" class="input" id="reminder-days" min="0" max="7" value="${settings.reminderDaysBefore}" />
      </div>
      <button class="btn btn-primary" id="save-settings">保存</button>
    </div>

    <div class="app-card">
      <h2>🎯 ライフモード</h2>
      <div class="segment" id="mode-seg">
        <button data-v="menstrual">月経管理</button>
        <button data-v="fertility">妊活</button>
        <button data-v="pregnant">妊娠中</button>
        <button data-v="junior">ジュニア</button>
      </div>
    </div>

    <div class="app-card">
      <h2>💊 ピル管理</h2>
      <p class="muted sub" style="margin-bottom: 12px;">毎日の服薬チェックと予定時刻設定。</p>
      <button class="btn btn-secondary" id="goto-pill">ピル管理画面を開く</button>
    </div>

    <div class="app-card">
      <h2>📄 医療機関向けレポート</h2>
      <p class="muted sub" style="margin-bottom: 12px;">記録データを印刷可能な形でまとめ、PDF保存もできます。</p>
      <button class="btn btn-secondary" id="goto-report">レポートを表示</button>
    </div>

    <div class="app-card">
      <h2>🎨 外観</h2>
      <div class="field">
        <label>テーマ</label>
        <div class="segment" id="theme-seg">
          <button data-v="light">ライト</button>
          <button data-v="dark">ダーク</button>
          <button data-v="system">自動</button>
        </div>
      </div>
    </div>

    <div class="app-card">
      <h2>🔐 セキュリティ</h2>
      <p class="muted sub" style="margin-bottom: 12px;">
        パスコードを設定すると、起動時にロック画面が表示され、メモなどが暗号化されます。
      </p>
      <div id="passcode-area"></div>

      <div class="field" style="margin-top: 20px;">
        <label class="flex" style="align-items:center; gap:8px;">
          <input type="checkbox" id="dummy-check" style="width:20px; height:20px;"/>
          <span>ダミーモードを有効化</span>
        </label>
        <p class="muted sub" style="margin-top:4px;">
          有効にすると、ロック解除時に電卓風の画面に切り替わります。「＝」を3秒長押しで戻ります。
        </p>
        <button class="btn btn-secondary mt-2" id="preview-dummy">プレビュー</button>
      </div>
    </div>

    <div class="app-card">
      <h2>💾 データのバックアップ</h2>
      <p class="muted sub" style="margin-bottom: 12px;">
        全データのエクスポート／別端末からのインポートができます。
      </p>
      <div class="flex gap-2" style="flex-wrap:wrap;">
        <button class="btn btn-secondary" id="export-btn">エクスポート</button>
        <button class="btn btn-secondary" id="import-btn">インポート</button>
      </div>
      <input type="file" id="import-file" accept="application/json" style="display:none;" />
    </div>

    <div class="app-card" style="border-color: var(--color-danger); background: var(--color-surface-soft);">
      <h2 style="color: var(--color-danger);">⚠️ 危険ゾーン</h2>
      <p class="muted sub" style="margin-bottom: 12px;">
        すべての記録を削除します。バックアップを取ってから実行してください。
      </p>
      <button class="btn btn-secondary" id="wipe-btn" style="color: var(--color-danger);">すべて削除</button>
    </div>

    <div class="app-card">
      <h2>ℹ️ Cycli について</h2>
      <p class="muted sub">
        Cycli はオフラインで動作する生理周期管理PWAです。<br>
        本アプリは医療機器ではなく、医療判断には使えません。<br>
        体調に不安があるときは医療機関にご相談ください。
      </p>
    </div>
  `;

  // ----- 周期設定保存 -----
  (root.querySelector("#save-settings") as HTMLElement).addEventListener("click", async () => {
    const cl = parseInt((root.querySelector("#cycle-len") as HTMLInputElement).value, 10);
    const pl = parseInt((root.querySelector("#period-len") as HTMLInputElement).value, 10);
    const rd = parseInt((root.querySelector("#reminder-days") as HTMLInputElement).value, 10);
    await updateSettings({
      cycleLength: isNaN(cl) ? settings.cycleLength : cl,
      periodLength: isNaN(pl) ? settings.periodLength : pl,
      reminderDaysBefore: isNaN(rd) ? settings.reminderDaysBefore : rd,
    });
    showToast("設定を保存しました");
  });

  // ----- モード -----
  const modeSeg = root.querySelector("#mode-seg") as HTMLElement;
  modeSeg.querySelectorAll("button").forEach((b) => {
    const v = (b as HTMLElement).dataset.v;
    b.classList.toggle("active", v === settings.mode);
    b.addEventListener("click", async () => {
      modeSeg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      await updateSettings({ mode: v as LifeMode });
      showToast("モードを切り替えました");
    });
  });

  // ----- ピル / レポート -----
  root.querySelector("#goto-pill")?.addEventListener("click", () => navigate("pill"));
  root.querySelector("#goto-report")?.addEventListener("click", () => navigate("report"));

  // ----- テーマ -----
  const themeSeg = root.querySelector("#theme-seg") as HTMLElement;
  const currentTheme = getTheme();
  themeSeg.querySelectorAll("button").forEach((b) => {
    const v = (b as HTMLElement).dataset.v as Theme;
    b.classList.toggle("active", v === currentTheme);
    b.addEventListener("click", () => {
      themeSeg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      setTheme(v);
      showToast("テーマを変更しました");
    });
  });

  // ----- パスコード -----
  function renderPasscodeArea(): void {
    const area = root.querySelector("#passcode-area") as HTMLElement;
    if (hasPasscode() && isEncryptionEnabled()) {
      area.innerHTML = `
        <p>✅ パスコードが設定されています</p>
        <button class="btn btn-secondary mt-2" id="disable-pc">パスコードを解除する</button>
      `;
      area.querySelector("#disable-pc")?.addEventListener("click", () => {
        showPasscodeScreen({
          mode: "unlock",
          title: "現在のパスコードを入力",
          onSubmit: async (pc) => disablePasscode(pc),
          onSuccess: () => {
            showToast("パスコードを解除しました");
            renderPasscodeArea();
          },
        });
      });
    } else {
      area.innerHTML = `
        <button class="btn btn-primary" id="setup-pc">パスコードを設定する</button>
      `;
      area.querySelector("#setup-pc")?.addEventListener("click", () => {
        showPasscodeScreen({
          mode: "setup",
          title: "パスコードを設定",
          hint: "4桁の数字を入力してください",
          onSubmit: async (pc) => {
            await setupPasscode(pc);
            return true;
          },
          onSuccess: () => {
            showToast("パスコードを設定しました🔐");
            renderPasscodeArea();
          },
        });
      });
    }
  }
  renderPasscodeArea();

  // ----- ダミーモード -----
  const dummyCheck = root.querySelector("#dummy-check") as HTMLInputElement;
  dummyCheck.checked = isDummyModeEnabled();
  dummyCheck.addEventListener("change", () => {
    setDummyMode(dummyCheck.checked);
    showToast(dummyCheck.checked ? "ダミーモードを有効化しました" : "ダミーモードを無効化しました");
  });
  root.querySelector("#preview-dummy")?.addEventListener("click", () => {
    showDummyScreen(() => {
      showToast("ダミー画面のテスト完了");
    });
  });

  // ----- エクスポート -----
  // Why: iOS PWA standalone モードでは <a download> が機能しないため、
  //      navigator.share がある環境ではそれを優先する。
  (root.querySelector("#export-btn") as HTMLElement).addEventListener("click", async () => {
    const data = await exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `cycli-backup-${dateStr}.json`;

    type FileShareNav = Navigator & { canShare?: (data: ShareData) => boolean };
    const nav: FileShareNav = navigator;
    if (
      typeof nav.canShare === "function" &&
      typeof navigator.share === "function"
    ) {
      const file = new File([blob], filename, { type: "application/json" });
      if (nav.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Cycli バックアップ" });
          showToast("エクスポートしました📦");
          return;
        } catch (err) {
          // ユーザがキャンセルした場合などは黙って fallback
          if (err instanceof Error && err.name === "AbortError") return;
        }
      }
    }
    // 通常のダウンロード
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("エクスポートしました📦");
  });

  // ----- インポート -----
  const importFile = root.querySelector("#import-file") as HTMLInputElement;
  root.querySelector("#import-btn")?.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    if (!confirm("既存のデータは上書きされます。続けますか？")) {
      importFile.value = "";
      return;
    }
    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      const result = await importAll(json);
      if (result.ok) {
        const total =
          result.imported.periods +
          result.imported.bbt +
          result.imported.weight +
          result.imported.symptoms +
          result.imported.notes +
          result.imported.pills +
          result.imported.lifestyle;
        showToast(`${total}件のレコードを取り込みました`);
      } else {
        showToast(`失敗: ${result.error ?? "不明"}`);
      }
    } catch (err) {
      showToast(`読み込み失敗: ${err instanceof Error ? err.message : ""}`);
    }
    importFile.value = "";
  });

  // ----- 全削除 -----
  root.querySelector("#wipe-btn")?.addEventListener("click", async () => {
    if (!confirm("本当にすべてのデータを削除しますか？元に戻せません。")) return;
    if (!confirm("もう一度確認します。すべての記録が消えます。")) return;
    await Promise.all([
      db.periods.clear(),
      db.bbt.clear(),
      db.weight.clear(),
      db.symptoms.clear(),
      db.notes.clear(),
      db.pills.clear(),
      db.lifestyle.clear(),
    ]);
    showToast("データを削除しました");
    window.dispatchEvent(new Event("cycli:rerender"));
  });

  return root;
}
