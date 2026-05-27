import type { IEmailService, SendEmailInput } from "../../core/ports/email-service.port";
import type { ILogger } from "../../core/ports/logger.port";

/**
 * Adapter para envio de e-mails via Resend (https://resend.com).
 *
 * Usamos `fetch` direto contra a API REST em vez do SDK oficial para evitar mais
 * uma dependência — a superfície é trivial (um POST autenticado).
 */
export class ResendEmailService implements IEmailService {
  private readonly endpoint = "https://api.resend.com/emails";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly logger: ILogger
  ) {}

  async send(input: SendEmailInput): Promise<void> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "<sem corpo>");
      this.logger.error("Falha ao enviar e-mail via Resend", undefined, {
        event: "email.send.failed",
        status: res.status,
        body,
        subject: input.subject,
      });
      throw new Error(`Resend retornou ${res.status}: ${body}`);
    }
  }
}
