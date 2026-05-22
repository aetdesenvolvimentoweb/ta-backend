import { describe, expect, test } from "bun:test";
import { deriveCodeChallenge, generateCodeVerifier, generateOAuthState } from "./pkce";

describe("PKCE helpers", () => {
  test("generateCodeVerifier: 43 chars base64url sem padding", () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("dois verifiers devem ser distintos", () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  test("generateOAuthState: 43 chars base64url sem padding", () => {
    expect(generateOAuthState()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("deriveCodeChallenge: deve ser determinístico (SHA-256)", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"; // exemplo RFC 7636
    const challenge = await deriveCodeChallenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
