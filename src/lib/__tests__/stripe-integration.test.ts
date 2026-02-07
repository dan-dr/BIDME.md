import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import {
  StripeAPI,
  StripeAPIError,
  StripePaymentError,
} from "../stripe-integration.js";

describe("StripeAPI", () => {
  const originalEnv = process.env["STRIPE_SECRET_KEY"];
  const mockSecretKey = "sk_test_mock123";

  beforeEach(() => {
    delete process.env["STRIPE_SECRET_KEY"];
  });

  afterEach(() => {
    if (originalEnv) {
      process.env["STRIPE_SECRET_KEY"] = originalEnv;
    } else {
      delete process.env["STRIPE_SECRET_KEY"];
    }
  });

  describe("constructor", () => {
    test("creates configured instance with explicit secret key", () => {
      const api = new StripeAPI(mockSecretKey);
      expect(api.isConfigured).toBe(true);
    });

    test("creates configured instance from env var", () => {
      process.env["STRIPE_SECRET_KEY"] = mockSecretKey;
      const api = new StripeAPI();
      expect(api.isConfigured).toBe(true);
    });

    test("creates unconfigured instance when no key provided", () => {
      const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
      const api = new StripeAPI();
      expect(api.isConfigured).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        "⚠ STRIPE_SECRET_KEY not set — payment features will be skipped",
      );
      warnSpy.mockRestore();
    });
  });

  describe("API calls with mock fetch", () => {
    let api: StripeAPI;
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      api = new StripeAPI(mockSecretKey);
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test("createCustomer sends correct request", async () => {
      const mockCustomer = {
        id: "cus_123",
        email: "test@example.com",
        metadata: { github_username: "octocat" },
        created: 1234567890,
      };

      globalThis.fetch = mock(async (url: string, options: RequestInit) => {
        expect(url).toBe("https://api.stripe.com/v1/customers");
        expect(options.method).toBe("POST");
        expect(options.headers).toHaveProperty("Authorization");
        expect(options.headers).toHaveProperty("Content-Type", "application/x-www-form-urlencoded");
        expect(options.body).toContain("email=test%40example.com");
        expect(options.body).toContain("metadata%5Bgithub_username%5D=octocat");

        return new Response(JSON.stringify(mockCustomer), { status: 200 });
      }) as typeof fetch;

      const result = await api.createCustomer("test@example.com", {
        github_username: "octocat",
      });

      expect(result.id).toBe("cus_123");
      expect(result.email).toBe("test@example.com");
      expect(result.metadata.github_username).toBe("octocat");
    });

    test("createSetupIntent sends correct request", async () => {
      const mockSetupIntent = {
        id: "seti_123",
        client_secret: "seti_123_secret_abc",
        status: "requires_payment_method",
        customer: "cus_123",
      };

      globalThis.fetch = mock(async (url: string, options: RequestInit) => {
        expect(url).toBe("https://api.stripe.com/v1/setup_intents");
        expect(options.method).toBe("POST");
        expect(options.body).toContain("customer=cus_123");
        expect(options.body).toContain("usage=off_session");

        return new Response(JSON.stringify(mockSetupIntent), { status: 200 });
      }) as typeof fetch;

      const result = await api.createSetupIntent("cus_123");

      expect(result.id).toBe("seti_123");
      expect(result.customer).toBe("cus_123");
      expect(result.status).toBe("requires_payment_method");
    });

    test("chargeCustomer sends correct request with off_session", async () => {
      const mockPaymentIntent = {
        id: "pi_123",
        amount: 5000,
        currency: "usd",
        status: "succeeded",
        customer: "cus_123",
        payment_method: "pm_123",
        metadata: { period_id: "period_abc" },
      };

      globalThis.fetch = mock(async (url: string, options: RequestInit) => {
        expect(url).toBe("https://api.stripe.com/v1/payment_intents");
        expect(options.method).toBe("POST");
        const body = options.body as string;
        expect(body).toContain("customer=cus_123");
        expect(body).toContain("payment_method=pm_123");
        expect(body).toContain("amount=5000");
        expect(body).toContain("currency=usd");
        expect(body).toContain("off_session=true");
        expect(body).toContain("confirm=true");
        expect(body).toContain("metadata%5Bperiod_id%5D=period_abc");

        return new Response(JSON.stringify(mockPaymentIntent), { status: 200 });
      }) as typeof fetch;

      const result = await api.chargeCustomer("cus_123", "pm_123", 5000, {
        period_id: "period_abc",
      });

      expect(result.id).toBe("pi_123");
      expect(result.amount).toBe(5000);
      expect(result.status).toBe("succeeded");
    });

    test("getPaymentMethod sends correct request", async () => {
      const mockPaymentMethod = {
        id: "pm_123",
        type: "card",
        card: {
          brand: "visa",
          last4: "4242",
          exp_month: 12,
          exp_year: 2030,
        },
        customer: "cus_123",
      };

      globalThis.fetch = mock(async (url: string, options: RequestInit) => {
        expect(url).toBe("https://api.stripe.com/v1/payment_methods/pm_123");
        expect(options.method).toBe("GET");

        return new Response(JSON.stringify(mockPaymentMethod), { status: 200 });
      }) as typeof fetch;

      const result = await api.getPaymentMethod("pm_123");

      expect(result.id).toBe("pm_123");
      expect(result.type).toBe("card");
      expect(result.card?.brand).toBe("visa");
      expect(result.card?.last4).toBe("4242");
    });
  });

  describe("error handling", () => {
    let api: StripeAPI;
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      api = new StripeAPI(mockSecretKey);
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test("throws StripeAPIError for API errors", async () => {
      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            error: {
              type: "invalid_request_error",
              message: "Invalid customer ID",
              code: "resource_missing",
              param: "customer",
            },
          }),
          { status: 404 },
        );
      }) as typeof fetch;

      await expect(api.createSetupIntent("cus_invalid")).rejects.toThrow(
        StripeAPIError,
      );

      try {
        await api.createSetupIntent("cus_invalid");
      } catch (error) {
        expect(error).toBeInstanceOf(StripeAPIError);
        const apiError = error as StripeAPIError;
        expect(apiError.type).toBe("invalid_request_error");
        expect(apiError.code).toBe("resource_missing");
        expect(apiError.param).toBe("customer");
        expect(apiError.message).toBe("Invalid customer ID");
      }
    });

    test("throws StripePaymentError for card errors", async () => {
      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            error: {
              type: "card_error",
              message: "Your card was declined",
              code: "card_declined",
              decline_code: "insufficient_funds",
            },
          }),
          { status: 402 },
        );
      }) as typeof fetch;

      await expect(
        api.chargeCustomer("cus_123", "pm_123", 5000, {}),
      ).rejects.toThrow(StripePaymentError);

      try {
        await api.chargeCustomer("cus_123", "pm_123", 5000, {});
      } catch (error) {
        expect(error).toBeInstanceOf(StripePaymentError);
        const paymentError = error as StripePaymentError;
        expect(paymentError.code).toBe("card_declined");
        expect(paymentError.declineCode).toBe("insufficient_funds");
        expect(paymentError.message).toBe("Your card was declined");
      }
    });

    test("throws error when Stripe is not configured", async () => {
      const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
      const unconfiguredApi = new StripeAPI();
      warnSpy.mockRestore();

      await expect(unconfiguredApi.createCustomer("test@example.com", { github_username: "test" })).rejects.toThrow(
        "Stripe is not configured — missing secret key",
      );
    });
  });
});

describe("StripeAPIError", () => {
  test("constructs with correct properties", () => {
    const error = new StripeAPIError({
      type: "invalid_request_error",
      message: "Test error message",
      code: "test_code",
      param: "test_param",
    });

    expect(error.name).toBe("StripeAPIError");
    expect(error.message).toBe("Test error message");
    expect(error.type).toBe("invalid_request_error");
    expect(error.code).toBe("test_code");
    expect(error.param).toBe("test_param");
  });
});

describe("StripePaymentError", () => {
  test("constructs with correct properties", () => {
    const error = new StripePaymentError(
      "Payment failed",
      "card_declined",
      "insufficient_funds",
    );

    expect(error.name).toBe("StripePaymentError");
    expect(error.message).toBe("Payment failed");
    expect(error.code).toBe("card_declined");
    expect(error.declineCode).toBe("insufficient_funds");
  });

  test("handles missing decline code", () => {
    const error = new StripePaymentError("Payment failed", "processing_error");

    expect(error.code).toBe("processing_error");
    expect(error.declineCode).toBeUndefined();
  });
});
