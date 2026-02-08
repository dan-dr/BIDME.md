import { resolve } from "path";
import { loadConfig, resolvePaymentUrls } from "../lib/config.ts";
import { GitHubAPI } from "../lib/github-api.ts";
import { StripeAPI } from "../lib/stripe-integration.ts";
import {
  loadBidders,
  registerBidder,
  markPaymentLinked,
  saveBidders,
  isPaymentLinked,
} from "../lib/bidder-registry.ts";
import { logError } from "../lib/error-handler.ts";

export interface SetupPaymentOptions {
  target?: string;
}

export async function runSetupPayment(
  username: string,
  issueNumber: number,
  options: SetupPaymentOptions = {},
): Promise<{ success: boolean; message: string }> {
  const target = options.target ?? process.cwd();
  console.log("=== BidMe: Setup Payment ===\n");
  console.log(`  User: @${username}`);
  console.log(`  Issue: #${issueNumber}`);

  const config = await loadConfig(target);
  const stripe = new StripeAPI();

  if (!stripe.isConfigured) {
    const msg = "Stripe not configured — cannot set up payment";
    console.log(`✗ ${msg}`);
    return { success: false, message: msg };
  }

  await loadBidders(target);

  if (isPaymentLinked(username)) {
    const msg = `Payment already linked for @${username}`;
    console.log(`✓ ${msg}`);
    return { success: true, message: msg };
  }

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const fullRepo = process.env["GITHUB_REPOSITORY"] ?? "";
  const repo = fullRepo.includes("/") ? fullRepo.split("/")[1]! : fullRepo;

  try {
    const existing = await stripe.searchCustomersByMetadata(username);
    let customerId: string;

    if (existing.length > 0) {
      customerId = existing[0]!.id;
      console.log(`✓ Found existing Stripe customer: ${customerId}`);
    } else {
      const customer = await stripe.createCustomer(
        `${username}@github.bidme`,
        { github_username: username },
      );
      customerId = customer.id;
      console.log(`✓ Created Stripe customer: ${customerId}`);
    }

    const paymentUrls = resolvePaymentUrls(config, owner, repo);
    const session = await stripe.createCheckoutSession(
      customerId,
      paymentUrls.success,
      paymentUrls.fail,
    );
    console.log(`✓ Checkout session created: ${session.url}`);

    if (owner && repo && issueNumber > 0) {
      const api = new GitHubAPI(owner, repo);
      await api.addComment(
        issueNumber,
        `💳 @${username} — Set up your payment method to activate your bid:\n\n**[Click here to set up payment](${session.url})**\n\nAfter completing payment setup, your bid will be automatically activated within 6 hours (or on the next grace period check).`,
      );
      console.log("✓ Payment setup link posted to issue");
    }

    registerBidder(username);
    await saveBidders(target);

    return { success: true, message: `Payment setup link generated for @${username}: ${session.url}` };
  } catch (err) {
    const msg = `Failed to create payment setup: ${err instanceof Error ? err.message : "Unknown error"}`;
    console.log(`✗ ${msg}`);
    logError(err, "setup-payment");
    return { success: false, message: msg };
  }
}
