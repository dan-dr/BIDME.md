import { describe, test, expect, beforeAll } from "bun:test";

let indexHtml: string;
let redirectHtml: string;
let styleCss: string;

beforeAll(async () => {
  indexHtml = await Bun.file("pages/index.html").text();
  redirectHtml = await Bun.file("pages/redirect.html").text();
  styleCss = await Bun.file("pages/assets/css/style.css").text();
});

describe("pages/index.html", () => {
  test("is valid HTML with doctype", () => {
    expect(indexHtml).toMatch(/^<!DOCTYPE html>/i);
    expect(indexHtml).toContain("<html");
    expect(indexHtml).toContain("</html>");
  });

  test("has BidMe title and meta viewport", () => {
    expect(indexHtml).toContain("<title>BidMe");
    expect(indexHtml).toContain('name="viewport"');
  });

  test("uses dark theme with #0a0a0a background", () => {
    expect(indexHtml).toContain("#0a0a0a");
  });

  test("uses monospace font family for headings", () => {
    expect(indexHtml).toContain("monospace");
    expect(indexHtml).toContain("h1,h2,h3{font-family:");
  });

  test("uses green accent color #22c55e", () => {
    expect(indexHtml).toContain("#22c55e");
  });

  test("has 3-step flow: Install, Bids Come In, Get Paid", () => {
    expect(indexHtml).toContain("Install");
    expect(indexHtml).toContain("Bids Come In");
    expect(indexHtml).toContain("Get Paid");
  });

  test("has Get Started CTA linking to GitHub repo", () => {
    expect(indexHtml).toContain("Get Started");
    expect(indexHtml).toContain("github.com");
  });

  test("explains what BidMe is", () => {
    expect(indexHtml).toContain("README");
    expect(indexHtml).toContain("bid");
  });
});

describe("pages/redirect.html", () => {
  test("is valid HTML with doctype", () => {
    expect(redirectHtml).toMatch(/^<!DOCTYPE html>/i);
    expect(redirectHtml).toContain("<html");
    expect(redirectHtml).toContain("</html>");
  });

  test("reads id, dest, and ref query parameters", () => {
    expect(redirectHtml).toContain('params.get("id")');
    expect(redirectHtml).toContain('params.get("dest")');
    expect(redirectHtml).toContain('params.get("ref")');
  });

  test("appends ref parameter to destination URL", () => {
    expect(redirectHtml).toContain('"ref"');
    expect(redirectHtml).toContain('"bidme"');
  });

  test("fires bidme-click event via GitHub API dispatch", () => {
    expect(redirectHtml).toContain("bidme-click");
    expect(redirectHtml).toContain("/dispatches");
    expect(redirectHtml).toContain("event_type");
    expect(redirectHtml).toContain("client_payload");
  });

  test("falls back to tracking pixel when API fails", () => {
    expect(redirectHtml).toContain("tracking-pixel");
    expect(redirectHtml).toContain("shields.io");
    expect(redirectHtml).toContain("fallbackTrack");
  });

  test("shows branded interstitial message", () => {
    expect(redirectHtml).toContain("Redirecting via BidMe...");
    expect(redirectHtml).toContain("BidMe");
  });

  test("redirects via window.location.href after delay", () => {
    expect(redirectHtml).toContain("window.location.href");
    expect(redirectHtml).toContain("setTimeout");
    expect(redirectHtml).toContain("1500");
  });

  test("shows fallback link for manual redirect", () => {
    expect(redirectHtml).toContain("Click here if not redirected");
    expect(redirectHtml).toContain("fallback");
  });

  test("handles missing dest parameter gracefully", () => {
    expect(redirectHtml).toContain("No destination specified");
  });

  test("handles invalid dest URL gracefully", () => {
    expect(redirectHtml).toContain("Invalid destination URL");
  });

  test("extracts owner/repo from GitHub Pages hostname", () => {
    expect(redirectHtml).toContain(".github.io");
    expect(redirectHtml).toContain("owner");
    expect(redirectHtml).toContain("repo");
  });
});

describe("pages/assets/css/style.css", () => {
  test("defines CSS custom properties", () => {
    expect(styleCss).toContain(":root");
    expect(styleCss).toContain("--bg:");
    expect(styleCss).toContain("--accent:");
    expect(styleCss).toContain("--surface:");
    expect(styleCss).toContain("--text:");
  });

  test("uses dark theme colors", () => {
    expect(styleCss).toContain("#0a0a0a");
    expect(styleCss).toContain("#22c55e");
  });

  test("includes responsive grid classes", () => {
    expect(styleCss).toContain(".grid");
    expect(styleCss).toContain("grid-template-columns");
    expect(styleCss).toContain("auto-fit");
  });

  test("includes card component styles", () => {
    expect(styleCss).toContain(".card");
    expect(styleCss).toContain(".card-header");
    expect(styleCss).toContain(".card-title");
    expect(styleCss).toContain(".card-value");
  });

  test("includes button styles", () => {
    expect(styleCss).toContain(".btn");
    expect(styleCss).toContain(".btn-primary");
    expect(styleCss).toContain(".btn-outline");
  });

  test("includes table styles", () => {
    expect(styleCss).toContain("table");
    expect(styleCss).toContain(".table-wrap");
  });

  test("includes badge component styles", () => {
    expect(styleCss).toContain(".badge");
    expect(styleCss).toContain(".badge-success");
    expect(styleCss).toContain(".badge-danger");
  });

  test("includes input styles", () => {
    expect(styleCss).toContain(".input");
  });

  test("includes layout utilities", () => {
    expect(styleCss).toContain(".container");
    expect(styleCss).toContain(".sidebar");
    expect(styleCss).toContain(".flex");
  });
});
