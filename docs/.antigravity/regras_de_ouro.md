# Regras de Ouro - Toque Aquela

## Arquitetura e Código
1.  **Independência de Framework**: A lógica de negócio (core/application) nunca deve depender do ElysiaJS ou do Drizzle. Use Ports (Interfaces).
2.  **Value Objects**: Sempre use VOs para validação de dados complexos (Email, Money, etc.). Se não for um VO válido, o erro deve ser lançado no construtor.
3.  **Tratamento de Erros**: Nunca lance erros genéricos. Use as subclasses de `AppError` (`BusinessRuleError`, `NotFoundError`, `UnauthorizedError`).
4.  **Logging**: Todo Use Case deve injetar `ILogger` e registrar eventos críticos (sucessos e falhas de regra de negócio).

## Testes
5.  **Co-localização**: Testes unitários ficam junto ao código (`.test.ts`).
6.  **Integração**: Testes que tocam o banco de dados real devem usar o sufixo `.integration.test.ts`.
7.  **Isolação de Banco**: Testes de integração devem usar o banco `ta_test` e realizar `TRUNCATE` entre os testes.
8.  **Cobertura**: Manter 100% de cobertura de linhas nas camadas de Core e Application.

## Infraestrutura
9.  **Drizzle**: O schema do banco deve ser o reflexo fiel das entidades de domínio.
10. **Ambientes**: Nunca use credenciais de produção em desenvolvimento. Use `.env` e `.env.test`.
