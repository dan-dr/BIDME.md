export type PaymentMode = "polar-own" | "bidme-managed";

export interface PolarConfig {
  accessToken: string;
  baseUrl: string;
}

export interface PaymentLinkConfig {
  mode: PaymentMode;
  bidme_fee_percent: number;
  payment_link: string;
}

export interface PolarProduct {
  id: string;
  name: string;
  description: string;
  prices: Array<{ id: string; amount: number; currency: string }>;
  created_at: string;
}

export interface PolarCheckoutSession {
  id: string;
  url: string;
  status: "open" | "succeeded" | "expired";
  amount: number;
  currency: string;
  product_id: string;
  customer_email: string;
  created_at: string;
}

export interface PolarErrorResponse {
  detail: string;
  status: number;
}

export class PolarAPIError extends Error {
  status: number;

  constructor(response: PolarErrorResponse) {
    super(response.detail);
    this.name = "PolarAPIError";
    this.status = response.status;
  }
}

export class PolarAPI {
  private config: PolarConfig | null;
  private _mode: PaymentMode;

  constructor(accessToken?: string, mode: PaymentMode = "polar-own") {
    const token = accessToken ?? process.env["POLAR_ACCESS_TOKEN"];
    if (!token) {
      console.warn(
        "⚠ POLAR_ACCESS_TOKEN not set — payment features will be skipped",
      );
      this.config = null;
      this._mode = mode;
      return;
    }

    if (mode === "bidme-managed") {
      // Mode 2 — "bidme-managed": BidMe's Polar.sh account (future Stripe Connect).
      // Polar AUP prohibits marketplace use, so full bidme-managed mode
      // will require Stripe Connect integration in a future release.
      // For now, falls back to Mode 1 (polar-own) behavior.
      console.warn(
        "BidMe managed payments coming soon — using direct Polar for now",
      );
    }

    this._mode = mode;
    this.config = {
      accessToken: token,
      baseUrl: "https://api.polar.sh/v1",
    };
  }

  get isConfigured(): boolean {
    return this.config !== null;
  }

  get mode(): PaymentMode {
    return this._mode;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.config) {
      throw new Error("Polar.sh is not configured — missing access token");
    }

    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorData: PolarErrorResponse;
      try {
        const parsed = (await response.json()) as Record<string, unknown>;
        errorData = {
          detail: (parsed["detail"] as string) ?? response.statusText,
          status: response.status,
        };
      } catch {
        errorData = {
          detail: response.statusText,
          status: response.status,
        };
      }
      throw new PolarAPIError(errorData);
    }

    return (await response.json()) as T;
  }

  async createProduct(
    name: string,
    price: number,
    description: string,
  ): Promise<PolarProduct> {
    return this.request<PolarProduct>("POST", "/products", {
      name,
      description,
      prices: [
        {
          type: "one_time",
          amount: price * 100,
          currency: "usd",
        },
      ],
    });
  }

  async createCheckoutSession(
    amount: number,
    bidderEmail: string,
    periodId: string,
  ): Promise<PolarCheckoutSession> {
    return this.request<PolarCheckoutSession>("POST", "/checkouts", {
      amount: amount * 100,
      currency: "usd",
      customer_email: bidderEmail,
      metadata: { period_id: periodId },
    });
  }

  async getPaymentStatus(
    checkoutId: string,
  ): Promise<{ paid: boolean; status: string }> {
    const session = await this.request<PolarCheckoutSession>(
      "GET",
      `/checkouts/${checkoutId}`,
    );
    return {
      paid: session.status === "succeeded",
      status: session.status,
    };
  }

  async createPaymentLink(
    bid: { bidder: string; amount: number; contact: string },
    config: PaymentLinkConfig,
  ): Promise<string> {
    if (!this.isConfigured) {
      return config.payment_link;
    }

    // Both modes currently use the same Polar checkout flow.
    // Mode 2 (bidme-managed) will use Stripe Connect in the future;
    // for now it falls back to Mode 1 (polar-own) behavior.
    const session = await this.createCheckoutSession(
      bid.amount,
      bid.contact,
      `${bid.bidder}-${Date.now()}`,
    );
    return session.url;
  }
}
