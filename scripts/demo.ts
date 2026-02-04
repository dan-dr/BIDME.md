import { loadConfig } from "./utils/config";
import { parseBidComment, validateBid } from "./utils/validation";
import {
  generateViewsBadge,
  generateCountriesBadge,
  generateCTRBadge,
  generateBannerSection,
} from "./utils/badge-generator";

const SAMPLE_BID_COMMENT = `
I'd like to bid on your banner space!

\`\`\`yaml
amount: 100
banner_url: https://example.com/my-banner.png
destination_url: https://example.com/landing
contact: @bidder123
\`\`\`

Looking forward to working with you!
`;

async function main() {
  console.log("=== BidMe Demo ===\n");

  // 1. Load config
  const config = await loadConfig();
  console.log("✓ Config loaded");
  console.log(`  Schedule: ${config.bidding.schedule}`);
  console.log(`  Minimum bid: $${config.bidding.minimum_bid}`);
  console.log(`  Increment: $${config.bidding.increment}`);
  console.log(`  Banner: ${config.banner.width}x${config.banner.height}px\n`);

  // 2. Parse sample bid comment
  const bid = parseBidComment(SAMPLE_BID_COMMENT);
  if (!bid) {
    console.error("✗ Failed to parse bid comment");
    process.exit(1);
  }
  console.log("✓ Bid parsed");
  console.log(`  Amount: $${bid.amount}`);
  console.log(`  Banner: ${bid.banner_url}`);
  console.log(`  Destination: ${bid.destination_url}`);
  console.log(`  Contact: ${bid.contact}\n`);

  // 3. Validate the parsed bid
  const result = validateBid(bid, config);
  if (result.valid) {
    console.log("✓ Validation passed\n");
  } else {
    console.log("✗ Validation failed:");
    for (const err of result.errors) {
      console.log(`  - ${err.field}: ${err.message}`);
    }
    console.log();
  }

  // 4. Generate banner section with badges
  const badges = [
    generateViewsBadge(12500),
    generateCountriesBadge(42),
    generateCTRBadge(3.2),
  ];
  const markdown = generateBannerSection(
    bid.banner_url,
    bid.destination_url,
    badges,
  );
  console.log("✓ Generated markdown output:");
  console.log("---");
  console.log(markdown);
  console.log("---\n");

  console.log("=== Demo complete ===");
}

main();
