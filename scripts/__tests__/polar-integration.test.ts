import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  PolarAPI,
  PolarAPIError,
  type PolarProduct,
  type PolarCheckoutSession,
} from "../utils/polar-integration";

const MOCK_TOKEN = "polar_test_abc123";

let originalFetch: typeof globalThis.fetch;
let originalEnv: string | undefined;

function mockFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  globalThis.fetch = mock(handler) as typeof fetch;
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalEnv = process.env["POLAR_ACCESS_TOKEN"];
  delete process.env["POLAR_ACCESS_TOKEN"];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEnv !== undefined) {
    process.env["POLAR_ACCESS_TOKEN"] = originalEnv;
  } else {
    delete process.env["POLAR_ACCESS_TOKEN"];
  }
});

describe("PolarAPI constructor", () => {
  test("uses provided token", () => {
    const api = new PolarAPI(MOCK_TOKEN);
    expect(api.isConfigured).toBe(true);
  });

  test("uses POLAR_ACCESS_TOKEN env variable", () => {
    process.env["POLAR_ACCESS_TOKEN"] = "env-polar-token";
    const api = new PolarAPI();
    expect(api.isConfigured).toBe(true);
  });

  test("graceful fallback when no token — logs warning and sets unconfigured", () => {
    const warnCalls: unknown[][] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => warnCalls.push(args);
    try {
      const api = new PolarAPI();
      expect(api.isConfigured).toBe(false);
      expect(warnCalls.length).toBe(1);
      expect(warnCalls[0]?.[0]).toContain("POLAR_ACCESS_TOKEN not set");
    } finally {
      console.warn = origWarn;
    }
  });
});

describe("createCheckoutSession", () => {
  test("creates a checkout session with correct parameters", async () => {
    const checkoutResponse: PolarCheckoutSession = {
      id: "checkout_123",
      url: "https://polar.sh/checkout/checkout_123",
      status: "open",
      amount: 10000,
      currency: "usd",
      product_id: "prod_456",
      customer_email: "bidder@example.com",
      created_at: "2026-02-04T00:00:00Z",
    };

    mockFetch((url, init) => {
      expect(url).toBe("https://api.polar.sh/v1/checkouts");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string);
      expect(body.amount).toBe(10000);
      expect(body.currency).toBe("usd");
      expect(body.customer_email).toBe("bidder@example.com");
      expect(body.metadata.period_id).toBe("period-2026-02-04");
      const headers = init?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe(`Bearer ${MOCK_TOKEN}`);
      return new Response(JSON.stringify(checkoutResponse), { status: 201 });
    });

    const api = new PolarAPI(MOCK_TOKEN);
    const result = await api.createCheckoutSession(
      100,
      "bidder@example.com",
      "period-2026-02-04",
    );
    expect(result.id).toBe("checkout_123");
    expect(result.url).toBe("https://polar.sh/checkout/checkout_123");
    expect(result.status).toBe("open");
  });

  test("throws when not configured", async () => {
    const api = new PolarAPI();
    try {
      await api.createCheckoutSession(100, "bidder@example.com", "period-1");
      expect(true).toBe(false);
    } catch (e) {
      expect((e as Error).message).toContain("not configured");
    }
  });

  test("throws PolarAPIError on API failure", async () => {
    mockFetch(() => {
      return new Response(
        JSON.stringify({ detail: "Invalid amount" }),
        { status: 400 },
      );
    });

    const api = new PolarAPI(MOCK_TOKEN);
    try {
      await api.createCheckoutSession(0, "bidder@example.com", "period-1");
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(PolarAPIError);
      const err = e as PolarAPIError;
      expect(err.status).toBe(400);
      expect(err.message).toBe("Invalid amount");
    }
  });
});

