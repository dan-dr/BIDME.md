import type { BidMeConfig } from "./config";

export interface ParsedBid {
  amount: number;
  banner_url: string;
  destination_url: string;
  contact: string;
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
  const fenceMatch = body.match(/```ya?ml\s*\n([\s\S]*?)```/);
  if (!fenceMatch) return null;

  const yamlBlock = fenceMatch[1]!;
  const fields: Record<string, string> = {};

  for (const line of yamlBlock.split("\n")) {
    const match = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/);
    if (match) {
      fields[match[1]!] = match[2]!;
    }
  }

  const amount = parseFloat(fields["amount"] ?? "");
  const banner_url = fields["banner_url"] ?? "";
  const destination_url = fields["destination_url"] ?? "";
  const contact = fields["contact"] ?? "";

  if (isNaN(amount) || !banner_url || !destination_url || !contact) {
    return null;
  }

  return { amount, banner_url, destination_url, contact };
}

export function validateBid(
  bid: ParsedBid,
  config: BidMeConfig,
): ValidationResult {
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const githubUserRegex = /^@[\w-]+$/;
  if (!emailRegex.test(bid.contact) && !githubUserRegex.test(bid.contact)) {
    errors.push({
      field: "contact",
      message:
        "Contact must be a valid email address or GitHub username (@user)",
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

  const allowedFormats = config.banner.format.split(",").map((f) => f.trim());
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
