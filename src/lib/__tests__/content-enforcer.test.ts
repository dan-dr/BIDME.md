import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { DEFAULT_CONFIG } from "../config.js";
import type { BidMeConfig } from "../config.js";
import type { ParsedBid } from "../validation.js";
import {
  validateBannerImage,
  validateCommentFormat,
  checkProhibitedContent,
  enforceContent,
} from "../content-enforcer.js";

const originalFetch = globalThis.fetch;

function makeConfig(overrides: Partial<BidMeConfig> = {}): BidMeConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    banner: { ...DEFAULT_CONFIG.banner, ...(overrides.banner ?? {}) },
    content_guidelines: {
      ...DEFAULT_CONFIG.content_guidelines,
      ...(overrides.content_guidelines ?? {}),
    },
  };
}

function makeBid(overrides: Partial<ParsedBid> = {}): ParsedBid {
  return {
    amount: 100,
    banner_url: "https://example.com/banner.png",
    destination_url: "https://example.com",
    contact: "bid@example.com",
    ...overrides,
  };
}

// Minimal valid PNG header (8-byte signature + IHDR chunk with width/height at offsets 16-23)
function makePngBuffer(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(24);
  // PNG signature
  buf.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  // IHDR chunk length (13)
  buf.set([0, 0, 0, 13], 8);
  // "IHDR"
  buf.set([73, 72, 68, 82], 12);
  // Width (big-endian uint32)
  const view = new DataView(buf.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return buf;
}

// Minimal valid JPEG with SOF0 marker
function makeJpegBuffer(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(11);
  const view = new DataView(buf.buffer);
  // SOI
  buf[0] = 0xff;
  buf[1] = 0xd8;
  // SOF0 marker
  buf[2] = 0xff;
  buf[3] = 0xc0;
  // Segment length
  view.setUint16(4, 7);
  // Precision
  buf[6] = 8;
  // Height (big-endian uint16)
  view.setUint16(7, height);
  // Width (big-endian uint16)
  view.setUint16(9, width);
  return buf;
}

// Minimal valid GIF header (GIF89a + width/height at offsets 6-9, little-endian)
function makeGifBuffer(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(10);
  // "GIF89a"
  buf.set([71, 73, 70, 56, 57, 97], 0);
  const view = new DataView(buf.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return buf;
}

// Minimal valid WebP (RIFF + WEBP + VP8 chunk)
function makeWebpBuffer(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(30);
  // "RIFF"
  buf.set([82, 73, 70, 70], 0);
  // File size placeholder
  buf.set([0, 0, 0, 0], 4);
  // "WEBP"
  buf.set([87, 69, 66, 80], 8);
  // "VP8 "
  buf.set([86, 80, 56, 32], 12);
  // Chunk size placeholder
  buf.set([0, 0, 0, 0], 16);
  // VP8 bitstream header (3 bytes signature)
  buf.set([0x9d, 0x01, 0x2a], 23);
  // Width (little-endian uint16, lower 14 bits)
  const view = new DataView(buf.buffer);
  view.setUint16(26, width & 0x3fff, true);
  view.setUint16(28, height & 0x3fff, true);
  return buf;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe("validateBannerImage", () => {
  describe("image size validation", () => {
    test("passes when image is under max size", async () => {
      const config = makeConfig({ banner: { ...DEFAULT_CONFIG.banner, max_size: 200 } });
      const pngBuf = makePngBuffer(400, 50);

      globalThis.fetch = mock(async (input: any) => {
        const url = typeof input === "string" ? input : input.url;
        return new Response(new Uint8Array(pngBuf), {
          status: 200,
          headers: {
            "content-length": String(100 * 1024), // 100KB
            "content-type": "image/png",
          },
        });
      }) as any;

      const result = await validateBannerImage("https://example.com/banner.png", config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("fails when image exceeds max size", async () => {
      const config = makeConfig({ banner: { ...DEFAULT_CONFIG.banner, max_size: 200 } });

      globalThis.fetch = mock(async () => {
        return new Response(null, {
          status: 200,
          headers: {
            "content-length": String(450 * 1024), // 450KB
            "content-type": "image/svg+xml",
          },
        });
      }) as any;

      const result = await validateBannerImage("https://example.com/banner.svg", config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("450KB") && e.message.includes("200KB"))).toBe(true);
    });

    test("passes when content-length header is missing", async () => {
      globalThis.fetch = mock(async () => {
        return new Response(null, {
          status: 200,
          headers: { "content-type": "image/svg+xml" },
        });
      }) as any;

      const config = makeConfig();
      const result = await validateBannerImage("https://example.com/banner.svg", config);
      expect(result.valid).toBe(true);
    });
  });

  describe("image format validation", () => {
    test("passes for allowed format", async () => {
      const config = makeConfig({ banner: { ...DEFAULT_CONFIG.banner, formats: ["png", "jpg"] } });
      const pngBuf = makePngBuffer(400, 50);

      globalThis.fetch = mock(async () => {
        return new Response(new Uint8Array(pngBuf), {
          status: 200,
          headers: {
            "content-length": String(50 * 1024),
            "content-type": "image/png",
          },
        });
      }) as any;

      const result = await validateBannerImage("https://example.com/banner.png", config);
      expect(result.valid).toBe(true);
    });

    test("fails for disallowed format", async () => {
      const config = makeConfig({ banner: { ...DEFAULT_CONFIG.banner, formats: ["png", "jpg"] } });

      globalThis.fetch = mock(async () => {
        return new Response(null, {
          status: 200,
          headers: {
            "content-length": String(50 * 1024),
            "content-type": "image/gif",
          },
        });
      }) as any;

      const result = await validateBannerImage("https://example.com/banner.gif", config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("not in allowed formats"))).toBe(true);
    });

    test("fails for bmp format not in allowed list", async () => {
      const config = makeConfig({ banner: { ...DEFAULT_CONFIG.banner, formats: ["png", "jpg", "svg"] } });

      globalThis.fetch = mock(async () => {
        return new Response(null, {
          status: 200,
          headers: {
            "content-length": String(50 * 1024),
            "content-type": "image/bmp",
          },
        });
      }) as any;

      const result = await validateBannerImage("https://example.com/banner.bmp", config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("not in allowed formats"))).toBe(true);
    });

    test("skips dimension check for SVG", async () => {
      const config = makeConfig();

      globalThis.fetch = mock(async () => {
        return new Response(null, {
          status: 200,
          headers: {
            "content-length": String(10 * 1024),
            "content-type": "image/svg+xml",
          },
        });
      }) as any;

      const result = await validateBannerImage("https://example.com/banner.svg", config);
      expect(result.valid).toBe(true);
    });
  });

  describe("image dimension validation", () => {
    test("passes when PNG dimensions are within limits", async () => {
      const config = makeConfig({ banner: { ...DEFAULT_CONFIG.banner, width: 800, height: 100 } });
      const pngBuf = makePngBuffer(800, 100);

      globalThis.fetch = mock(async () => {
        return new Response(new Uint8Array(pngBuf), {
          status: 200,
          headers: {
            "content-length": String(50 * 1024),
            "content-type": "image/png",
          },
        });
      }) as any;

      const result = await validateBannerImage("https://example.com/banner.png", config);
      expect(result.valid).toBe(true);
    });

    test("fails when PNG dimensions exceed limits", async () => {
      const config = makeConfig({ banner: { ...DEFAULT_CONFIG.banner, width: 800, height: 100 } });
      const pngBuf = makePngBuffer(1200, 300);

      globalThis.fetch = mock(async () => {
        return new Response(new Uint8Array(pngBuf), {
          status: 200,
          headers: {
            "content-length": String(50 * 1024),
            "content-type": "image/png",
          },
        });
      }) as any;

      const result = await validateBannerImage("https://example.com/banner.png", config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("1200x300") && e.message.includes("800x100"))).toBe(true);
    });

    test("reads JPEG dimensions correctly", async () => {
      const config = makeConfig({ banner: { ...DEFAULT_CONFIG.banner, width: 800, height: 100 } });
      const jpegBuf = makeJpegBuffer(1000, 200);

      globalThis.fetch = mock(async () => {
        return new Response(new Uint8Array(jpegBuf), {
          status: 200,
          headers: {
            "content-length": String(50 * 1024),
            "content-type": "image/jpeg",
          },
        });
      }) as any;

      const result = await validateBannerImage("https://example.com/banner.jpg", config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("1000x200"))).toBe(true);
    });

    test("reads GIF dimensions correctly", async () => {
      const config = makeConfig({ banner: { ...DEFAULT_CONFIG.banner, width: 800, height: 100, formats: ["gif"] } });
      const gifBuf = makeGifBuffer(400, 50);

      globalThis.fetch = mock(async () => {
        return new Response(new Uint8Array(gifBuf), {
          status: 200,
          headers: {
            "content-length": String(50 * 1024),
            "content-type": "image/gif",
          },
        });
      }) as any;

      const result = await validateBannerImage("https://example.com/banner.gif", config);
      expect(result.valid).toBe(true);
    });

    test("reads WebP dimensions correctly", async () => {
      const config = makeConfig({ banner: { ...DEFAULT_CONFIG.banner, width: 800, height: 100, formats: ["webp"] } });
      const webpBuf = makeWebpBuffer(900, 150);

      globalThis.fetch = mock(async () => {
        return new Response(new Uint8Array(webpBuf), {
          status: 200,
          headers: {
            "content-length": String(50 * 1024),
            "content-type": "image/webp",
          },
        });
      }) as any;

      const result = await validateBannerImage("https://example.com/banner.webp", config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("900x150"))).toBe(true);
    });
  });

  describe("URL accessibility", () => {
    test("fails when URL returns non-200 status", async () => {
      globalThis.fetch = mock(async () => {
        return new Response(null, { status: 404 });
      }) as any;

      const config = makeConfig();
      const result = await validateBannerImage("https://example.com/missing.png", config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("status 404"))).toBe(true);
    });

    test("fails when fetch throws network error", async () => {
      globalThis.fetch = mock(async () => {
        throw new Error("Network error");
      }) as any;

      const config = makeConfig();
      const result = await validateBannerImage("https://example.com/banner.png", config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("not accessible"))).toBe(true);
    });
  });

  describe("multiple errors", () => {
    test("reports both size and dimension errors", async () => {
      const config = makeConfig({ banner: { ...DEFAULT_CONFIG.banner, max_size: 100, width: 400, height: 50 } });
      const pngBuf = makePngBuffer(800, 100);

      globalThis.fetch = mock(async () => {
        return new Response(new Uint8Array(pngBuf), {
          status: 200,
          headers: {
            "content-length": String(200 * 1024), // 200KB > 100KB
            "content-type": "image/png",
          },
        });
      }) as any;

      const result = await validateBannerImage("https://example.com/banner.png", config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors.some((e) => e.message.includes("200KB"))).toBe(true);
      expect(result.errors.some((e) => e.message.includes("800x100"))).toBe(true);
    });
  });
});