describe("getPaymentStatus", () => {
  test("returns paid: true for succeeded checkout", async () => {
    const session: PolarCheckoutSession = {
      id: "checkout_123",
      url: "https://polar.sh/checkout/checkout_123",
      status: "succeeded",
      amount: 10000,
      currency: "usd",
      product_id: "prod_456",
      customer_email: "bidder@example.com",
      created_at: "2026-02-04T00:00:00Z",
    };

    mockFetch((url, init) => {
      expect(url).toBe("https://api.polar.sh/v1/checkouts/checkout_123");
      expect(init?.method).toBe("GET");
      return new Response(JSON.stringify(session), { status: 200 });
    });

    const api = new PolarAPI(MOCK_TOKEN);
    const result = await api.getPaymentStatus("checkout_123");
    expect(result.paid).toBe(true);
    expect(result.status).toBe("succeeded");
  });

  test("returns paid: false for open checkout", async () => {
    const session: PolarCheckoutSession = {
      id: "checkout_456",
      url: "https://polar.sh/checkout/checkout_456",
      status: "open",
      amount: 5000,
      currency: "usd",
      product_id: "prod_789",
      customer_email: "other@example.com",
      created_at: "2026-02-04T00:00:00Z",
    };

    mockFetch(() => {
      return new Response(JSON.stringify(session), { status: 200 });
    });

    const api = new PolarAPI(MOCK_TOKEN);
    const result = await api.getPaymentStatus("checkout_456");
    expect(result.paid).toBe(false);
    expect(result.status).toBe("open");
  });

  test("returns paid: false for expired checkout", async () => {
    const session: PolarCheckoutSession = {
      id: "checkout_789",
      url: "https://polar.sh/checkout/checkout_789",
      status: "expired",
      amount: 7500,
      currency: "usd",
      product_id: "prod_abc",
      customer_email: "expired@example.com",
      created_at: "2026-02-01T00:00:00Z",
    };

    mockFetch(() => {
      return new Response(JSON.stringify(session), { status: 200 });
    });

    const api = new PolarAPI(MOCK_TOKEN);
    const result = await api.getPaymentStatus("checkout_789");
    expect(result.paid).toBe(false);
    expect(result.status).toBe("expired");
  });
});

describe("createProduct", () => {
  test("creates a product with correct parameters", async () => {
    const productResponse: PolarProduct = {
      id: "prod_123",
      name: "Banner Space: Feb 4-11, 2026 - $100",
      description: "Weekly banner ad placement",
      prices: [{ id: "price_abc", amount: 10000, currency: "usd" }],
      created_at: "2026-02-04T00:00:00Z",
    };

    mockFetch((url, init) => {
      expect(url).toBe("https://api.polar.sh/v1/products");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string);
      expect(body.name).toBe("Banner Space: Feb 4-11, 2026 - $100");
      expect(body.description).toBe("Weekly banner ad placement");
      expect(body.prices[0].type).toBe("one_time");
      expect(body.prices[0].amount).toBe(10000);
      expect(body.prices[0].currency).toBe("usd");
      return new Response(JSON.stringify(productResponse), { status: 201 });
    });

    const api = new PolarAPI(MOCK_TOKEN);
    const result = await api.createProduct(
      "Banner Space: Feb 4-11, 2026 - $100",
      100,
      "Weekly banner ad placement",
    );
    expect(result.id).toBe("prod_123");
    expect(result.name).toBe("Banner Space: Feb 4-11, 2026 - $100");
    expect(result.prices[0]?.amount).toBe(10000);
  });
});

describe("error handling", () => {
  test("handles non-JSON error response", async () => {
    mockFetch(() => {
      return new Response("Bad Gateway", {
        status: 502,
        statusText: "Bad Gateway",
      });
    });

    const api = new PolarAPI(MOCK_TOKEN);
    try {
      await api.getPaymentStatus("checkout_bad");
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(PolarAPIError);
      const err = e as PolarAPIError;
      expect(err.status).toBe(502);
      expect(err.message).toBe("Bad Gateway");
    }
  });

  test("sends correct authorization header", async () => {
    mockFetch((_url, init) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe(`Bearer ${MOCK_TOKEN}`);
      expect(headers["Accept"]).toBe("application/json");
      expect(headers["Content-Type"]).toBe("application/json");
      return new Response(
        JSON.stringify({
          id: "prod_1",
          name: "test",
          description: "test",
          prices: [],
          created_at: "2026-01-01T00:00:00Z",
        }),
        { status: 200 },
      );
    });

    const api = new PolarAPI(MOCK_TOKEN);
    await api.createProduct("test", 50, "test");
  });
});
