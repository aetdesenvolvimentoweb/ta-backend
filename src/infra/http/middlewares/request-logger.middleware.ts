import { Elysia } from "elysia";
import { AppError } from "../../../core/errors/app-error";
import type { ILogger } from "../../../core/ports/logger.port";

const SKIP_EXACT = new Set(["/", "/health"]);
const SKIP_PREFIX = ["/docs"];

function shouldSkip(pathname: string): boolean {
  if (SKIP_EXACT.has(pathname)) return true;
  for (const prefix of SKIP_PREFIX) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Logger estruturado de requisições HTTP para métricas RED
 * (Rate, Errors, Duration). Emite um registro Pino por requisição:
 *   { event: "http.request", method, path, status, durationMs }
 *
 * Probes de infra (`/`, `/health`, `/docs/*`) são ignorados para não
 * poluir o log com o tráfego do UptimeRobot e do Swagger.
 *
 * Agregação (rate/p95) é feita downstream (Pino → stdout → plataforma de logs).
 */
export function requestLogger(logger: ILogger) {
  const startTimes = new WeakMap<Request, number>();

  function emit(request: Request, set: { status?: number | string }, err?: unknown) {
    const url = new URL(request.url);
    if (shouldSkip(url.pathname)) return;

    const start = startTimes.get(request);
    const durationMs = start != null ? Date.now() - start : -1;
    // O onError global do request-logger roda ANTES do onError do v1Router setar
    // set.status — então, para AppError, lemos o status diretamente do erro.
    // Sem isso, erros de negócio (401/403/404) aparecem como 500 e poluem as métricas RED.
    const status =
      typeof set.status === "number"
        ? set.status
        : err instanceof AppError
          ? err.statusCode
          : err != null
            ? 500
            : 200;

    const context = {
      event: "http.request",
      method: request.method,
      path: url.pathname,
      status,
      durationMs,
    };

    if (err != null || status >= 500) {
      logger.error("http.request", err, context);
    } else if (status >= 400) {
      logger.warn("http.request", context);
    } else {
      logger.info("http.request", context);
    }
  }

  return new Elysia({ name: "request-logger" })
    .onRequest(({ request }) => {
      startTimes.set(request, Date.now());
    })
    .onAfterHandle({ as: "global" }, ({ request, set }) => {
      emit(request, set);
    })
    .onError({ as: "global" }, ({ request, set, error }) => {
      emit(request, set, error);
    });
}
