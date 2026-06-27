const STATUS_START = "<!-- bidme-status -->";
const STATUS_END = "<!-- /bidme-status -->";

const STATUS_BLOCK_PATTERN = new RegExp(`${STATUS_START}[\\s\\S]*?${STATUS_END}\\n*`);

/**
 * Recovers the bidder's original comment body, stripping any BIDME status block
 * a previous run may have prepended. Safe to call on an undecorated comment.
 */
export function extractOriginalBody(body: string): string {
  return body.replace(STATUS_BLOCK_PATTERN, "").trimStart();
}

/**
 * Prepends a BIDME status block to the bidder's comment, replacing any earlier
 * block so repeated edits stay idempotent. Terminal states (rejected/expired)
 * collapse the original bid into a struck-through details block.
 */
export function decorateBidComment(
  currentBody: string,
  statusBlock: string,
  options: { collapseOriginal?: boolean; summary?: string } = {},
): string {
  const original = extractOriginalBody(currentBody);
  const rendered = options.collapseOriginal ? collapseStruck(original, options.summary) : original;
  return `${STATUS_START}\n${statusBlock}\n${STATUS_END}\n\n${rendered}`;
}

export function acceptedBanner(amount: number, rank: number): string {
  return `> [!NOTE]
> ✅ **Bid active** — $${amount} · Rank #${rank} · payment linked. The highest active bid when the period closes wins the banner.`;
}

export function paymentRequiredBanner(
  amount: number,
  checkoutUrl: string,
  graceHours: number,
): string {
  if (!checkoutUrl) {
    return `> [!WARNING]
> 💳 **Payment required** — $${amount}. Payment authorization could not be started automatically. This bid is paused until Stripe setup is fixed.`;
  }
  return `> [!WARNING]
> 💳 **Payment required** — $${amount}. [Authorize your card](${checkoutUrl}) within ${graceHours}h to activate this bid.`;
}

export function rejectedBanner(reasons: string[]): string {
  const list = reasons.map((reason) => `> - ${reason}`).join("\n");
  return `> [!CAUTION]
> ❌ **Bid rejected**
>
${list}`;
}

export function expiredBanner(graceHours: number): string {
  return `> [!CAUTION]
> ⌛ **Bid expired** — payment was not linked within ${graceHours}h.`;
}

/**
 * Wraps a rejected/expired bid's original body in a collapsed, struck-through
 * details block so the dead bid stays visible but clearly marked.
 */
export function collapseStruck(originalBody: string, summary = "Original bid"): string {
  return `<details>\n<summary>~~${summary}~~</summary>\n\n${originalBody}\n\n</details>`;
}
