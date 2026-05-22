import { Elysia, t } from "elysia";
import { adminMiddleware } from "../middlewares/admin.middleware";
import type { ValidateAdminWhitelistUseCase } from "../../../application/use-cases/admin-whitelist.use-case";
import type { CreateStyleUseCase, MergeStylesUseCase } from "../../../application/use-cases/admin-styles.use-case";
import type { GetAppMetricsUseCase } from "../../../application/use-cases/get-app-metrics.use-case";

export const adminController = (
  validateWhitelist: ValidateAdminWhitelistUseCase,
  createStyle: CreateStyleUseCase,
  mergeStyles: MergeStylesUseCase,
  getAppMetrics: GetAppMetricsUseCase
) =>
  new Elysia({ prefix: "/admin" })
    .use(adminMiddleware(validateWhitelist))

    .get("/me", async ({ ensureAdmin }) => {
      await ensureAdmin();
      return { isAdmin: true };
    }, {
      detail: {
        summary: "Verifica se o usuário autenticado é admin (RN12)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }]
      }
    })

    .get("/metrics", async ({ ensureAdmin }) => {
      await ensureAdmin();
      return await getAppMetrics.execute();
    }, {
      detail: {
        summary: "Métricas globais da plataforma (RN02)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }]
      }
    })

    .post("/styles", async ({ ensureAdmin, body }) => {
      await ensureAdmin();
      const style = await createStyle.execute(body.name);
      return style;
    }, {
      body: t.Object({ name: t.String({ minLength: 2, maxLength: 50 }) }),
      detail: {
        summary: "Criar estilo musical (Admin)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }]
      }
    })

    .post("/styles/merge", async ({ ensureAdmin, body }) => {
      await ensureAdmin();
      await mergeStyles.execute(body.sourceId, body.targetId);
      return { message: "Estilos unificados com sucesso." };
    }, {
      body: t.Object({
        sourceId: t.String({ format: "uuid" }),
        targetId: t.String({ format: "uuid" })
      }),
      detail: {
        summary: "Unificar estilos redundantes (RN10)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }]
      }
    });
