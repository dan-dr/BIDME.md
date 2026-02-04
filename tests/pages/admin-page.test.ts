import { describe, test, expect, beforeAll } from "bun:test";

let adminHtml: string;
let adminJs: string;

beforeAll(async () => {
  adminHtml = await Bun.file("pages/admin.html").text();
  adminJs = await Bun.file("pages/assets/js/admin.js").text();
});

describe("pages/admin.html", () => {
  test("is valid HTML with doctype", () => {
    expect(adminHtml).toMatch(/^<!DOCTYPE html>/i);
    expect(adminHtml).toContain("<html");
    expect(adminHtml).toContain("</html>");
  });

  test("has BidMe Admin title and meta viewport", () => {
    expect(adminHtml).toContain("<title>BidMe");
    expect(adminHtml).toContain("Admin");
    expect(adminHtml).toContain('name="viewport"');
  });

  test("links to shared style.css", () => {
    expect(adminHtml).toContain("assets/css/style.css");
  });

  test("loads admin.js script", () => {
    expect(adminHtml).toContain("assets/js/admin.js");
  });

  test("has page header with brand tag", () => {
    expect(adminHtml).toContain("brand-tag");
    expect(adminHtml).toContain("Admin Panel");
  });

  test("has loading, error, and admin display states", () => {
    expect(adminHtml).toContain('id="loading"');
    expect(adminHtml).toContain('id="error"');
    expect(adminHtml).toContain('id="admin"');
  });

  test("has current bids section", () => {
    expect(adminHtml).toContain('id="bids-list"');
    expect(adminHtml).toContain("Current Bids");
  });

  test("has configuration summary section", () => {
    expect(adminHtml).toContain('id="config-summary"');
    expect(adminHtml).toContain("Configuration");
  });

  test("has current bidding issue section", () => {
    expect(adminHtml).toContain('id="bidding-issue"');
    expect(adminHtml).toContain("Current Bidding Issue");
  });

  test("has payment history section", () => {
    expect(adminHtml).toContain('id="payment-history"');
    expect(adminHtml).toContain("Payment History");
  });

  test("has manual actions section", () => {
    expect(adminHtml).toContain('id="manual-actions"');
    expect(adminHtml).toContain("Manual Actions");
  });

  test("has spinner animation for loading state", () => {
    expect(adminHtml).toContain("spinner-sm");
    expect(adminHtml).toContain("@keyframes spin");
  });

  test("has responsive styles for mobile", () => {
    expect(adminHtml).toContain("@media");
    expect(adminHtml).toContain("640px");
  });

  test("has footer", () => {
    expect(adminHtml).toContain("<footer");
    expect(adminHtml).toContain("BidMe Admin");
  });
});

describe("pages/assets/js/admin.js", () => {
  test("uses IIFE pattern with strict mode", () => {
    expect(adminJs).toContain("(function ()");
    expect(adminJs).toContain('"use strict"');
  });

  test("detects owner/repo from URL params", () => {
    expect(adminJs).toContain('params.get("owner")');
    expect(adminJs).toContain('params.get("repo")');
  });

  test("detects owner/repo from GitHub Pages hostname", () => {
    expect(adminJs).toContain(".github.io");
  });

  test("has formatNumber utility", () => {
    expect(adminJs).toContain("function formatNumber");
    expect(adminJs).toContain("1000000");
    expect(adminJs).toContain("1000");
  });

  test("has escapeHtml and escapeAttr utilities", () => {
    expect(adminJs).toContain("function escapeHtml");
    expect(adminJs).toContain("function escapeAttr");
  });

  test("fetches repo data from raw.githubusercontent.com", () => {
    expect(adminJs).toContain("function fetchRepoData");
    expect(adminJs).toContain("raw.githubusercontent.com");
  });

  test("fetches YAML config from repo", () => {
    expect(adminJs).toContain("function fetchRepoYaml");
    expect(adminJs).toContain("bidme-config.yml");
  });

  test("has YAML parser for config display", () => {
    expect(adminJs).toContain("function parseSimpleYaml");
  });

  test("renders configuration summary from YAML", () => {
    expect(adminJs).toContain("function renderConfig");
    expect(adminJs).toContain("Schedule");
    expect(adminJs).toContain("Minimum Bid");
    expect(adminJs).toContain("Banner Size");
  });

  test("renders current bids with approve/reject actions", () => {
    expect(adminJs).toContain("function renderBids");
    expect(adminJs).toContain("btn-approve");
    expect(adminJs).toContain("btn-reject");
    expect(adminJs).toContain("Approve");
    expect(adminJs).toContain("Reject");
  });

  test("renders bidding issue with link to GitHub issue", () => {
    expect(adminJs).toContain("function renderBiddingIssue");
    expect(adminJs).toContain("issue_number");
    expect(adminJs).toContain("function buildIssueUrl");
  });

  test("renders payment history table", () => {
    expect(adminJs).toContain("function renderPaymentHistory");
    expect(adminJs).toContain("payment_status");
    expect(adminJs).toContain("Winner");
    expect(adminJs).toContain("Amount");
  });

  test("renders manual actions with workflow dispatch links", () => {
    expect(adminJs).toContain("function renderManualActions");
    expect(adminJs).toContain("function buildWorkflowUrl");
    expect(adminJs).toContain("actions/workflows");
    expect(adminJs).toContain("update-analytics.yml");
    expect(adminJs).toContain("schedule-bidding.yml");
    expect(adminJs).toContain("close-bidding.yml");
  });

  test("handles missing owner/repo with error message", () => {
    expect(adminJs).toContain("Could not determine repository");
    expect(adminJs).toContain("?owner=OWNER&repo=REPO");
  });

  test("fetches data from three sources in parallel", () => {
    expect(adminJs).toContain("bidme-config.yml");
    expect(adminJs).toContain("data/current-period.json");
    expect(adminJs).toContain("data/analytics.json");
  });

  test("uses tryRender pattern to wait for all data", () => {
    expect(adminJs).toContain("function tryRender");
    expect(adminJs).toContain("configLoaded");
    expect(adminJs).toContain("periodLoaded");
    expect(adminJs).toContain("analyticsLoaded");
  });

  test("shows loading and error states", () => {
    expect(adminJs).toContain('hide("loading")');
    expect(adminJs).toContain('show("error")');
    expect(adminJs).toContain('show("admin")');
  });
});
