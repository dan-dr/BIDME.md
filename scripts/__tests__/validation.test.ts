import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  parseBidComment,
  validateBid,
  type ParsedBid,
} from "../utils/validation";
import { loadConfig, type BidMeConfig } from "../utils/config";
import { resolve } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";

let config: BidMeConfig;
let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(resolve(tmpdir(), "bidme-scripts-val-"));
  config = await loadConfig(resolve(tempDir, "missing.yml"));
});

afterAll(async () => {
  await rm(tempDir, { recursive: true });
});

describe("parseBidComment", () => {
  test("parses a valid bid comment", () => {
    const body = `\`\`\`yaml
amount: 100
banner_url: https://example.com/banner.png
destination_url: https://example.com
contact: user@example.com
\`\`\``;

    const result = parseBidComment(body);
    expect(result).toEqual({
      amount: 100,
      banner_url: "https://example.com/banner.png",
      destination_url: "https://example.com",
      contact: "user@example.com",
    });
  });

  test("returns null for missing fields", () => {
    const body = `\`\`\`yaml
amount: 100
\`\`\``;
    expect(parseBidComment(body)).toBeNull();
  });

  test("returns null for malformed YAML (no fence)", () => {
    expect(parseBidComment("amount: 100\nbanner_url: https://x.com/b.png")).toBeNull();
  });

  test("returns null for malformed YAML (broken key-value pairs)", () => {
    const body = `\`\`\`yaml
this is not yaml at all
just random text
\`\`\``;
    expect(parseBidComment(body)).toBeNull();
  });

  test("handles extra whitespace around values", () => {
    const body = `\`\`\`yaml
amount:   150
banner_url:   https://example.com/banner.png
destination_url:    https://example.com
contact:    user@example.com
\`\`\``;

    const result = parseBidComment(body);
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(150);
    expect(result!.banner_url).toBe("https://example.com/banner.png");
    expect(result!.destination_url).toBe("https://example.com");
    expect(result!.contact).toBe("user@example.com");
  });

  test("parses bid with optional message text around the YAML block", () => {
    const body = `Hi! I'd love to sponsor your project.

Here's my bid:

\`\`\`yaml
amount: 200
banner_url: https://cdn.sponsor.com/ad.jpg
destination_url: https://sponsor.com
contact: sponsor@company.com
\`\`\`

Looking forward to hearing back! 🎉`;

    const result = parseBidComment(body);
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(200);
    expect(result!.banner_url).toBe("https://cdn.sponsor.com/ad.jpg");
    expect(result!.destination_url).toBe("https://sponsor.com");
    expect(result!.contact).toBe("sponsor@company.com");
  });

  test("returns null when amount is non-numeric", () => {
    const body = `\`\`\`yaml
amount: free
banner_url: https://example.com/banner.png
destination_url: https://example.com
contact: user@example.com
\`\`\``;
    expect(parseBidComment(body)).toBeNull();
  });

  test("returns null when all fields are empty strings", () => {
    const body = `\`\`\`yaml
amount:
banner_url:
destination_url:
contact:
\`\`\``;
    expect(parseBidComment(body)).toBeNull();
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
    expect(result.errors.some((e) => e.message.includes("at least $50"))).toBe(true);
  });

  test("rejects bid below increment", () => {
    const bid = { ...validBid, amount: 52 };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("increment"))).toBe(true);
  });

  test("rejects invalid URL format for banner_url", () => {
    const bid = { ...validBid, banner_url: "not-a-url" };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "banner_url")).toBe(true);
  });

  test("rejects ftp:// protocol for banner_url", () => {
    const bid = { ...validBid, banner_url: "ftp://example.com/banner.png" };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "banner_url" && e.message.includes("http"))).toBe(true);
  });

  test("rejects invalid destination_url", () => {
    const bid = { ...validBid, destination_url: "garbage" };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "destination_url")).toBe(true);
  });

  test("rejects invalid contact (not email or @username)", () => {
    const bid = { ...validBid, contact: "just a name" };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "contact")).toBe(true);
  });

  test("valid edge case: bid at exact minimum", () => {
    const bid = { ...validBid, amount: 50 };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(true);
  });

  test("valid edge case: GitHub username as contact", () => {
    const bid = { ...validBid, contact: "@octocat" };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(true);
  });

  test("valid edge case: https destination URL with path", () => {
    const bid = { ...validBid, destination_url: "https://example.com/landing?ref=bidme" };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(true);
  });

  test("collects multiple errors simultaneously", () => {
    const bid: ParsedBid = {
      amount: 3,
      banner_url: "bad",
      destination_url: "bad",
      contact: "bad",
    };
    const result = validateBid(bid, config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain("amount");
    expect(fields).toContain("banner_url");
    expect(fields).toContain("destination_url");
    expect(fields).toContain("contact");
  });
});
