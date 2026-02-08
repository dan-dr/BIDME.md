import TOML from "@iarna/toml";
import { resolve } from "path";

export interface BidMeConfig {
  bidding: {
    schedule: "weekly" | "monthly";
    duration: number;
    minimum_bid: number;
    increment: number;
  };
  banner: {
    width: number;
    height: number;
    formats: string[];
    max_size: number;
  };
  approval: {
    mode: "auto" | "emoji";
    allowed_reactions: string[];
  };
  payment: {
    provider: "stripe";
    allow_unlinked_bids: boolean;
    unlinked_grace_hours: number;
    payment_link: string;
    bidme_fee_percent: number;
  };
  enforcement: {
    require_payment_before_bid: boolean;
    strikethrough_unlinked: boolean;
  };
  tracking: {
    append_utm: boolean;
    utm_params: string;
  };
  content_guidelines: {
    prohibited: string[];
    required: string[];
  };
}

export const DEFAULT_CONFIG: BidMeConfig = {
  bidding: {
    schedule: "monthly",
    duration: 7,
    minimum_bid: 50,
    increment: 5,
  },
  banner: {
    width: 800,
    height: 100,
    formats: ["png", "jpg", "svg"],
    max_size: 200,
  },
  approval: {
    mode: "emoji",
    allowed_reactions: ["👍"],
  },
  payment: {
    provider: "stripe",
    allow_unlinked_bids: false,
    unlinked_grace_hours: 24,
    payment_link: "https://bidme.md/payment/success",
    bidme_fee_percent: 10,
  },
  enforcement: {
    require_payment_before_bid: true,
    strikethrough_unlinked: true,
  },
  tracking: {
    append_utm: true,
    utm_params: "source=bidme&repo={owner}/{repo}",
  },
  content_guidelines: {
    prohibited: ["adult content", "gambling", "misleading claims"],
    required: ["alt text", "clear branding"],
  },
};