describe("validateCommentFormat", () => {
  test("passes with valid YAML code block containing all fields", () => {
    const body = `Here is my bid:

\`\`\`yaml
amount: 100
banner_url: https://example.com/banner.png
destination_url: https://example.com
contact: bid@example.com
\`\`\``;

    const result = validateCommentFormat(body);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("passes with yml fence tag", () => {
    const body = `\`\`\`yml
amount: 100
banner_url: https://example.com/banner.png
destination_url: https://example.com
contact: bid@example.com
\`\`\``;

    const result = validateCommentFormat(body);
    expect(result.valid).toBe(true);
  });

  test("fails when no YAML code block present", () => {
    const body = "I want to bid $100 for the banner spot!";
    const result = validateCommentFormat(body);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("YAML code block"))).toBe(true);
  });

  test("fails with plain code block (no yaml tag)", () => {
    const body = `\`\`\`
amount: 100
banner_url: https://example.com/banner.png
\`\`\``;

    const result = validateCommentFormat(body);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("YAML code block"))).toBe(true);
  });

  test("fails when required fields are missing", () => {
    const body = `\`\`\`yaml
amount: 100
\`\`\``;

    const result = validateCommentFormat(body);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("banner_url"))).toBe(true);
    expect(result.errors.some((e) => e.message.includes("destination_url"))).toBe(true);
    expect(result.errors.some((e) => e.message.includes("contact"))).toBe(true);
  });

  test("fails when all required fields are missing", () => {
    const body = `\`\`\`yaml
notes: hello
\`\`\``;

    const result = validateCommentFormat(body);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(4);
  });

  test("fails with malformed YAML (no key-value pairs)", () => {
    const body = `\`\`\`yaml
this is not yaml at all
just random text
\`\`\``;

    const result = validateCommentFormat(body);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });
});

