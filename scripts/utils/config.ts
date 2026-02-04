import yaml from "js-yaml";
import { resolve } from "path";

export interface BiddingConfig {
  schedule: "weekly" | "monthly";
  duration: number;
  minimum_bid: number;
  increment: number;
}

export interface BannerConfig {
  width: number;
  height: number;
  format: string;
  max_size: number;
  position: "top" | "bottom";
}

export interface ContentGuidelinesConfig {
  prohibited: string[];
  required: string[];
}

export interface AnalyticsConfig {
  display: boolean;
  metrics: string[];
}

export interface BidMeConfig {
  bidding: BiddingConfig;
  banner: BannerConfig;
  content_guidelines: ContentGuidelinesConfig;
  analytics: AnalyticsConfig;
}

const DEFAULT_CONFIG: BidMeConfig = {
  bidding: {
    schedule: "monthly",
    duration: 7,
    minimum_bid: 50,
    increment: 5,
  },
  banner: {
    width: 800,
    height: 100,
    format: "png,jpg,svg",
    max_size: 200,
    position: "top",
  },
  content_guidelines: {
    prohibited: ["adult content", "gambling", "misleading claims"],
    required: ["alt text", "clear branding"],
  },
  analytics: {
    display: true,
    metrics: ["views", "countries", "referrers", "clicks"],
  },
};

function deepMerge<T extends Record<string, unknown>>(
  defaults: T,
  overrides: Partial<T>,
): T {
  const result = { ...defaults };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const val = overrides[key];
    if (
      val !== undefined &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      val !== null &&
      typeof defaults[key] === "object" &&
      !Array.isArray(defaults[key])
    ) {
      result[key] = deepMerge(
        defaults[key] as Record<string, unknown>,
        val as Record<string, unknown>,
      ) as T[keyof T];
    } else if (val !== undefined) {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}

export async function loadConfig(
  configPath?: string,
): Promise<BidMeConfig> {
  const filePath = configPath ?? resolve(process.cwd(), "bidme-config.yml");
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) {
    return { ...DEFAULT_CONFIG };
  }
  const content = await file.text();
  const parsed = yaml.load(content) as Partial<BidMeConfig> | null;
  if (!parsed || typeof parsed !== "object") {
    return { ...DEFAULT_CONFIG };
  }
  return deepMerge(DEFAULT_CONFIG, parsed);
}
