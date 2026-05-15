import { UnauthorizedError } from "../../core/errors/app-error";

/**
 * Entrada do state store: o que precisa atravessar a dança OAuth.
 * - `artistId`: a quem essa autorização pertence (CSRF-proof + binding ao usuário logado).
 * - `codeVerifier`: PKCE — usado na troca pelo token.
 * - `gateway`: qual adapter resolveu o início do fluxo.
 * - `expiresAt`: TTL curto (~10 min) — autorização OAuth tem que ser rápida.
 */
export interface OAuthStateEntry {
  artistId: string;
  gateway: string;
  codeVerifier: string;
  expiresAt: number;
}

export interface IOAuthStateStore {
  put(state: string, entry: Omit<OAuthStateEntry, 'expiresAt'>): void;
  /** Consome (one-shot) o state. Lança `UnauthorizedError` se inválido/expirado. */
  consume(state: string): OAuthStateEntry;
  /** Limpeza periódica (chamada pelo scheduler interno; idempotente). */
  sweep(now?: number): void;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

/**
 * Armazenamento in-memory para o `state` OAuth.
 * Para >1 instância de backend, trocar por Redis sem mudar o contrato.
 */
export class InMemoryOAuthStateStore implements IOAuthStateStore {
  private readonly map = new Map<string, OAuthStateEntry>();
  private sweeper?: ReturnType<typeof setInterval>;

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  startSweeper(intervalMs: number = 60_000): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.sweep(), intervalMs);
    // Não impedir o shutdown do processo por causa do timer.
    if (typeof (this.sweeper as any).unref === 'function') (this.sweeper as any).unref();
  }

  stopSweeper(): void {
    if (this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = undefined;
    }
  }

  put(state: string, entry: Omit<OAuthStateEntry, 'expiresAt'>): void {
    this.map.set(state, { ...entry, expiresAt: Date.now() + this.ttlMs });
  }

  consume(state: string): OAuthStateEntry {
    const entry = this.map.get(state);
    if (!entry) {
      throw new UnauthorizedError("state OAuth inválido ou já consumido.");
    }
    this.map.delete(state);
    if (Date.now() > entry.expiresAt) {
      throw new UnauthorizedError("state OAuth expirado. Reinicie a conexão.");
    }
    return entry;
  }

  sweep(now: number = Date.now()): void {
    for (const [k, v] of this.map) {
      if (now > v.expiresAt) this.map.delete(k);
    }
  }
}
