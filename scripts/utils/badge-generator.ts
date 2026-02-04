export function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return val % 1 === 0 ? `${val}M` : `${parseFloat(val.toFixed(1))}M`;
  }
  if (n >= 1_000) {
    const val = n / 1_000;
    return val % 1 === 0 ? `${val}k` : `${parseFloat(val.toFixed(1))}k`;
  }
  return String(n);
}

export function generateViewsBadge(count: number): string {
  const label = encodeURIComponent("views");
  const value = encodeURIComponent(formatNumber(count));
  return `![Views](https://img.shields.io/badge/${label}-${value}-blue)`;
}

export function generateCountriesBadge(count: number): string {
  const label = encodeURIComponent("countries");
  const value = encodeURIComponent(formatNumber(count));
  return `![Countries](https://img.shields.io/badge/${label}-${value}-green)`;
}

export function generateCTRBadge(rate: number): string {
  const label = encodeURIComponent("CTR");
  const value = encodeURIComponent(`${rate.toFixed(1)}%`);
  return `![CTR](https://img.shields.io/badge/${label}-${value}-orange)`;
}

export function generateBannerSection(
  bannerUrl: string,
  destUrl: string,
  badges: string[],
): string {
  const banner = `[![BidMe Banner](${bannerUrl})](${destUrl})`;
  const badgeLine = badges.join(" ");
  return `${banner}\n\n${badgeLine}`;
}
