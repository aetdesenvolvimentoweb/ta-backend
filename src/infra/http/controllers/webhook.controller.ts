import { Elysia, t } from "elysia";
import type { ProcessPaymentNotificationUseCase } from "../../../application/use-cases/process-payment-notification.use-case";
import { BusinessRuleError } from "../../../core/errors/app-error";

/** Defesa em profundidade contra replay: rejeitar `ts` que difere demais do agora. */
const SIGNATURE_MAX_SKEW_MS = 5 * 60 * 1000;

/**
 * Valida a assinatura HMAC-SHA256 do Mercado Pago.
 *
 * Header x-signature: "ts=<ts>,v1=<hash>"
 * Template a assinar: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * Ref: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
async function verifyMercadoPagoSignature(
  secret: string,
  paymentId: string,
  xRequestId: string,
  xSignature: string
): Promise<void> {
  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => p.split("=") as [string, string])
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];

  if (!ts || !v1) {
    throw new BusinessRuleError("Assinatura do webhook ausente ou malformada.");
  }

  const tsMs = Number(ts);
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > SIGNATURE_MAX_SKEW_MS) {
    throw new BusinessRuleError("Assinatura do webhook expirada ou com timestamp inválido.");
  }

  const template = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(template));
  const computed = Buffer.from(signatureBuffer).toString("hex");

  const computedBytes = Buffer.from(computed, "hex");
  const receivedBytes = Buffer.from(v1, "hex");

  if (computedBytes.length !== receivedBytes.length) {
    throw new BusinessRuleError("Assinatura do webhook inválida.");
  }

  // Timing-safe comparison
  let diff = 0;
  for (let i = 0; i < computedBytes.length; i++) {
    diff |= computedBytes[i]! ^ receivedBytes[i]!;
  }
  if (diff !== 0) {
    throw new BusinessRuleError("Assinatura do webhook inválida.");
  }
}

export const webhookController = (
  processPaymentNotification: ProcessPaymentNotificationUseCase,
  webhookSecret: string
) =>
  new Elysia({ prefix: "/webhooks" })

    /**
     * Webhook do Mercado Pago — fonte autoritativa de status de pagamento (RN18).
     * Valida HMAC antes de processar. Retorna 200 em qualquer caso para evitar reenvios
     * de eventos ignorados (pagamentos de outros contextos).
     */
    .post(
      "/mercado-pago",
      async ({ body, headers }) => {
        if (body.type !== "payment" || !body.data?.id) {
          return { received: true };
        }

        const paymentId = String(body.data.id);
        const xRequestId = headers["x-request-id"] ?? "";
        const xSignature = headers["x-signature"] ?? "";

        if (webhookSecret && xSignature) {
          await verifyMercadoPagoSignature(webhookSecret, paymentId, xRequestId, xSignature);
        }

        // `user_id` (collector/seller) é necessário para resolver as credenciais
        // do artista e fetchar o payment no MP. Sem ele, ignoramos.
        const sellerExternalAccountId = body.user_id !== undefined ? String(body.user_id) : "";
        if (!sellerExternalAccountId) {
          return { received: true };
        }

        await processPaymentNotification.execute({
          paymentId,
          sellerExternalAccountId,
          gateway: "mercado_pago",
        });
        return { received: true };
      },
      {
        body: t.Object(
          {
            type: t.String(),
            user_id: t.Optional(t.Union([t.String(), t.Number()])),
            data: t.Optional(
              t.Object(
                {
                  id: t.Union([t.String(), t.Number()]),
                },
                { additionalProperties: true }
              )
            ),
          },
          { additionalProperties: true }
        ),
        detail: {
          summary: "Webhook de pagamento Mercado Pago",
          tags: ["Payment Account"],
        },
      }
    );
