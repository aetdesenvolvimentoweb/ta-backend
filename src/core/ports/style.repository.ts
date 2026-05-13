/**
 * Representa um estilo musical.
 */
export interface Style {
  id: string;
  name: string;
}

/**
 * Interface de Repositório para os estilos musicais (Gerenciado pelo Admin).
 */
export interface IStyleRepository {
  save(style: Style): Promise<void>;
  findAll(): Promise<Style[]>;
  findById(id: string): Promise<Style | null>;
  findByName(name: string): Promise<Style | null>;
  delete(id: string): Promise<void>;
  /**
   * Unifica estilos duplicados (RN10).
   */
  mergeStyles(sourceId: string, targetId: string): Promise<void>;
}
