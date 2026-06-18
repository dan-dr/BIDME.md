import { describe, test, expect, mock, afterEach } from "bun:test";
import { StripeAPI } from "../../lib/stripe-integration.js";

describe("Stripe payment enforcement primitives", () => {
  afterEach(() => {
    mock.restore();
    delete process.env["STRIPE_SECRET_KEY"];
  });

  test("searches bidders by github_username metadata", async () => {
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toContain("/customers/search?query=");
      expect(decodeURIComponent(url)).toContain('metadata["github_username"]:"dan-dr"');
      return Response.json({ data: [{ id: "cus_123", metadata: { github_username: "dan-dr" } }] });
    }) as unknown as typeof fetch;

    const stripe = new StripeAPI();
    const customers = await stripe.searchCustomersByMetadata("dan-dr");
    expect(customers[0]!.id).toBe("cus_123");

    globalThis.fetch = originalFetch;
  });

  test("lists a customer's card payment methods with limit 1", async () => {
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toContain("/customers/cus_123/payment_methods?type=card&limit=1");
      return Response.json({ data: [{ id: "pm_123", type: "card", customer: "cus_123" }] });
    }) as unknown as typeof fetch;

    const stripe = new StripeAPI();
    const methods = await stripe.listPaymentMethods("cus_123");
    expect(methods[0]!.id).toBe("pm_123");

    globalThis.fetch = originalFetch;
  });

  test("charges Connect destination with application fee when provided", async () => {
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      expect(body).toContain("transfer_data%5Bdestination%5D=acct_123");
      expect(body).toContain("application_fee_amount=1000");
      return Response.json({
        id: "pi_123",
        amount: 10000,
        currency: "usd",
        status: "succeeded",
        customer: "cus_123",
        payment_method: "pm_123",
        metadata: {},
      });
    }) as unknown as typeof fetch;

    const stripe = new StripeAPI();
    const intent = await stripe.chargeCustomer("cus_123", "pm_123", 10000, {}, "acct_123", 1000);
    expect(intent.id).toBe("pi_123");

    globalThis.fetch = originalFetch;
  });
});
