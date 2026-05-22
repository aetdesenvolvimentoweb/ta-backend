/**
 * Criptografia AES-256-GCM para tokens OAuth em repouso (RN17/22).
 *
 * Formato de armazenamento: base64( iv (12B) || ciphertext || authTag (16B) ).
 * A chave (32 bytes) vem de `env.PAYMENT_TOKEN_KEY` (hex 64 chars).
 *
 * Por que GCM: AEAD nativo (autenticidade + confidencialidade num só primitive),
 * resistente a ataques de manipulação do ciphertext.
 */
export interface ITokenCipher {
  encrypt(plaintext: string): Promise<string>;
  decrypt(payload: string): Promise<string>;
}

const IV_BYTES = 12;

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class AesGcmTokenCipher implements ITokenCipher {
  private readonly keyPromise: Promise<CryptoKey>;

  constructor(hexKey: string) {
    if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
      throw new Error("AesGcmTokenCipher: a chave deve ser hex de 64 chars (32 bytes).");
    }
    const raw = hexToBytes(hexKey);
    this.keyPromise = crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  }

  async encrypt(plaintext: string): Promise<string> {
    const key = await this.keyPromise;
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const data = new TextEncoder().encode(plaintext);
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
    const out = new Uint8Array(iv.length + cipher.length);
    out.set(iv, 0);
    out.set(cipher, iv.length);
    return bytesToBase64(out);
  }

  async decrypt(payload: string): Promise<string> {
    const key = await this.keyPromise;
    const bytes = base64ToBytes(payload);
    if (bytes.length <= IV_BYTES) {
      throw new Error("AesGcmTokenCipher: payload corrompido.");
    }
    const iv = bytes.slice(0, IV_BYTES);
    const cipher = bytes.slice(IV_BYTES);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(plain);
  }
}
