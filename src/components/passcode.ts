/**
 * パスコード入力画面（初期設定 / 解錠 / 解除）
 * - 4〜6桁の数字パスコード
 * - 入力中はドットで表示
 */

export interface PasscodeOptions {
  /** "setup" 初期設定（再入力で確認） | "unlock" 解錠 */
  mode: "setup" | "unlock";
  title?: string;
  hint?: string;
  /** 検証関数。trueなら成功、falseなら失敗（unlock時に使う） */
  onSubmit: (passcode: string) => Promise<boolean>;
  /** 成功時 */
  onSuccess: () => void;
  /** スキップを許可するか（初期設定でスキップ可） */
  allowSkip?: boolean;
  onSkip?: () => void;
}

const PASSCODE_LENGTH = 4;

export function showPasscodeScreen(opts: PasscodeOptions): void {
  const root = document.createElement("div");
  root.className = "passcode-screen";

  const title = document.createElement("div");
  title.className = "passcode-title";

  const dots = document.createElement("div");
  dots.className = "passcode-dots";

  const hint = document.createElement("div");
  hint.className = "passcode-hint";
  hint.textContent = opts.hint ?? "";

  const keys = document.createElement("div");
  keys.className = "passcode-keys";

  document.body.appendChild(root);
  root.appendChild(title);
  root.appendChild(dots);
  root.appendChild(hint);
  root.appendChild(keys);

  // state
  let input = "";
  let firstInput: string | null = null; // setup時の1回目
  let stage: "first" | "confirm" = "first";

  function renderDots(): void {
    dots.innerHTML = "";
    for (let i = 0; i < PASSCODE_LENGTH; i++) {
      const d = document.createElement("div");
      d.className = "passcode-dot" + (i < input.length ? " filled" : "");
      dots.appendChild(d);
    }
  }

  function renderTitle(): void {
    if (opts.mode === "setup") {
      title.textContent =
        stage === "first"
          ? (opts.title ?? "パスコードを設定")
          : "もう一度入力して確認";
    } else {
      title.textContent = opts.title ?? "パスコードを入力";
    }
  }

  function setHint(message: string): void {
    hint.textContent = message;
  }

  async function handleComplete(): Promise<void> {
    if (opts.mode === "setup") {
      if (stage === "first") {
        firstInput = input;
        input = "";
        stage = "confirm";
        renderTitle();
        renderDots();
        setHint("");
        return;
      }
      // confirm
      if (input !== firstInput) {
        setHint("一致しません。最初からやり直してください。");
        input = "";
        firstInput = null;
        stage = "first";
        renderTitle();
        renderDots();
        return;
      }
      const ok = await opts.onSubmit(input);
      if (ok) {
        root.remove();
        opts.onSuccess();
      } else {
        setHint("設定に失敗しました。");
      }
    } else {
      // unlock
      const ok = await opts.onSubmit(input);
      if (ok) {
        root.remove();
        opts.onSuccess();
      } else {
        setHint("パスコードが違います。");
        input = "";
        renderDots();
      }
    }
  }

  function press(value: string): void {
    if (value === "del") {
      input = input.slice(0, -1);
      renderDots();
      return;
    }
    if (input.length >= PASSCODE_LENGTH) return;
    input += value;
    renderDots();
    if (input.length === PASSCODE_LENGTH) {
      void handleComplete();
    }
  }

  // テンキー
  const layout: Array<{ label: string; value: string } | null> = [
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
    { label: "4", value: "4" },
    { label: "5", value: "5" },
    { label: "6", value: "6" },
    { label: "7", value: "7" },
    { label: "8", value: "8" },
    { label: "9", value: "9" },
    null,
    { label: "0", value: "0" },
    { label: "⌫", value: "del" },
  ];
  for (const item of layout) {
    if (item === null) {
      const filler = document.createElement("span");
      keys.appendChild(filler);
      continue;
    }
    const b = document.createElement("button");
    b.textContent = item.label;
    b.addEventListener("click", () => press(item.value));
    keys.appendChild(b);
  }

  if (opts.allowSkip === true) {
    const skip = document.createElement("button");
    skip.className = "btn btn-secondary";
    skip.style.marginTop = "16px";
    skip.textContent = "あとで設定する";
    skip.addEventListener("click", () => {
      root.remove();
      opts.onSkip?.();
    });
    root.appendChild(skip);
  }

  renderTitle();
  renderDots();
}
