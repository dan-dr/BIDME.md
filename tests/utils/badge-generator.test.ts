import { describe, test, expect } from "bun:test";
import {
  formatNumber,
  generateViewsBadge,
  generateCountriesBadge,
  generateCTRBadge,
  generateBannerSection,
} from "../../scripts/utils/badge-generator";

describe("formatNumber", () => {
  test("returns plain number below 1000", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1)).toBe("1");
    expect(formatNumber(999)).toBe("999");
  });

  test("formats thousands with k suffix", () => {
    expect(formatNumber(1000)).toBe("1k");
    expect(formatNumber(1200)).toBe("1.2k");
    expect(formatNumber(1250)).toBe("1.3k");
    expect(formatNumber(10000)).toBe("10k");
    expect(formatNumber(999999)).toBe("1000k");
  });

  test("formats millions with M suffix", () => {
    expect(formatNumber(1000000)).toBe("1M");
    expect(formatNumber(1500000)).toBe("1.5M");
    expect(formatNumber(2300000)).toBe("2.3M");
    expect(formatNumber(10000000)).toBe("10M");
  });

  test("drops trailing zero in decimal", () => {
    expect(formatNumber(5000)).toBe("5k");
    expect(formatNumber(3000000)).toBe("3M");
  });
});

describe("generateViewsBadge", () => {
  test("returns shields.io markdown with formatted count", () => {
    const badge = generateViewsBadge(1200);
    expect(badge).toBe("![Views](https://img.shields.io/badge/views-1.2k-blue)");
  });

  test("handles zero", () => {
    const badge = generateViewsBadge(0);
    expect(badge).toBe("![Views](https://img.shields.io/badge/views-0-blue)");
  });
});

describe("generateCountriesBadge", () => {
  test("returns shields.io markdown with formatted count", () => {
    const badge = generateCountriesBadge(42);
    expect(badge).toBe("![Countries](https://img.shields.io/badge/countries-42-green)");
  });

  test("handles large numbers", () => {
    const badge = generateCountriesBadge(1500);
    expect(badge).toBe("![Countries](https://img.shields.io/badge/countries-1.5k-green)");
  });
});

describe("generateCTRBadge", () => {
  test("returns shields.io markdown with formatted rate", () => {
    const badge = generateCTRBadge(3.5);
    expect(badge).toBe("![CTR](https://img.shields.io/badge/CTR-3.5%25-orange)");
  });

  test("formats whole number rates with one decimal", () => {
    const badge = generateCTRBadge(5);
    expect(badge).toBe("![CTR](https://img.shields.io/badge/CTR-5.0%25-orange)");
  });

  test("handles zero rate", () => {
    const badge = generateCTRBadge(0);
    expect(badge).toBe("![CTR](https://img.shields.io/badge/CTR-0.0%25-orange)");
  });
});

describe("generateBannerSection", () => {
  test("returns banner image linked to destination with badges", () => {
    const badges = [
      "![Views](https://img.shields.io/badge/views-1k-blue)",
      "![Countries](https://img.shields.io/badge/countries-42-green)",
    ];
    const result = generateBannerSection(
      "https://example.com/banner.png",
      "https://example.com",
      badges,
    );
    expect(result).toBe(
      "[![BidMe Banner](https://example.com/banner.png)](https://example.com)\n\n" +
      "![Views](https://img.shields.io/badge/views-1k-blue) ![Countries](https://img.shields.io/badge/countries-42-green)",
    );
  });

  test("handles single badge", () => {
    const result = generateBannerSection(
      "https://example.com/ad.png",
      "https://sponsor.com",
      ["![Views](https://img.shields.io/badge/views-500-blue)"],
    );
    expect(result).toContain("[![BidMe Banner](https://example.com/ad.png)](https://sponsor.com)");
    expect(result).toContain("![Views](https://img.shields.io/badge/views-500-blue)");
  });

  test("handles empty badges array", () => {
    const result = generateBannerSection(
      "https://example.com/ad.png",
      "https://sponsor.com",
      [],
    );
    expect(result).toBe(
      "[![BidMe Banner](https://example.com/ad.png)](https://sponsor.com)\n\n",
    );
  });
});
