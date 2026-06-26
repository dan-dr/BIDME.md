import type { BidMeConfig } from "./config.ts";

export interface ParsedBid {
  amount: number;
  banner_url: string;
  destination_url: string;
  tagline?: string;
  contact?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function parseBidComment(body: string): ParsedBid | null {
  const frontMatter = body.match(/---\s*\n([\s\S]*?)\n---/);
  const fenceMatch = body.match(/```ya?ml\s*\n([\s\S]*?)```/);
  const yamlBlock = frontMatter?.[1] ?? fenceMatch?.[1];
  if (!yamlBlock) return null;

  const fields: Record<string, string> = {};
  let inBid = false;

  for (const line of yamlBlock.split("\n")) {
    if (/^\s*bid\s*:\s*$/.test(line)) {
      inBid = true;
      continue;
    }
    const match = line.match(/^\s*(\w+)\s*:\s*["']?(.+?)["']?\s*$/);
    if (match) {
      if (frontMatter && !inBid) continue;
      fields[match[1]!] = match[2]!;
    }
  }

  const amount = parseFloat(fields["amount"] ?? "");
  const banner_url = fields["banner_url"] ?? extractFirstMarkdownImage(body) ?? "";
  const destination_url = fields["destination_url"] ?? "";
  const tagline = fields["tagline"] ?? fields["alt_text"] ?? "";
  const contact = fields["contact"];

  if (isNaN(amount) || !destination_url || !tagline) {
    return null;
  }

  return { amount, banner_url, destination_url, tagline, contact };
}

export function extractFirstMarkdownImage(body: string): string | null {
  const match = body.match(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/);
  return match?.[1] ?? null;
}

export function validateBid(bid: ParsedBid, config: BidMeConfig): ValidationResult {
  const errors: ValidationError[] = [];

  if (bid.amount < config.bidding.minimum_bid) {
    errors.push({
      field: "amount",
      message: `Bid must be at least $${config.bidding.minimum_bid}`,
    });
  }

  if (bid.amount % config.bidding.increment !== 0) {
    errors.push({
      field: "amount",
      message: `Bid must be in increments of $${config.bidding.increment}`,
    });
  }

  if (!bid.banner_url) {
    errors.push({
      field: "banner_url",
      message: "Attach a banner image to the GitHub comment",
    });
  } else {
    try {
      const url = new URL(bid.banner_url);
      if (!["http:", "https:"].includes(url.protocol)) {
        errors.push({
          field: "banner_url",
          message: "Banner URL must use http or https protocol",
        });
      }
    } catch {
      errors.push({
        field: "banner_url",
        message: "Banner URL is not a valid URL",
      });
    }
  }

  try {
    const url = new URL(bid.destination_url);
    if (!["http:", "https:"].includes(url.protocol)) {
      errors.push({
        field: "destination_url",
        message: "Destination URL must use http or https protocol",
      });
    }
  } catch {
    errors.push({
      field: "destination_url",
      message: "Destination URL is not a valid URL",
    });
  }

  if (!bid.tagline?.trim()) {
    errors.push({
      field: "tagline",
      message: "Tagline is required",
    });
  }

  return { valid: errors.length === 0, errors };
}

export async function validateBannerUrl(
  url: string,
  config: BidMeConfig,
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  try {
    new URL(url);
  } catch {
    errors.push({
      field: "banner_url",
      message: "Banner URL is not a valid URL",
    });
    return { valid: false, errors };
  }

  const allowedFormats = config.banner.formats;
  const urlPath = new URL(url).pathname.toLowerCase();
  const lastSegment = urlPath.split("/").pop() ?? "";
  const ext = lastSegment.includes(".") ? lastSegment.split(".").pop()! : "";
  if (ext && !allowedFormats.includes(ext)) {
    errors.push({
      field: "banner_url",
      message: `Banner format must be one of: ${allowedFormats.join(", ")}`,
    });
  }

  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) {
      errors.push({
        field: "banner_url",
        message: `Banner URL returned status ${response.status}`,
      });
    }
  } catch {
    errors.push({
      field: "banner_url",
      message: "Banner URL is not accessible",
    });
  }

  return { valid: errors.length === 0, errors };
}