function deepMerge<T extends object>(defaults: T, overrides: Partial<T>): T {
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

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

export function validateConfig(config: unknown): BidMeConfig {
  if (!config || typeof config !== "object") {
    throw new ConfigValidationError("Config must be a non-null object");
  }

  const c = config as Record<string, unknown>;
  const merged = deepMerge(DEFAULT_CONFIG, c as Partial<BidMeConfig>);

  if (merged.bidding) {
    if (typeof merged.bidding.duration !== "number" || merged.bidding.duration <= 0) {
      throw new ConfigValidationError("bidding.duration must be a positive number");
    }
    if (typeof merged.bidding.minimum_bid !== "number" || merged.bidding.minimum_bid < 0) {
      throw new ConfigValidationError("bidding.minimum_bid must be a non-negative number");
    }
    if (typeof merged.bidding.increment !== "number" || merged.bidding.increment < 0) {
      throw new ConfigValidationError("bidding.increment must be a non-negative number");
    }
    const validSchedules = ["weekly", "monthly"];
    if (!validSchedules.includes(merged.bidding.schedule)) {
      throw new ConfigValidationError(
        `bidding.schedule must be one of: ${validSchedules.join(", ")}`,
      );
    }
  }

  if (merged.banner) {
    if (typeof merged.banner.width !== "number" || merged.banner.width <= 0) {
      throw new ConfigValidationError("banner.width must be a positive number");
    }
    if (typeof merged.banner.height !== "number" || merged.banner.height <= 0) {
      throw new ConfigValidationError("banner.height must be a positive number");
    }
    if (typeof merged.banner.max_size !== "number" || merged.banner.max_size <= 0) {
      throw new ConfigValidationError("banner.max_size must be a positive number");
    }
  }

  if (merged.approval) {
    const validModes = ["auto", "emoji"];
    if (!validModes.includes(merged.approval.mode)) {
      throw new ConfigValidationError(
        `approval.mode must be one of: ${validModes.join(", ")}`,
      );
    }
  }

  if (merged.payment) {
    const validProviders = ["stripe"];
    if (!validProviders.includes(merged.payment.provider)) {
      throw new ConfigValidationError(
        `payment.provider must be one of: ${validProviders.join(", ")}`,
      );
    }
    if (
      typeof merged.payment.unlinked_grace_hours !== "number" ||
      merged.payment.unlinked_grace_hours < 0
    ) {
      throw new ConfigValidationError(
        "payment.unlinked_grace_hours must be a non-negative number",
      );
    }
    if (
      typeof merged.payment.bidme_fee_percent !== "number" ||
      merged.payment.bidme_fee_percent < 0 ||
      merged.payment.bidme_fee_percent > 100
    ) {
      throw new ConfigValidationError(
        "payment.bidme_fee_percent must be a number between 0 and 100",
      );
    }
  }

  if (merged.tracking) {
    if (typeof merged.tracking.append_utm !== "boolean") {
      throw new ConfigValidationError("tracking.append_utm must be a boolean");
    }
    if (typeof merged.tracking.utm_params !== "string") {
      throw new ConfigValidationError("tracking.utm_params must be a string");
    }
  }

  return merged;
}

export async function loadConfig(targetDir?: string): Promise<BidMeConfig> {
  const dir = targetDir ?? process.cwd();
  const configPath = resolve(dir, ".bidme", "config.toml");
  const file = Bun.file(configPath);
  const exists = await file.exists();
  if (!exists) {
    return { ...DEFAULT_CONFIG };
  }
  const content = await file.text();
  const parsed = TOML.parse(content) as unknown as Partial<BidMeConfig>;
  if (!parsed || typeof parsed !== "object") {
    return { ...DEFAULT_CONFIG };
  }
  return deepMerge(DEFAULT_CONFIG, parsed);
}

export async function saveConfig(
  config: BidMeConfig,
  targetDir?: string,
): Promise<void> {
  const dir = targetDir ?? process.cwd();
  const configPath = resolve(dir, ".bidme", "config.toml");
  const toml = generateToml(config);
  await Bun.write(configPath, toml);
}

export function generateToml(config: BidMeConfig): string {
  const header = `# BidMe Configuration
# Generated by \`bidme init\`
# Documentation: https://github.com/nicepkg/bidme

`;

  const sections: string[] = [header];

  sections.push(`# Bidding schedule and pricing
[bidding]
schedule = "${config.bidding.schedule}"
duration = ${config.bidding.duration}
minimum_bid = ${config.bidding.minimum_bid}
increment = ${config.bidding.increment}
`);

  sections.push(`# Banner display constraints
[banner]
width = ${config.banner.width}
height = ${config.banner.height}
formats = ${JSON.stringify(config.banner.formats)}
max_size = ${config.banner.max_size}
`);

  sections.push(`# Bid approval settings
[approval]
mode = "${config.approval.mode}"
allowed_reactions = ${JSON.stringify(config.approval.allowed_reactions)}
`);

  sections.push(`# Payment configuration (Stripe)
[payment]
provider = "${config.payment.provider}"
allow_unlinked_bids = ${config.payment.allow_unlinked_bids}
unlinked_grace_hours = ${config.payment.unlinked_grace_hours}
payment_link = "${config.payment.payment_link}"
bidme_fee_percent = ${config.payment.bidme_fee_percent}
`);

  sections.push(`# Enforcement rules
[enforcement]
require_payment_before_bid = ${config.enforcement.require_payment_before_bid}
strikethrough_unlinked = ${config.enforcement.strikethrough_unlinked}
`);

  sections.push(`# UTM tracking for bid links
[tracking]
append_utm = ${config.tracking.append_utm}
utm_params = "${config.tracking.utm_params}"
`);

  sections.push(`# Content guidelines for banner submissions
[content_guidelines]
prohibited = ${JSON.stringify(config.content_guidelines.prohibited)}
required = ${JSON.stringify(config.content_guidelines.required)}
`);

  return sections.join("\n");
}

export function parseToml(tomlString: string): BidMeConfig {
  const parsed = TOML.parse(tomlString) as unknown as BidMeConfig;
  return parsed;
}
