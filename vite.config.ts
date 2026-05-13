import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";

/**
 * Cycli Vite設定
 * - GitHub Pagesでは /cycli/ サブパスに配置される
 * - PWAプラグインで Service Worker と manifest を自動生成
 * - 複数ページ構成（ランディング + アプリ）
 */
export default defineConfig({
  // GitHub Pagesでのサブパス配信
  base: process.env.GITHUB_PAGES === "true" ? "/cycli/" : "/",

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  build: {
    rollupOptions: {
      input: {
        // ランディングページ
        main: resolve(__dirname, "index.html"),
        // アプリ本体
        app: resolve(__dirname, "app.html"),
      },
    },
    target: "es2022",
    sourcemap: false,
  },

  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable.png",
        "icons/apple-touch-icon.png",
      ],
      manifest: {
        // 日本語のアプリ名
        name: "Cycli - 生理周期管理",
        short_name: "Cycli",
        description:
          "オフラインで動作する生理周期管理アプリ。生理・排卵・PMS・ダイエット期を予測し、体調を記録できます。",
        theme_color: "#F8BBD0",
        background_color: "#FFF8F9",
        display: "standalone",
        orientation: "portrait",
        scope: "./",
        start_url: "./app.html",
        lang: "ja",
        dir: "ltr",
        categories: ["health", "lifestyle", "medical"],
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
        screenshots: [
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            form_factor: "narrow",
            label: "Cycliアプリ画面",
          },
        ],
      },
      workbox: {
        // オフライン時にもアプリ全体が動くようプリキャッシュ
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,woff2}"],
        navigateFallback: "/app.html",
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
