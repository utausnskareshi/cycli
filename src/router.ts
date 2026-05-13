/**
 * 簡易ハッシュベースルーター
 * - ボトムナビとの相性が良い
 * - GitHub Pages のサブパス配信にも影響しない
 */

export type Route =
  | "home"
  | "calendar"
  | "record"
  | "stats"
  | "pill"
  | "report"
  | "settings";

export type RouteHandler = (route: Route) => void;

const ROUTES: Route[] = [
  "home",
  "calendar",
  "record",
  "stats",
  "pill",
  "report",
  "settings",
];

function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, "");
  if (ROUTES.includes(h as Route)) {
    return h as Route;
  }
  return "home";
}

const listeners = new Set<RouteHandler>();

export function getCurrentRoute(): Route {
  return parseHash();
}

export function navigate(route: Route): void {
  location.hash = `#/${route}`;
}

export function onRouteChange(handler: RouteHandler): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

export function initRouter(): void {
  const dispatch = () => {
    const r = parseHash();
    for (const fn of listeners) {
      fn(r);
    }
  };
  window.addEventListener("hashchange", dispatch);
  // 初期遷移
  if (!location.hash) {
    navigate("home");
  } else {
    // 初期描画用に1回だけ発火（マイクロタスクで）
    queueMicrotask(dispatch);
  }
}
