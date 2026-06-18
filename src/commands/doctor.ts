import { existsSync } from "fs";
import { join } from "path";
import { loadConfig, validateConfig } from "../lib/config.ts";
import { StripeAPI } from "../lib/stripe-integration.ts";

export interface DoctorOptions {
  target?: string;
}

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

async function githubGet(path: string): Promise<Response | null> {
  const token = process.env["GITHUB_TOKEN"] ?? process.env["BIDME_PAT"];
  const fullRepo = process.env["GITHUB_REPOSITORY"];
  if (!token || !fullRepo) return null;
  return fetch(`https://api.github.com/repos/${fullRepo}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

async function secretExists(name: string): Promise<CheckResult> {
  const response = await githubGet("/actions/secrets");
  if (!response) {
    return { name, ok: false, detail: "GITHUB_TOKEN and GITHUB_REPOSITORY required" };
  }
  if (!response.ok) return { name, ok: false, detail: `${response.status} ${response.statusText}` };
  const data = (await response.json()) as { secrets?: { name: string }[] };
  return { name, ok: data.secrets?.some((secret) => secret.name === name) ?? false };
}

async function variablesAccessAvailable(): Promise<CheckResult> {
  const response = await githubGet("/actions/variables");
  if (!response) {
    return { name: "GitHub variables API readable", ok: false, detail: "GITHUB_TOKEN and GITHUB_REPOSITORY required" };
  }
  return {
    name: "GitHub variables API readable",
    ok: response.ok,
    detail: response.ok
      ? process.env["BIDME_PAT"]
        ? "using BIDME_PAT"
        : "using GITHUB_TOKEN"
      : `${response.status} ${response.statusText}`,
  };
}

export async function runDoctor(options: DoctorOptions = {}): Promise<{ success: boolean; message: string }> {
  const target = options.target ?? process.cwd();
  const checks: CheckResult[] = [];

  checks.push(await secretExists("STRIPE_SECRET_KEY"));
  checks.push(await variablesAccessAvailable());

  const pages = await githubGet("/pages");
  checks.push({
    name: "GitHub Pages enabled",
    ok: pages?.ok ?? false,
    detail: pages ? `${pages.status} ${pages.statusText}` : "GITHUB_TOKEN and GITHUB_REPOSITORY required",
  });

  try {
    const config = await loadConfig(target);
    validateConfig(config);
    checks.push({ name: ".bidme/config.toml valid", ok: true });
  } catch (err) {
    checks.push({ name: ".bidme/config.toml valid", ok: false, detail: err instanceof Error ? err.message : String(err) });
  }

  const workflows = ["bidme-open.yml", "bidme-process-bid.yml", "bidme-close.yml", "bidme-analytics.yml"];
  const missing = workflows.filter((file) => !existsSync(join(target, ".github", "workflows", file)));
  checks.push({
    name: "Workflow files present",
    ok: missing.length === 0,
    detail: missing.length > 0 ? `missing: ${missing.join(", ")}` : undefined,
  });

  const readmePath = join(target, "README.md");
  const readme = existsSync(readmePath) ? await Bun.file(readmePath).text() : "";
  checks.push({
    name: "README banner placeholder present",
    ok: readme.includes("<!-- bidme-banner-start -->"),
  });

  checks.push({
    name: "Public BidMe Pages files present",
    ok: existsSync(join(target, "bidme", "redirect.html")) &&
      existsSync(join(target, "bidme", "stripe", "success.html")) &&
      existsSync(join(target, "bidme", "stripe", "cancelled.html")),
  });

  try {
    const stripe = new StripeAPI();
    if (!stripe.isConfigured) {
      checks.push({ name: "Stripe connection valid", ok: false, detail: "STRIPE_SECRET_KEY not set" });
    } else {
      await stripe.getAccount();
      checks.push({ name: "Stripe connection valid", ok: true });
    }
  } catch (err) {
    checks.push({ name: "Stripe connection valid", ok: false, detail: err instanceof Error ? err.message : String(err) });
  }

  for (const check of checks) {
    console.log(`${check.ok ? "✓" : "✗"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  }

  const success = checks.every((check) => check.ok);
  return {
    success,
    message: success ? "BidMe doctor passed" : "BidMe doctor found setup issues",
  };
}
