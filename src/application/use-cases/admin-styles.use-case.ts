import { BusinessRuleError, NotFoundError } from "../../core/errors/app-error";
import type { IStyleRepository, Style } from "../../core/ports/style.repository";
import type { ILogger } from "../../core/ports/logger.port";

/**
 * Caso de Uso: Criar um estilo musical oficial (Admin).
 */
export class CreateStyleUseCase {
  constructor(
    private styleRepository: IStyleRepository,
    private logger: ILogger
  ) {}

  async execute(name: string): Promise<Style> {
    const existing = await this.styleRepository.findByName(name);
    if (existing) {
      throw new BusinessRuleError("Este estilo já existe.");
    }

    const style: Style = {
      id: crypto.randomUUID(),
      name: name.trim()
    };

    await this.styleRepository.save(style);
    this.logger.info(`Novo estilo musical criado: ${style.name}`);
    return style;
  }
}

/**
 * Caso de Uso: Unificar estilos redundantes (RN10).
 * Exemplo: Unificar "Rock Roll" em "Rock".
 */
export class MergeStylesUseCase {
  constructor(
    private styleRepository: IStyleRepository,
    private logger: ILogger
  ) {}

  async execute(sourceStyleId: string, targetStyleId: string): Promise<void> {
    // 1. Validar existência dos dois
    const source = await this.styleRepository.findById(sourceStyleId);
    const target = await this.styleRepository.findById(targetStyleId);

    if (!source || !target) {
      throw new NotFoundError("Um ou ambos os estilos não foram encontrados.");
    }

    // 2. Chamar o repositório para atualizar as referências (RN10)
    // Na infra, isso faria um UPDATE em todas as músicas que usam sourceId para targetId
    await this.styleRepository.mergeStyles(sourceStyleId, targetStyleId);

    // 3. Deletar o estilo redundante
    await this.styleRepository.delete(sourceStyleId);
  }
}
