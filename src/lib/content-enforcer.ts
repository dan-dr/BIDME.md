import type { BidMeConfig } from "./config.ts";
import type { ParsedBid } from "./validation.ts";
import type { ValidationResult, ValidationError } from "./validation.ts";

const FORMAT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  gif: "image/gif",
  webp: "image/webp",
};

export async function validateBannerImage(
  url: string,
  config: BidMeConfig,
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  const allowedMimes = config.banner.formats
    .map((f) => FORMAT_TO_MIME[f.toLowerCase()])
    .filter(Boolean) as string[];

  try {
    const response = await fetch(url, { method: "HEAD" });

    if (!response.ok) {
      errors.push({
        field: "banner_url",
        message: `Banner URL returned status ${response.status}`,
      });
      return { valid: false, errors };
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const sizeKB = Math.ceil(parseInt(contentLength, 10) / 1024);
      if (sizeKB > config.banner.max_size) {
        errors.push({
          field: "banner_url",
          message: `Image is ${sizeKB}KB, max allowed is ${config.banner.max_size}KB`,
        });
      }
    }

    const contentType = response.headers.get("content-type");
    if (contentType) {
      const mime = contentType.split(";")[0]!.trim().toLowerCase();
      if (allowedMimes.length > 0 && !allowedMimes.includes(mime)) {
        const ext = Object.entries(FORMAT_TO_MIME).find(([, v]) => v === mime)?.[0] ?? mime;
        errors.push({
          field: "banner_url",
          message: `Format .${ext} is not in allowed formats: ${config.banner.formats.join(", ")}`,
        });
      }

      if (mime !== "image/svg+xml") {
        try {
          const imgResponse = await fetch(url);
          const buffer = await imgResponse.arrayBuffer();
          const dimensions = readImageDimensions(new Uint8Array(buffer), mime);
          if (dimensions) {
            const { width, height } = dimensions;
            if (width > config.banner.width || height > config.banner.height) {
              errors.push({
                field: "banner_url",
                message: `Image is ${width}x${height}, max allowed is ${config.banner.width}x${config.banner.height}`,
              });
            }
          }
        } catch {
          // Can't check dimensions — not a fatal error
        }
      }
    }
  } catch {
    errors.push({
      field: "banner_url",
      message: "Banner URL is not accessible",
    });
  }

  return { valid: errors.length === 0, errors };
}

function readImageDimensions(
  data: Uint8Array,
  mime: string,
): { width: number; height: number } | null {
  if (mime === "image/png" && data.length >= 24) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    return { width, height };
  }

  if ((mime === "image/jpeg" || mime === "image/jpg") && data.length > 2) {
    let offset = 2;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    while (offset < data.length - 1) {
      if (data[offset] !== 0xff) break;
      const marker = data[offset + 1]!;
      if (marker === 0xc0 || marker === 0xc2) {
        if (offset + 9 <= data.length) {
          const height = view.getUint16(offset + 5);
          const width = view.getUint16(offset + 7);
          return { width, height };
        }
        break;
      }
      if (offset + 3 >= data.length) break;
      const segLen = view.getUint16(offset + 2);
      offset += 2 + segLen;
    }
  }

  if (mime === "image/gif" && data.length >= 10) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const width = view.getUint16(6, true);
    const height = view.getUint16(8, true);
    return { width, height };
  }

  if (mime === "image/webp" && data.length >= 30) {
    const riff = String.fromCharCode(data[0]!, data[1]!, data[2]!, data[3]!);
    const webp = String.fromCharCode(data[8]!, data[9]!, data[10]!, data[11]!);
    if (riff === "RIFF" && webp === "WEBP") {
      const vp8 = String.fromCharCode(data[12]!, data[13]!, data[14]!, data[15]!);
      if (vp8 === "VP8 " && data.length >= 30) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const width = view.getUint16(26, true) & 0x3fff;
        const height = view.getUint16(28, true) & 0x3fff;
        return { width, height };
      }
    }
  }

  return null;
}

export function validateCommentFormat(body: string): ValidationResult {
  const errors: ValidationError[] = [];

  const fenceMatch = body.match(/```ya?ml\s*\n([\s\S]*?)```/);
  if (!fenceMatch) {
    errors.push({
      field: "comment",
      message: "Comment must contain a properly formatted YAML code block",
    });
    return { valid: false, errors };
  }

  const yamlBlock = fenceMatch[1]!;
  const fields: Record<string, string> = {};
  for (const line of yamlBlock.split("\n")) {
    const match = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/);
    if (match) {
      fields[match[1]!] = match[2]!;
    }
  }

  const required = ["amount", "banner_url", "destination_url", "contact"];
  for (const field of required) {
    if (!fields[field]) {
      errors.push({
        field,
        message: `Missing required field: ${field}`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function checkProhibitedContent(
  bid: ParsedBid,
  config: BidMeConfig,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const prohibited = config.content_guidelines.prohibited;

  const checkableText = [
    bid.banner_url,
    bid.destination_url,
    bid.contact,
  ].join(" ").toLowerCase();

  for (const keyword of prohibited) {
    if (checkableText.includes(keyword.toLowerCase())) {
      errors.push({
        field: "content",
        message: `Content contains prohibited keyword: "${keyword}"`,
      });
    }
  }

  return errors;
}

export async function enforceContent(
  bid: ParsedBid,
  config: BidMeConfig,
): Promise<{ passed: boolean; errors: string[] }> {
  const allErrors: string[] = [];

  const imageResult = await validateBannerImage(bid.banner_url, config);
  for (const err of imageResult.errors) {
    allErrors.push(err.message);
  }

  const contentErrors = checkProhibitedContent(bid, config);
  for (const err of contentErrors) {
    allErrors.push(err.message);
  }

  return { passed: allErrors.length === 0, errors: allErrors };
}
