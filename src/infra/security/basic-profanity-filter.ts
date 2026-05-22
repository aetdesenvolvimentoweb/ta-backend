import type { IProfanityFilter } from "../../core/ports/profanity-filter.port";

const DEFAULT_STEMS = [
  "caralh",
  "porra",
  "merda",
  "foda",
  "fude",
  "puta",
  "putar",
  "cuzao",
  "bunda",
  "piranha",
  "vagabund",
  "fdp",
  "arrombad",
  "corno",
  "viad",
  "bicha",
  "desgracad",
  "imbecil",
  "idiota",
  "otario",
  "babaca",
  "cretino",
  "escrot",
  "puto",
];

const stripAccents = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Filtro PT-BR baseado em lista de stems (RN08).
 * Comparação resistente a acentos e case. Limitado por design: para resistir a
 * leetspeak/obfuscação ("p0rr@"), avaliar lib dedicada no futuro.
 */
export class BasicProfanityFilter implements IProfanityFilter {
  private readonly patterns: RegExp[];

  constructor(extraStems: string[] = []) {
    const stems = [...DEFAULT_STEMS, ...extraStems].map((s) => stripAccents(s).toLowerCase());
    this.patterns = stems.map((stem) => new RegExp(`\\b${stem}\\w{0,3}\\b`, "giu"));
  }

  contains(text: string): boolean {
    const haystack = stripAccents(text).toLowerCase();
    return this.patterns.some((rx) => {
      rx.lastIndex = 0;
      return rx.test(haystack);
    });
  }

  clean(text: string): string {
    // Estratégia: trabalhar sobre a versão normalizada (sem acentos) — perde
    // acentos do usuário mas mantém alinhamento de offsets simples e correto.
    let result = stripAccents(text);
    for (const rx of this.patterns) {
      result = result.replace(rx, (match) => "*".repeat(match.length));
    }
    return result;
  }
}
