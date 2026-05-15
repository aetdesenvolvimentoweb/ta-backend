/**
 * Port para filtragem de conteúdo ofensivo em mensagens públicas (RN08).
 */
export interface IProfanityFilter {
  /**
   * Retorna o texto com palavras ofensivas substituídas por máscara.
   */
  clean(text: string): string;

  /**
   * Indica se o texto contém alguma palavra ofensiva.
   */
  contains(text: string): boolean;
}
