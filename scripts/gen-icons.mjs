/**
 * アイコンPNG生成スクリプト（外部依存なし）
 *
 * - Node.js 標準ライブラリだけで単色ベースのPNGを生成
 * - SVGロゴと同じ「ピンク背景+中央に白い円」のシンプルなデザイン
 * - 192/512/maskable(512余白付き)/apple-touch-icon(180) を出力
 *
 * Why: vite-plugin-pwa は manifest と SW を作るが、アイコン画像自体は
 *      事前に public/icons/ にPNGとして用意しておく必要がある。
 *      sharp/canvas などの重い依存を入れず、ビルドのたびに自動生成する。
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// --- 色定義 ---
const PINK = [248, 187, 208]; // #F8BBD0
const PINK_DARK = [206, 147, 216]; // #CE93D8 (グラデーション風に中央寄り)
const WHITE = [255, 255, 255];
const RED = [229, 115, 115]; // #E57373

// --- CRC32 ---
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = data.length;
  const typeBuf = Buffer.from(type, "ascii");
  const out = Buffer.alloc(8 + len + 4);
  out.writeUInt32BE(len, 0);
  typeBuf.copy(out, 4);
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  out.writeUInt32BE(crc, 8 + len);
  return out;
}

/**
 * RGB ピクセル配列からPNGバッファを生成
 * - pixels: 長さ width*height*3 のUint8Array
 */
function pixelsToPng(width, height, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // IDAT: 各行の先頭にフィルタバイト(0) を入れて連結
  const stride = width * 3;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + stride)] = 0; // filter: None
    pixels.copy
      ? pixels.copy(raw, y * (1 + stride) + 1, y * stride, (y + 1) * stride)
      : Buffer.from(pixels.subarray(y * stride, (y + 1) * stride)).copy(
          raw,
          y * (1 + stride) + 1,
        );
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * シンプルなアイコン画像を描画
 * - 角丸ピンクのグラデーション風背景
 * - 中央に白い円
 * - その中央に赤い小円
 *
 * maskable の場合は安全領域（padding）を多めに
 */
function drawIcon(size, { padding = 0, mask = false }) {
  const pixels = Buffer.alloc(size * size * 3);
  const cx = size / 2;
  const cy = size / 2;
  const cornerR = mask ? 0 : size * 0.2; // maskable は角丸無し（OSが自動で形状を切る）

  // 描画範囲（padding 引いた内側）
  const innerR = (size / 2 - padding) * 0.7; // 白い円の半径
  const dotR = innerR * 0.28; // 中央の赤い円

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 背景：角丸（mask=falseのとき）
      let inBg = true;
      if (!mask) {
        const rx = Math.abs(dx) - (size / 2 - cornerR);
        const ry = Math.abs(dy) - (size / 2 - cornerR);
        if (rx > 0 && ry > 0 && Math.sqrt(rx * rx + ry * ry) > cornerR) {
          inBg = false;
        }
      }

      // mask の場合は全領域を背景色（OSが丸く切り抜く前提）
      let r, g, b;
      if (!inBg) {
        // 透明色は対応していないため、白背景にする（角丸の外側）
        r = 255;
        g = 248;
        b = 249;
      } else {
        // 背景：左上→右下にピンク→ラベンダーのグラデーション風
        const t = (x + y) / (2 * size);
        const bgR = PINK[0] * (1 - t) + PINK_DARK[0] * t;
        const bgG = PINK[1] * (1 - t) + PINK_DARK[1] * t;
        const bgB = PINK[2] * (1 - t) + PINK_DARK[2] * t;

        // 中央の白い円
        if (dist < innerR) {
          r = WHITE[0];
          g = WHITE[1];
          b = WHITE[2];
        } else if (dist < innerR + 1) {
          // アンチエイリアス簡易
          const f = innerR + 1 - dist;
          r = WHITE[0] * f + bgR * (1 - f);
          g = WHITE[1] * f + bgG * (1 - f);
          b = WHITE[2] * f + bgB * (1 - f);
        } else {
          r = bgR;
          g = bgG;
          b = bgB;
        }

        // 中央の赤い小円
        if (dist < dotR) {
          r = RED[0];
          g = RED[1];
          b = RED[2];
        }
      }

      const i = (y * size + x) * 3;
      pixels[i] = Math.round(r);
      pixels[i + 1] = Math.round(g);
      pixels[i + 2] = Math.round(b);
    }
  }
  return pixelsToPng(size, size, pixels);
}

/** 出力 */
const targets = [
  { name: "icon-192.png", size: 192, padding: 0, mask: false },
  { name: "icon-512.png", size: 512, padding: 0, mask: false },
  // maskable は安全領域を確保するため余白を多めに
  { name: "icon-maskable.png", size: 512, padding: 64, mask: true },
  // apple-touch-icon は iOS Safari ホーム追加用
  { name: "apple-touch-icon.png", size: 180, padding: 0, mask: false },
];

console.log("Cycli アイコン生成中...");
for (const t of targets) {
  const buf = drawIcon(t.size, { padding: t.padding, mask: t.mask });
  writeFileSync(join(outDir, t.name), buf);
  console.log(`  ✓ ${t.name} (${t.size}x${t.size}, ${(buf.length / 1024).toFixed(1)} KB)`);
}
console.log("完了");