describe("checkProhibitedContent", () => {
  test("returns no errors when no prohibited keywords found", () => {
    const bid = makeBid();
    const config = makeConfig({
      content_guidelines: { ...DEFAULT_CONFIG.content_guidelines, prohibited: ["gambling", "adult content"] },
    });

    const errors = checkProhibitedContent(bid, config);
    expect(errors).toHaveLength(0);
  });

  test("detects prohibited keyword in banner_url", () => {
    const bid = makeBid({ banner_url: "https://gambling-site.com/banner.png" });
    const config = makeConfig({
      content_guidelines: { ...DEFAULT_CONFIG.content_guidelines, prohibited: ["gambling"] },
    });

    const errors = checkProhibitedContent(bid, config);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain("gambling");
  });

  test("detects prohibited keyword in destination_url", () => {
    const bid = makeBid({ destination_url: "https://example.com/adult content page" });
    const config = makeConfig({
      content_guidelines: { ...DEFAULT_CONFIG.content_guidelines, prohibited: ["adult content"] },
    });

    const errors = checkProhibitedContent(bid, config);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain("adult content");
  });

  test("detects prohibited keyword in contact", () => {
    const bid = makeBid({ contact: "gambling@example.com" });
    const config = makeConfig({
      content_guidelines: { ...DEFAULT_CONFIG.content_guidelines, prohibited: ["gambling"] },
    });

    const errors = checkProhibitedContent(bid, config);
    expect(errors).toHaveLength(1);
  });

  test("case-insensitive matching", () => {
    const bid = makeBid({ banner_url: "https://example.com/GAMBLING-banner.png" });
    const config = makeConfig({
      content_guidelines: { ...DEFAULT_CONFIG.content_guidelines, prohibited: ["gambling"] },
    });

    const errors = checkProhibitedContent(bid, config);
    expect(errors).toHaveLength(1);
  });

  test("detects multiple prohibited keywords", () => {
    const bid = makeBid({
      banner_url: "https://gambling-site.com/banner.png",
      destination_url: "https://adult content.example.com",
    });
    const config = makeConfig({
      content_guidelines: { ...DEFAULT_CONFIG.content_guidelines, prohibited: ["gambling", "adult content"] },
    });

    const errors = checkProhibitedContent(bid, config);
    expect(errors).toHaveLength(2);
  });

  test("returns no errors when prohibited list is empty", () => {
    const bid = makeBid({ banner_url: "https://gambling.com/banner.png" });
    const config = makeConfig({
      content_guidelines: { ...DEFAULT_CONFIG.content_guidelines, prohibited: [] },
    });

    const errors = checkProhibitedContent(bid, config);
    expect(errors).toHaveLength(0);
  });
});

