/**
 * Porta para envio de e-mails transacionais.
 * Implementações concretas (Resend, SES, SMTP) ficam em `infra/email/`.
 *
 * O port é minimalista por design: o domínio nunca conhece templates, headers ou
 * provedores — apenas pede "envie esse texto para esse endereço".
 */
export interface SendEmailInput {
  to: string;
  subject: string;
  /** Versão texto puro do e-mail. Sempre presente (clientes que não renderizam HTML). */
  text: string;
  /** Versão HTML opcional. */
  html?: string;
}

export interface IEmailService {
  send(input: SendEmailInput): Promise<void>;
}
