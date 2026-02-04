import { describe, test, expect, mock, beforeAll, afterAll } from "bun:test";
import {
  parseBidComment,
  validateBid,
  validateBannerUrl,
  type ParsedBid,
} from "../../scripts/utils/validation.ts";
import { loadConfig, type BidMeConfig } from "../../scripts/utils/config.ts";
import { resolve } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";

let config: BidMeConfig;
let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(resolve(tmpdir(), "bidme-val-test-"));
  config = await loadConfig(resolve(tempDir, "missing.yml"));
});

afterAll(async () => {
  await rm(tempDir, { recursive: true });
});

describe("parseBidComment", () => {
  test("parses valid YAML frontmatter bid", () => {
    const body = `I'd like to place a bid!

\`\`\`yaml
amount: 100
banner_url: https://example.com/banner.png
destination_url: https://example.com
contact: user@example.com
\`\`\`

Thanks!`;

    const result = parseBidComment(body);
    expect(result).toEqual({
      amount: 100,
      banner_url: "https://example.com/banner.png",
      destination_url: "https://example.com",
      contact: "user@example.com",
    });
  });

  test("parses yml fence variant", () => {
    const body = `\`\`\`yml
amount: 75
banner_url: https://cdn.example.com/ad.jpg
destination_url: https://example.com/landing
contact: @githubuser
\`\`\``;

    const result = parseBidComment(body);
    expect(result).toEqual({
      amount: 75,
      banner_url: "https://cdn.example.com/ad.jpg",
      destination_url: "https://example.com/landing",
      contact: "@githubuser",
    });
  });

  test("returns null when no YAML fence found", () => {
    expect(parseBidComment("just some text")).toBeNull();
  });

  test("returns null when required fields missing", () => {
    const body = `\`\`\`yaml
amount: 100
banner_url: https://example.com/banner.png
\`\`\``;
    expect(parseBidComment(body)).toBeNull();
  });

  test("returns null when amount is not a number", () => {
    const body = `\`\`\`yaml
amount: abc
banner_url: https://example.com/banner.png
destination_url: https://example.com
contact: user@example.com
\`\`\``;
    expect(parseBidComment(body)).toBeNull();
  });

  test("handles decimal amounts", () => {
    const body = `\`\`\`yaml
amount: 55.50
banner_url: https://example.com/banner.png
destination_url: https://example.com
contact: user@example.com
\`\`\``;

    const result = parseBidComment(body);
    expect(result?.amount).toBe(55.5);
  });
});

describe("validateBid", () => {
  const validBid: ParsedBid = {
    amount: 100,
    banner_url: "https://example.com/banner.png",
    destination_url: "https://example.com",
    contact: "user@example.com",
  };

  test("accepts a valid bid", () => {
    const result = validateBid(validBid, config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects bid below minimum", () => {
    const bid = { ...validBid, amount: 10 };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "amount")).toBe(true);
  });

  test("rejects bid not matching increment", () => {
    const bid = { ...validBid, amount: 53 };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("increment"))).toBe(
      true,
    );
  });

  test("rejects invalid banner URL", () => {
    const bid = { ...validBid, banner_url: "not-a-url" };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "banner_url")).toBe(true);
  });

  test("rejects non-http banner URL", () => {
    const bid = { ...validBid, banner_url: "ftp://example.com/banner.png" };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "banner_url")).toBe(true);
  });

  test("rejects invalid destination URL", () => {
    const bid = { ...validBid, destination_url: "garbage" };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "destination_url")).toBe(true);
  });

  test("rejects invalid contact format", () => {
    const bid = { ...validBid, contact: "not valid" };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "contact")).toBe(true);
  });

  test("accepts GitHub username as contact", () => {
    const bid = { ...validBid, contact: "@octocat" };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(true);
  });

  test("collects multiple errors", () => {
    const bid: ParsedBid = {
      amount: 3,
      banner_url: "bad",
      destination_url: "bad",
      contact: "bad contact",
    };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe("validateBannerUrl", () => {
  test("rejects invalid URL", async () => {
    const result = await validateBannerUrl("not-a-url", config);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.field).toBe("banner_url");
  });

  test("rejects disallowed format", async () => {
    const result = await validateBannerUrl(
      "https://example.com/banner.bmp",
      config,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("format"))).toBe(true);
  });

  test("allows URL without extension (no format error)", async () => {
    const result = await validateBannerUrl(
      "https://example.com/banner",
      config,
    );
    const formatErrors = result.errors.filter((e) =>
      e.message.includes("format"),
    );
    expect(formatErrors).toHaveLength(0);
  });

  test("rejects unreachable URL", async () => {
    const result = await validateBannerUrl(
      "https://this-domain-does-not-exist-bidme-test.invalid/banner.png",
      config,
    );
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.message.includes("not accessible")),
    ).toBe(true);
  });
});
