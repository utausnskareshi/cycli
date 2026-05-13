/**
 * 簡易トースト通知
 */

export function showToast(message: string, durationMs = 2000): void {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 200ms ease-out";
    setTimeout(() => el.remove(), 200);
  }, durationMs);
}
