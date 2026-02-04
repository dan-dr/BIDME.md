import * as clack from "@clack/prompts";
import { scaffold } from "../lib/scaffold.js";
import { DEFAULT_CONFIG, type BidMeConfig } from "../lib/config.js";

export interface InitOptions {
  target: string;
  useDefaults: boolean;
}

export type WizardConfig = BidMeConfig;

export const DEFAULT_WIZARD_CONFIG: WizardConfig = { ...DEFAULT_CONFIG };

function validatePositiveInt(value: string): string | undefined {
  const n = parseInt(value, 10);
  if (isNaN(n) || n <= 0) return "Please enter a positive number";
  return undefined;
}

export async function collectConfig(): Promise<WizardConfig> {
  const setupMode = await clack.select({
    message: "How would you like to configure BidMe?",
    options: [
      { value: "defaults", label: "Default setup", hint: "recommended" },
      { value: "customize", label: "Customize", hint: "configure each setting" },
    ],
  });

  if (clack.isCancel(setupMode)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  if (setupMode === "defaults") {
    return { ...DEFAULT_WIZARD_CONFIG };
  }

  const schedule = await clack.select({
    message: "Bidding schedule:",
    options: [
      { value: "monthly" as const, label: "Monthly", hint: "one bidding period per month" },
      { value: "weekly" as const, label: "Weekly", hint: "one bidding period per week" },
    ],
    initialValue: "monthly" as const,
  });
  if (clack.isCancel(schedule)) { clack.cancel("Setup cancelled."); process.exit(0); }

  const durationStr = await clack.text({
    message: "Bidding duration in days:",
    defaultValue: "7",
    validate: validatePositiveInt,
  });
  if (clack.isCancel(durationStr)) { clack.cancel("Setup cancelled."); process.exit(0); }

  const minBidStr = await clack.text({
    message: "Minimum bid amount in USD:",
    defaultValue: "50",
    validate: validatePositiveInt,
  });
  if (clack.isCancel(minBidStr)) { clack.cancel("Setup cancelled."); process.exit(0); }

  const incrementStr = await clack.text({
    message: "Bid increment in USD:",
    defaultValue: "5",
    validate: validatePositiveInt,
  });
  if (clack.isCancel(incrementStr)) { clack.cancel("Setup cancelled."); process.exit(0); }

  const widthStr = await clack.text({
    message: "Banner max width (px):",
    defaultValue: "800",
    validate: validatePositiveInt,
  });
  if (clack.isCancel(widthStr)) { clack.cancel("Setup cancelled."); process.exit(0); }

  const heightStr = await clack.text({
    message: "Banner max height (px):",
    defaultValue: "100",
    validate: validatePositiveInt,
  });
  if (clack.isCancel(heightStr)) { clack.cancel("Setup cancelled."); process.exit(0); }

  const formats = await clack.multiselect({
    message: "Accepted banner formats:",
    options: [
      { value: "png", label: "PNG" },
      { value: "jpg", label: "JPG" },
      { value: "svg", label: "SVG" },
      { value: "gif", label: "GIF" },
      { value: "webp", label: "WebP" },
    ],
    initialValues: ["png", "jpg", "svg"],
    required: true,
  });
  if (clack.isCancel(formats)) { clack.cancel("Setup cancelled."); process.exit(0); }

  const maxSizeStr = await clack.text({
    message: "Banner max file size in KB:",
    defaultValue: "200",
    validate: validatePositiveInt,
  });
  if (clack.isCancel(maxSizeStr)) { clack.cancel("Setup cancelled."); process.exit(0); }

  const approvalMode = await clack.select({
    message: "Bid approval mode:",
    options: [
      { value: "auto" as const, label: "Auto-accept all bids" },
      { value: "emoji" as const, label: "Emoji react to approve", hint: "you manually approve each bid" },
    ],
    initialValue: "auto" as const,
  });
  if (clack.isCancel(approvalMode)) { clack.cancel("Setup cancelled."); process.exit(0); }

  const paymentProvider = await clack.select({
    message: "Payment mode:",
    options: [
      { value: "polar-own" as const, label: "Bring your own Polar.sh", hint: "you manage your Polar account" },
      { value: "bidme-managed" as const, label: "Use BidMe managed", hint: "coming soon" },
    ],
    initialValue: "polar-own" as const,
  });
  if (clack.isCancel(paymentProvider)) { clack.cancel("Setup cancelled."); process.exit(0); }

  const allowUnlinked = await clack.select({
    message: "Allow unlinked bidders (no Polar account)?",
    options: [
      { value: false, label: "No (strict)", hint: "bidders must link Polar first" },
      { value: true, label: "Yes (with warnings)", hint: "bids accepted but flagged" },
    ],
    initialValue: false,
  });
  if (clack.isCancel(allowUnlinked)) { clack.cancel("Setup cancelled."); process.exit(0); }

  return {
    bidding: {
      schedule,
      duration: parseInt(durationStr, 10),
      minimum_bid: parseInt(minBidStr, 10),
      increment: parseInt(incrementStr, 10),
    },
    banner: {
      width: parseInt(widthStr, 10),
      height: parseInt(heightStr, 10),
      formats,
      max_size: parseInt(maxSizeStr, 10),
    },
    approval: {
      mode: approvalMode,
      allowed_reactions: ["👍"],
    },
    payment: {
      provider: paymentProvider,
      allow_unlinked_bids: allowUnlinked,
      unlinked_grace_hours: 24,
    },
    enforcement: {
      require_payment_before_bid: false,
      strikethrough_unlinked: true,
    },
    content_guidelines: {
      prohibited: ["adult content", "gambling", "misleading claims"],
      required: ["alt text", "clear branding"],
    },
  };
}

export async function runInit(options: InitOptions): Promise<void> {
  clack.intro("🎯 BidMe Setup");

  let config: WizardConfig;

  if (options.useDefaults) {
    clack.log.info("Using default configuration.");
    config = { ...DEFAULT_WIZARD_CONFIG };
  } else {
    config = await collectConfig();
  }

  const s = clack.spinner();
  s.start("Scaffolding .bidme/ directory...");

  try {
    await scaffold(options.target, config);
    s.stop("Scaffolding complete.");
  } catch (err) {
    s.stop("Scaffolding failed.");
    clack.log.error(
      `Failed to scaffold .bidme/ directory: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  clack.outro(
    "BidMe setup complete! Next steps:\n" +
    "  1. Review .bidme/config.toml\n" +
    "  2. Commit the .bidme/ folder and workflow files\n" +
    "  3. Push to GitHub to activate bidding",
  );
}