describe("enforceContent", () => {
  test("passes when image and content both valid", async () => {
    const config = makeConfig();
    const bid = makeBid();
    const pngBuf = makePngBuffer(400, 50);

    globalThis.fetch = mock(async () => {
      return new Response(new Uint8Array(pngBuf), {
        status: 200,
        headers: {
          "content-length": String(50 * 1024),
          "content-type": "image/png",
        },
      });
    }) as any;

    const result = await enforceContent(bid, config);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("aggregates image validation errors", async () => {
    const config = makeConfig({ banner: { ...DEFAULT_CONFIG.banner, max_size: 100 } });
    const bid = makeBid();

    globalThis.fetch = mock(async () => {
      return new Response(null, {
        status: 200,
        headers: {
          "content-length": String(200 * 1024), // 200KB > 100KB
          "content-type": "image/svg+xml",
        },
      });
    }) as any;

    const result = await enforceContent(bid, config);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("200KB"))).toBe(true);
  });

  test("aggregates content guideline errors", async () => {
    const config = makeConfig({
      content_guidelines: { ...DEFAULT_CONFIG.content_guidelines, prohibited: ["gambling"] },
    });
    const bid = makeBid({ banner_url: "https://gambling.com/banner.svg" });

    globalThis.fetch = mock(async () => {
      return new Response(null, {
        status: 200,
        headers: {
          "content-length": String(50 * 1024),
          "content-type": "image/svg+xml",
        },
      });
    }) as any;

    const result = await enforceContent(bid, config);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("gambling"))).toBe(true);
  });

  test("aggregates both image and content errors", async () => {
    const config = makeConfig({
      banner: { ...DEFAULT_CONFIG.banner, max_size: 50 },
      content_guidelines: { ...DEFAULT_CONFIG.content_guidelines, prohibited: ["gambling"] },
    });
    const bid = makeBid({ destination_url: "https://gambling.example.com" });

    globalThis.fetch = mock(async () => {
      return new Response(null, {
        status: 200,
        headers: {
          "content-length": String(100 * 1024), // 100KB > 50KB
          "content-type": "image/svg+xml",
        },
      });
    }) as any;

    const result = await enforceContent(bid, config);
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors.some((e) => e.includes("100KB"))).toBe(true);
    expect(result.errors.some((e) => e.includes("gambling"))).toBe(true);
  });

  test("handles network errors in image validation gracefully", async () => {
    const config = makeConfig();
    const bid = makeBid();

    globalThis.fetch = mock(async () => {
      throw new Error("Network error");
    }) as any;

    const result = await enforceContent(bid, config);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes("not accessible"))).toBe(true);
  });
});
