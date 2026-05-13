/**
 * Web Crypto API を使ったAES-GCM暗号化レイヤー
 * - パスコードから PBKDF2 で鍵を導出
 * - 各レコードフィールドを暗号化文字列として保存
 * - パスコード未設定時は「平文」モード（ローカルストレージにフラグで管理）
 *
 * Why: IndexedDB のデータは他のWebサイトから読めないが、
 *      開発者ツールや端末のフォレンジック対策として暗号化する。
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_KEY = "cycli.salt";
const PASSCODE_HASH_KEY = "cycli.passcodeHash";
const ENCRYPTION_ENABLED_KEY = "cycli.encryptionEnabled";

let cachedKey: CryptoKey | null = null;

/**
 * ランダム Uint8Array
 * Why: TypeScript 5.7+ では Uint8Array が ArrayBufferLike を取り得るが、
 *      WebCrypto API は ArrayBuffer 限定なので明示的に固定する。
 */
function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(arr);
  return arr;
}

/** Uint8Array → Base64 */
function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(s);
}

/** Base64 → Uint8Array (ArrayBuffer 固定) */
function b64ToBuf(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

/** salt の取得（無ければ生成して保存） */
function getOrCreateSalt(): Uint8Array<ArrayBuffer> {
  const stored = localStorage.getItem(SALT_KEY);
  if (stored !== null) {
    return b64ToBuf(stored);
  }
  const salt = randomBytes(16);
  localStorage.setItem(SALT_KEY, bufToB64(salt));
  return salt;
}

/** パスコードから鍵を導出 */
async function deriveKey(passcode: string): Promise<CryptoKey> {
  const salt = getOrCreateSalt();
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** パスコードのハッシュ（照合用 / 鍵そのものは保存しない） */
async function hashPasscode(passcode: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = getOrCreateSalt();
  const passBytes = enc.encode(passcode);
  const data = new Uint8Array(new ArrayBuffer(salt.length + passBytes.length));
  data.set(salt, 0);
  data.set(passBytes, salt.length);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bufToB64(hash);
}

/** 暗号化が有効か */
export function isEncryptionEnabled(): boolean {
  return localStorage.getItem(ENCRYPTION_ENABLED_KEY) === "true";
}

/** パスコードが設定されているか */
export function hasPasscode(): boolean {
  return localStorage.getItem(PASSCODE_HASH_KEY) !== null;
}

/** パスコード設定 */
export async function setupPasscode(passcode: string): Promise<void> {
  if (passcode.length < 4) {
    throw new Error("パスコードは4桁以上で設定してください");
  }
  const hash = await hashPasscode(passcode);
  localStorage.setItem(PASSCODE_HASH_KEY, hash);
  localStorage.setItem(ENCRYPTION_ENABLED_KEY, "true");
  cachedKey = await deriveKey(passcode);
}

/** パスコード検証 + 鍵キャッシュ */
export async function unlockWithPasscode(passcode: string): Promise<boolean> {
  const storedHash = localStorage.getItem(PASSCODE_HASH_KEY);
  if (storedHash === null) return false;
  const inputHash = await hashPasscode(passcode);
  if (inputHash !== storedHash) return false;
  cachedKey = await deriveKey(passcode);
  return true;
}

/** ロック（メモリから鍵を消す） */
export function lock(): void {
  cachedKey = null;
}

/** ロック状態か */
export function isLocked(): boolean {
  return isEncryptionEnabled() && cachedKey === null;
}

/** パスコード解除（暗号化機能を無効化） */
export async function disablePasscode(passcode: string): Promise<boolean> {
  const ok = await unlockWithPasscode(passcode);
  if (!ok) return false;
  localStorage.removeItem(PASSCODE_HASH_KEY);
  localStorage.setItem(ENCRYPTION_ENABLED_KEY, "false");
  cachedKey = null;
  return true;
}

/** 文字列を暗号化（パスコード未設定時はそのまま返す） */
export async function encryptText(plain: string): Promise<string> {
  if (!isEncryptionEnabled()) return plain;
  if (cachedKey === null) {
    throw new Error("ロックされています。パスコードを入力してください。");
  }
  const iv = randomBytes(12);
  const enc = new TextEncoder();
  // ArrayBuffer 固定のために再ラップ
  const plainBytes = new Uint8Array(new ArrayBuffer(enc.encode(plain).length));
  plainBytes.set(enc.encode(plain));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cachedKey,
    plainBytes,
  );
  return `v1:${bufToB64(iv)}:${bufToB64(cipherBuf)}`;
}

/** 文字列を復号 */
export async function decryptText(payload: string): Promise<string> {
  // 暗号化されていない（平文）と判定
  if (!payload.startsWith("v1:")) return payload;
  if (cachedKey === null) {
    throw new Error("ロックされています。パスコードを入力してください。");
  }
  const parts = payload.split(":");
  const ivStr = parts[1] ?? "";
  const cipherStr = parts[2] ?? "";
  const iv = b64ToBuf(ivStr);
  const cipher = b64ToBuf(cipherStr);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cachedKey,
    cipher,
  );
  return new TextDecoder().decode(plainBuf);
}

/** オブジェクトを暗号化（JSON経由） */
export async function encryptObject(obj: unknown): Promise<string> {
  return encryptText(JSON.stringify(obj));
}

/** オブジェクトを復号 */
export async function decryptObject<T>(payload: string): Promise<T> {
  const text = await decryptText(payload);
  return JSON.parse(text) as T;
}
