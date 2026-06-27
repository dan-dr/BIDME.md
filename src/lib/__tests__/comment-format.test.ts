import { describe, expect, test } from "bun:test";
import {
  acceptedBanner,
  decorateBidComment,
  expiredBanner,
  extractOriginalBody,
  paymentRequiredBanner,
  rejectedBanner,
} from "../comment-format.js";

const ORIGINAL = `---
bid:
  amount: 100
  destination_url: "https://example.com"
  tagline: "Build faster"
---

![Banner](https://example.com/banner.png)`;

describe("decorateBidComment", () => {
  test("prepends a status block and preserves the original body", () => {
    const decorated = decorateBidComment(ORIGINAL, acceptedBanner(100, 1));
    expect(decorated).toContain("Bid active");
    expect(decorated).toContain("Rank #1");
    expect(decorated).toContain("![Banner](https://example.com/banner.png)");
    expect(extractOriginalBody(decorated)).toBe(ORIGINAL);
  });

  test("is idempotent — re-decorating replaces the prior status block", () => {
    const first = decorateBidComment(ORIGINAL, paymentRequiredBanner(100, "https://pay", 24));
    const second = decorateBidComment(first, acceptedBanner(100, 2));

    expect(second).toContain("Bid active");
    expect(second).not.toContain("Payment required");
    expect((second.match(/<!-- bidme-status -->/g) ?? []).length).toBe(1);
    expect(extractOriginalBody(second)).toBe(ORIGINAL);
  });

  test("collapses the original into a struck details block for terminal states", () => {
    const decorated = decorateBidComment(ORIGINAL, rejectedBanner(["too low"]), {
      collapseOriginal: true,
    });
    expect(decorated).toContain("Bid rejected");
    expect(decorated).toContain("- too low");
    expect(decorated).toContain("<details>");
    expect(decorated).toContain("~~Original bid~~");
  });
});

describe("banners", () => {
  test("paymentRequiredBanner includes the checkout link and grace window", () => {
    const banner = paymentRequiredBanner(50, "https://checkout.stripe.com/x", 12);
    expect(banner).toContain("https://checkout.stripe.com/x");
    expect(banner).toContain("12h");
  });

  test("paymentRequiredBanner degrades gracefully without a link", () => {
    const banner = paymentRequiredBanner(50, "", 12);
    expect(banner).toContain("could not be started");
    expect(banner).not.toContain("http");
  });

  test("expiredBanner mentions the grace window", () => {
    expect(expiredBanner(24)).toContain("24h");
  });
});
