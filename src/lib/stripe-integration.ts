export interface StripeConfig {
  secretKey: string;
  publishableKey?: string;
  webhookSecret?: string;
}

export interface StripeSetupIntent {
  id: string;
  client_secret: string;
  status: string;
  customer: string;
}

export interface StripeCustomer {
  id: string;
  email: string;
  metadata: Record<string, string>;
  created: number;
}

export interface StripePaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customer: string;
  payment_method: string;
  metadata: Record<string, string>;
}

export interface StripePaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  customer: string | null;
}

interface StripeErrorResponse {
  error: {
    type: string;
    message: string;
    code?: string;
    decline_code?: string;
    param?: string;
  };
}

export class StripeAPIError extends Error {
  type: string;
  code?: string;
  param?: string;

  constructor(response: StripeErrorResponse["error"]) {
    super(response.message);
    this.name = "StripeAPIError";
    this.type = response.type;
    this.code = response.code;
    this.param = response.param;
  }
}

export class StripePaymentError extends Error {
  code: string;
  declineCode?: string;

  constructor(message: string, code: string, declineCode?: string) {
    super(message);
    this.name = "StripePaymentError";
    this.code = code;
    this.declineCode = declineCode;
  }
}

export class StripeAPI {
  private config: StripeConfig | null;
  private baseUrl = "https://api.stripe.com/v1";

  constructor(secretKey?: string) {
    const key = secretKey ?? process.env["STRIPE_SECRET_KEY"];
    if (!key) {
      console.warn(
        "⚠ STRIPE_SECRET_KEY not set — payment features will be skipped",
      );
      this.config = null;
      return;
    }

    this.config = { secretKey: key };
  }

  get isConfigured(): boolean {
    return this.config !== null;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.config) {
      throw new Error("Stripe is not configured — missing secret key");
    }

    const url = `${this.baseUrl}${path}`;
    const credentials = Buffer.from(`${this.config.secretKey}:`).toString("base64");
    const headers: Record<string, string> = {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    let encodedBody: string | undefined;
    if (body) {
      encodedBody = this.encodeFormData(body);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: encodedBody,
    });

    const data = (await response.json()) as T | StripeErrorResponse;

    if (!response.ok) {
      const errorData = data as StripeErrorResponse;
      if (errorData.error) {
        if (errorData.error.type === "card_error") {
          throw new StripePaymentError(
            errorData.error.message,
            errorData.error.code ?? "card_error",
            errorData.error.decline_code,
          );
        }
        throw new StripeAPIError(errorData.error);
      }
      throw new Error(`Stripe API error: ${response.statusText}`);
    }

    return data as T;
  }

  private encodeFormData(
    data: Record<string, unknown>,
    prefix = "",
  ): string {
    const params: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;

      const fullKey = prefix ? `${prefix}[${key}]` : key;

      if (typeof value === "object" && !Array.isArray(value)) {
        params.push(this.encodeFormData(value as Record<string, unknown>, fullKey));
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === "object") {
            params.push(
              this.encodeFormData(item as Record<string, unknown>, `${fullKey}[${index}]`),
            );
          } else {
            params.push(`${encodeURIComponent(`${fullKey}[${index}]`)}=${encodeURIComponent(String(item))}`);
          }
        });
      } else {
        params.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
      }
    }

    return params.filter(Boolean).join("&");
  }

  async createCustomer(
    email: string,
    metadata: { github_username: string },
  ): Promise<StripeCustomer> {
    return this.request<StripeCustomer>("POST", "/customers", {
      email,
      metadata,
    });
  }

  async createSetupIntent(customerId: string): Promise<StripeSetupIntent> {
    return this.request<StripeSetupIntent>("POST", "/setup_intents", {
      customer: customerId,
      usage: "off_session",
    });
  }

  async chargeCustomer(
    customerId: string,
    paymentMethodId: string,
    amount: number,
    metadata: Record<string, string>,
  ): Promise<StripePaymentIntent> {
    return this.request<StripePaymentIntent>("POST", "/payment_intents", {
      customer: customerId,
      payment_method: paymentMethodId,
      amount,
      currency: "usd",
      off_session: true,
      confirm: true,
      metadata,
    });
  }

  async getPaymentMethod(paymentMethodId: string): Promise<StripePaymentMethod> {
    return this.request<StripePaymentMethod>("GET", `/payment_methods/${paymentMethodId}`);
  }

  async searchCustomersByMetadata(githubUsername: string): Promise<StripeCustomer[]> {
    const query = `metadata["github_username"]:"${githubUsername}"`;
    const result = await this.request<{ data: StripeCustomer[] }>(
      "GET",
      `/customers/search?query=${encodeURIComponent(query)}`,
    );
    return result.data;
  }

  async listPaymentMethods(customerId: string): Promise<StripePaymentMethod[]> {
    const result = await this.request<{ data: StripePaymentMethod[] }>(
      "GET",
      `/payment_methods?customer=${customerId}&type=card`,
    );
    return result.data;
  }

  async createCheckoutSession(
    customerId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ id: string; url: string }> {
    return this.request<{ id: string; url: string }>("POST", "/checkout/sessions", {
      customer: customerId,
      mode: "setup",
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_method_types: ["card"],
    });
  }
}
