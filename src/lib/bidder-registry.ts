import { resolve } from "path";

export interface BidderRecord {
  github_username: string;
  payment_linked: boolean;
  linked_at: string | null;
  warned_at: string | null;
  stripe_customer_id?: string;
  stripe_payment_method_id?: string;
}

export interface BidderRegistry {
  bidders: Record<string, BidderRecord>;
}

const EMPTY_REGISTRY: BidderRegistry = { bidders: {} };

let registryCache: BidderRegistry | null = null;
let registryPath: string | null = null;

function getRegistryPath(targetDir?: string): string {
  const dir = targetDir ?? process.cwd();
  return resolve(dir, ".bidme", "data", "bidders.json");
}

export async function loadBidders(targetDir?: string): Promise<BidderRegistry> {
  const path = getRegistryPath(targetDir);
  registryPath = path;
  const file = Bun.file(path);
  if (!(await file.exists())) {
    registryCache = { ...EMPTY_REGISTRY, bidders: {} };
    return registryCache;
  }
  const content = await file.text();
  const parsed = JSON.parse(content) as BidderRegistry;
  registryCache = parsed;
  return registryCache;
}

export async function saveBidders(targetDir?: string): Promise<void> {
  const path = targetDir ? getRegistryPath(targetDir) : (registryPath ?? getRegistryPath());
  if (!registryCache) {
    registryCache = { ...EMPTY_REGISTRY, bidders: {} };
  }
  await Bun.write(path, JSON.stringify(registryCache, null, 2));
}

export function getBidder(username: string): BidderRecord | null {
  if (!registryCache) return null;
  return registryCache.bidders[username] ?? null;
}

export function registerBidder(username: string): BidderRecord {
  if (!registryCache) {
    registryCache = { ...EMPTY_REGISTRY, bidders: {} };
  }
  const existing = registryCache.bidders[username];
  if (existing) return existing;

  const record: BidderRecord = {
    github_username: username,
    payment_linked: false,
    linked_at: null,
    warned_at: null,
  };
  registryCache.bidders[username] = record;
  return record;
}

export function markPaymentLinked(
  username: string,
  stripeCustomerId: string,
  stripePaymentMethodId: string,
): void {
  if (!registryCache) {
    registryCache = { ...EMPTY_REGISTRY, bidders: {} };
  }
  let record = registryCache.bidders[username];
  if (!record) {
    record = registerBidder(username);
  }
  record.payment_linked = true;
  record.stripe_customer_id = stripeCustomerId;
  record.stripe_payment_method_id = stripePaymentMethodId;
  record.linked_at = new Date().toISOString();
}

export function isPaymentLinked(username: string): boolean {
  if (!registryCache) return false;
  const record = registryCache.bidders[username];
  return record?.payment_linked ?? false;
}

export function getGraceDeadline(username: string, graceHours: number): Date | null {
  if (!registryCache) return null;
  const record = registryCache.bidders[username];
  if (!record?.warned_at) return null;
  const warnedDate = new Date(record.warned_at);
  return new Date(warnedDate.getTime() + graceHours * 60 * 60 * 1000);
}

export function setWarnedAt(username: string, timestamp?: string): void {
  if (!registryCache) {
    registryCache = { ...EMPTY_REGISTRY, bidders: {} };
  }
  let record = registryCache.bidders[username];
  if (!record) {
    record = registerBidder(username);
  }
  record.warned_at = timestamp ?? new Date().toISOString();
}

export function resetRegistryCache(): void {
  registryCache = null;
  registryPath = null;
}
