import { BusinessRuleError } from "../../core/errors/app-error";
import type {
  IPaymentGateway,
  IPaymentGatewayRegistry,
} from "../../core/ports/payment-gateway.port";
import type { PaymentGatewayName } from "../../core/value-objects/payment-account.vo";

/**
 * Registry simples baseado em Map. Resolve adapters por nome (RN14).
 * Adicionar Stripe/Pagar.me = `registry.register(new StripeGateway(...))`. Zero mudança em use cases.
 */
export class PaymentGatewayRegistry implements IPaymentGatewayRegistry {
  private readonly gateways = new Map<PaymentGatewayName, IPaymentGateway>();

  register(gateway: IPaymentGateway): void {
    this.gateways.set(gateway.name, gateway);
  }

  get(name: PaymentGatewayName): IPaymentGateway {
    const gw = this.gateways.get(name);
    if (!gw) {
      throw new BusinessRuleError(`Gateway de pagamento não registrado: ${name}`);
    }
    return gw;
  }

  list(): readonly PaymentGatewayName[] {
    return [...this.gateways.keys()];
  }
}
