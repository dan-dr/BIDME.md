import type { PeriodData } from "./types.ts";

export interface AnalyticsClick {
  banner_id: string;
  timestamp: string;
  referrer?: string;
}

export interface AnalyticsDailyView {
  date: string;
  count: number;
  uniques: number;
}

export interface AnalyticsPeriodSummary {
  period_id: string;
  winner?: string;
  amount?: number;
  start_date: string;
  end_date: string;
  views: number;
  clicks: number;
  ctr: number;
}

export interface VariableAnalytics {
  clicks: AnalyticsClick[];
  daily_views: AnalyticsDailyView[];
  periods: AnalyticsPeriodSummary[];
  last_updated?: string;
}

const GITHUB_API = "https://api.github.com";

export const EMPTY_ANALYTICS: VariableAnalytics = {
  clicks: [],
  daily_views: [],
  periods: [],
};

function repoFromEnv(): { owner: string; repo: string } | null {
  const owner = process.env["GITHUB_REPOSITORY_OWNER"];
  const fullRepo = process.env["GITHUB_REPOSITORY"];
  const repo = fullRepo?.includes("/") ? fullRepo.split("/")[1] : fullRepo;
  if (!owner || !repo) return null;
  return { owner, repo };
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value?.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function variableToken(): string | undefined {
  return process.env["BIDME_PAT"] || process.env["GITHUB_TOKEN"];
}

async function requestVariable(
  method: "GET" | "PATCH" | "POST",
  owner: string,
  repo: string,
  token: string,
  name: string,
  value?: string,
): Promise<Response> {
  const isCreate = method === "POST";
  const path = isCreate ? "/actions/variables" : `/actions/variables/${name}`;
  const body = method === "GET" ? undefined : JSON.stringify(isCreate ? { name, value } : { value });
  return fetch(`${GITHUB_API}/repos/${owner}/${repo}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body,
  });
}

export async function readVariable<T>(name: string, fallback: T): Promise<T> {
  const envValue = process.env[name];
  if (envValue) return parseJson(envValue, fallback);

  const repo = repoFromEnv();
  const token = variableToken();
  if (!repo || !token) return fallback;

  const response = await requestVariable("GET", repo.owner, repo.repo, token, name);
  if (response.status === 404) return fallback;
  if (!response.ok) {
    throw new Error(`Failed to read GitHub variable ${name}: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { value?: string };
  return parseJson(data.value, fallback);
}

export async function writeVariable(name: string, value: unknown): Promise<void> {
  const repo = repoFromEnv();
  const token = variableToken();
  const serialized = JSON.stringify(value);

  if (!repo || !token) {
    console.log(`⚠ ${name} not written — set GITHUB_REPOSITORY and GITHUB_TOKEN in GitHub Actions`);
    return;
  }

  const patch = await requestVariable("PATCH", repo.owner, repo.repo, token, name, serialized);
  if (patch.status !== 404) {
    if (!patch.ok) {
      throw new Error(`Failed to update GitHub variable ${name}: ${patch.status} ${patch.statusText}`);
    }
    return;
  }

  const create = await requestVariable("POST", repo.owner, repo.repo, token, name, serialized);
  if (!create.ok) {
    throw new Error(`Failed to create GitHub variable ${name}: ${create.status} ${create.statusText}`);
  }
}

export async function readCurrentPeriod(): Promise<PeriodData | null> {
  const period = await readVariable<Partial<PeriodData> | null>("BIDME_CURRENT_PERIOD", null);
  if (!period?.period_id) return null;
  return period as PeriodData;
}

export async function writeCurrentPeriod(period: PeriodData | Record<string, never>): Promise<void> {
  await writeVariable("BIDME_CURRENT_PERIOD", period);
}

export async function readAnalytics(): Promise<VariableAnalytics> {
  return readVariable<VariableAnalytics>("BIDME_ANALYTICS", EMPTY_ANALYTICS);
}

export async function writeAnalytics(analytics: VariableAnalytics): Promise<void> {
  await writeVariable("BIDME_ANALYTICS", analytics);
}
