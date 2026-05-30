// The 7 behavioral families + Unclassified, from the HDBSCAN -> family rollup.
// Source of truth for color + display order across every page.

export const FAMILY_ORDER = [
  "Mainstream/Retail",
  "DeFi Traders",
  "Holders & Receivers",
  "Token-Only",
  "Bots & Automation",
  "Minters",
  "Compromised/Phishing",
  "Unclassified",
] as const;

export type Family = (typeof FAMILY_ORDER)[number];

export const FAMILY_COLOR: Record<string, string> = {
  "Mainstream/Retail": "#9AA0B4",
  "DeFi Traders": "#5BB6F0",
  "Holders & Receivers": "#E6C76A",
  "Token-Only": "#54E0A8",
  "Bots & Automation": "#F0A24A",
  "Minters": "#B488F0",
  "Compromised/Phishing": "#F45D7A", // the only red — makes the showcase pop
  "Unclassified": "#5C6072",
};

export function familyColor(name: string): string {
  return FAMILY_COLOR[name] ?? "#5BB6F0";
}

// The headline finding: phishing-victim drain wallets, isolated unsupervised.
export const PHISHING_FAMILY = "Compromised/Phishing";
export const PHISHING_CLUSTERS = [2, 5];

// Order families by a numeric accessor (desc by default), keeping the canonical
// order as the tiebreak so legends/stacks stay stable.
export function orderFamilies<T>(
  entries: [string, T][],
  value: (v: T) => number,
  desc = true
): [string, T][] {
  return [...entries].sort((a, b) => {
    const d = value(b[1]) - value(a[1]);
    if (d !== 0) return desc ? d : -d;
    return FAMILY_ORDER.indexOf(a[0] as Family) - FAMILY_ORDER.indexOf(b[0] as Family);
  });
}
