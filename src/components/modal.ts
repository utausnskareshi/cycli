/**
 * モーダル（ボトムシート風）
 * - 中身は HTMLElement を受け取り、外側を組み立てる
 */

export interface ModalOptions {
  title: string;
  content: HTMLElement;
  onClose?: () => void;
}

export function openModal({ title, content, onClose }: ModalOptions): () => void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <div class="flex-between" style="margin-bottom: var(--space-3);">
      <h2>${escapeHtml(title)}</h2>
      <button class="icon-btn" aria-label="閉じる" style="font-size:20px;color:var(--color-text-sub);">✕</button>
    </div>
  `;
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => {
    onClose?.();
    overlay.remove();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  modal.querySelector(".icon-btn")?.addEventListener("click", close);

  return close;
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
