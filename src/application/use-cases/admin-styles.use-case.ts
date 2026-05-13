import { IStyleRepository, Style } from "../../core/ports/style.repository";

/**
 * Caso de Uso: Criar um estilo musical oficial (Admin).
 */
export class CreateStyleUseCase {
  constructor(private styleRepository: IStyleRepository) {}

  async execute(name: string): Promise<Style> {
    const existing = await this.styleRepository.findByName(name);
    if (existing) {
      throw new Error("Este estilo já existe.");
    }

    const style: Style = {
      id: crypto.randomUUID(),
      name: name.trim()
    };

    await this.styleRepository.save(style);
    return style;
  }
}

/**
 * Caso de Uso: Unificar estilos redundantes (RN10).
 * Exemplo: Unificar "Rock Roll" em "Rock".
 */
export class MergeStylesUseCase {
  constructor(private styleRepository: IStyleRepository) {}

  async execute(sourceStyleId: string, targetStyleId: string): Promise<void> {
    // 1. Validar existência dos dois
    const source = await this.styleRepository.findById(sourceStyleId);
    const target = await this.styleRepository.findById(targetStyleId);

    if (!source || !target) {
      throw new Error("Um ou ambos os estilos não foram encontrados.");
    }

    // 2. Chamar o repositório para atualizar as referências (RN10)
    // Na infra, isso faria um UPDATE em todas as músicas que usam sourceId para targetId
    await this.styleRepository.mergeStyles(sourceStyleId, targetStyleId);

    // 3. Deletar o estilo redundante
    await this.styleRepository.delete(sourceStyleId);
  }
}
