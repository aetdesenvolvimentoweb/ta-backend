/**
 * Helpers de PKCE (RFC 7636) para o fluxo OAuth.
 *
 * Mercado Pago aceita PKCE para clientes confidenciais como defesa em profundidade
 * contra interceptação do `code` no redirect.
 */

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** code_verifier: 32 bytes aleatórios em base64url (43 chars). */
export function generateCodeVerifier(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** code_challenge = base64url(SHA256(code_verifier)). */
export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  );
  return bytesToBase64Url(digest);
}

/** state OAuth: 32 bytes aleatórios em base64url. */
export function generateOAuthState(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}
