import { describe, expect, test } from "bun:test";
import { AesGcmTokenCipher } from "./token-cipher";

const KEY = "a".repeat(64); // 32 bytes em hex

describe("AesGcmTokenCipher", () => {
  test("deve cifrar e decifrar texto preservando o conteúdo", async () => {
    const cipher = new AesGcmTokenCipher(KEY);
    const plain = "APP_USR-5822004160789886-051510-a2a0c13ac7387e268ba05b95a84ad3d2-3404523644";
    const enc = await cipher.encrypt(plain);
    expect(enc).not.toBe(plain);
    expect(enc.length).toBeGreaterThan(plain.length);
    const dec = await cipher.decrypt(enc);
    expect(dec).toBe(plain);
  });

  test("dois encrypts do mesmo plaintext devem produzir ciphertexts distintos (IV aleatório)", async () => {
    const cipher = new AesGcmTokenCipher(KEY);
    const a = await cipher.encrypt("payload");
    const b = await cipher.encrypt("payload");
    expect(a).not.toBe(b);
  });

  test("decrypt em payload corrompido deve falhar (autenticidade GCM)", async () => {
    const cipher = new AesGcmTokenCipher(KEY);
    const enc = await cipher.encrypt("payload");
    const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "B=" : "A=");
    await expect(cipher.decrypt(tampered)).rejects.toThrow();
  });

  test("deve rejeitar chave hex inválida", () => {
    expect(() => new AesGcmTokenCipher("short")).toThrow("hex de 64 chars");
  });
});
