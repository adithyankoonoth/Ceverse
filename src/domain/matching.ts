/**
 * Pure creator ↔ operator compatibility scoring.
 * Deterministic, DB-free — used by marketplace ranking and unit tests.
 */

export type CompatibilityInput = {
  /** Shared / overlapping industry tags (normalized lowercase recommended). */
  creatorIndustries: string[];
  operatorIndustries: string[];
  /** Preferred product categories for the creator. */
  creatorCategories?: string[];
  operatorCategories?: string[];
  /** ISO-3166 alpha-2 country codes. */
  creatorCountry?: string | null;
  operatorCountry?: string | null;
  /** Regions the operator serves (country codes or region labels). */
  operatorRegionsServed?: string[];
  /** 0–100 trust scores. */
  creatorTrustScore?: number;
  operatorTrustScore?: number;
  /** Creator engagement rate as a fraction (e.g. 0.04 = 4%) or percent (4). */
  engagementRate?: number;
  /** Audience size for capacity/fit heuristics. */
  audienceSize?: number;
  /** Operator MOQ; lower is friendlier for early launches. */
  moq?: number | null;
  /** Operator historical success rate 0–1 or 0–100. */
  successRate?: number;
  /** Both parties verification status. */
  creatorVerified?: boolean;
  operatorVerified?: boolean;
  /** Shared language codes, e.g. ["en", "hi"]. */
  creatorLanguages?: string[];
  operatorLanguages?: string[];
};

export type CompatibilityFactor = {
  name: string;
  weight: number;
  score: number;
  note: string;
};

export type CompatibilityResult = {
  /** Weighted aggregate, clamped to 0–100. */
  score: number;
  factors: CompatibilityFactor[];
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeTag(s: string): string {
  return s.trim().toLowerCase();
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a.map(normalizeTag).filter(Boolean));
  const B = new Set(b.map(normalizeTag).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 50; // neutral when both empty
  if (A.size === 0 || B.size === 0) return 20;
  let intersection = 0;
  for (const x of A) {
    if (B.has(x)) intersection += 1;
  }
  const union = A.size + B.size - intersection;
  return union === 0 ? 50 : (intersection / union) * 100;
}

function asPercent(value: number | undefined, assumeFractionBelow = 1): number {
  if (value === undefined || Number.isNaN(value)) return 50;
  // Treat values <= 1 as fractions (0.04 → 4%) unless clearly a percent already.
  if (value >= 0 && value <= assumeFractionBelow) {
    return clamp(value * 100);
  }
  return clamp(value);
}

/**
 * Compute a weighted compatibility score between a creator and an operator.
 *
 * Weights (sum = 1.0):
 * - industryOverlap: 0.25
 * - categoryOverlap: 0.15
 * - geoFit: 0.15
 * - trust: 0.15
 * - engagement: 0.10
 * - capacityFit: 0.10
 * - verification: 0.05
 * - language: 0.05
 */
export function computeCompatibilityScore(
  input: CompatibilityInput,
): CompatibilityResult {
  const factors: CompatibilityFactor[] = [];

  // --- Industry overlap ---
  const industryScore = jaccard(
    input.creatorIndustries ?? [],
    input.operatorIndustries ?? [],
  );
  factors.push({
    name: "industryOverlap",
    weight: 0.25,
    score: Math.round(industryScore),
    note:
      industryScore >= 70
        ? "Strong industry alignment"
        : industryScore >= 40
          ? "Partial industry overlap"
          : "Limited industry overlap",
  });

  // --- Category overlap ---
  const categoryScore = jaccard(
    input.creatorCategories ?? [],
    input.operatorCategories ?? [],
  );
  factors.push({
    name: "categoryOverlap",
    weight: 0.15,
    score: Math.round(categoryScore),
    note:
      categoryScore >= 70
        ? "Categories match well"
        : categoryScore >= 40
          ? "Some category overlap"
          : "Categories diverge",
  });

  // --- Geo fit ---
  let geoScore = 40;
  let geoNote = "No geo data; neutral score";
  const creatorCountry = input.creatorCountry?.toUpperCase() ?? null;
  const operatorCountry = input.operatorCountry?.toUpperCase() ?? null;
  const regions = (input.operatorRegionsServed ?? []).map((r) =>
    r.toUpperCase(),
  );

  if (creatorCountry && operatorCountry && creatorCountry === operatorCountry) {
    geoScore = 100;
    geoNote = "Same country";
  } else if (creatorCountry && regions.includes(creatorCountry)) {
    geoScore = 85;
    geoNote = "Operator serves creator country";
  } else if (
    creatorCountry &&
    regions.some((r) => r === "GLOBAL" || r === "WORLDWIDE")
  ) {
    geoScore = 70;
    geoNote = "Operator serves globally";
  } else if (creatorCountry && operatorCountry) {
    geoScore = 35;
    geoNote = "Different markets; no explicit coverage";
  }
  factors.push({
    name: "geoFit",
    weight: 0.15,
    score: geoScore,
    note: geoNote,
  });

  // --- Trust (average of both, default 50) ---
  const cTrust = clamp(input.creatorTrustScore ?? 50);
  const oTrust = clamp(input.operatorTrustScore ?? 50);
  const trustScore = (cTrust + oTrust) / 2;
  factors.push({
    name: "trust",
    weight: 0.15,
    score: Math.round(trustScore),
    note: `Avg trust ${Math.round(trustScore)} (creator ${Math.round(cTrust)}, operator ${Math.round(oTrust)})`,
  });

  // --- Engagement ---
  // Map engagement: 0% → 0, ~3% → 60, ≥8% → 100 (piecewise linear on percent scale).
  const engPct = asPercent(input.engagementRate);
  let engagementScore: number;
  if (engPct <= 0) engagementScore = 0;
  else if (engPct < 3) engagementScore = (engPct / 3) * 60;
  else if (engPct < 8) engagementScore = 60 + ((engPct - 3) / 5) * 40;
  else engagementScore = 100;
  factors.push({
    name: "engagement",
    weight: 0.1,
    score: Math.round(engagementScore),
    note: `Engagement ~${engPct.toFixed(1)}%`,
  });

  // --- Capacity / MOQ fit vs audience ---
  let capacityScore = 55;
  let capacityNote = "No MOQ/audience signal; neutral";
  const audience = input.audienceSize ?? 0;
  const moq = input.moq;
  const success = asPercent(input.successRate);

  if (moq != null && moq > 0 && audience > 0) {
    // Rough conversion: 1% of audience as potential first-order buyers.
    const estimatedDemand = Math.max(1, Math.floor(audience * 0.01));
    if (estimatedDemand >= moq * 2) {
      capacityScore = 95;
      capacityNote = "Audience comfortably covers MOQ";
    } else if (estimatedDemand >= moq) {
      capacityScore = 80;
      capacityNote = "Audience meets MOQ";
    } else if (estimatedDemand >= moq * 0.5) {
      capacityScore = 50;
      capacityNote = "Audience may fall short of MOQ";
    } else {
      capacityScore = 25;
      capacityNote = "MOQ high relative to audience";
    }
  } else if (moq != null && moq <= 100) {
    capacityScore = 75;
    capacityNote = "Low MOQ is launch-friendly";
  }

  // Blend success rate lightly into capacity (30%).
  capacityScore = capacityScore * 0.7 + success * 0.3;
  factors.push({
    name: "capacityFit",
    weight: 0.1,
    score: Math.round(capacityScore),
    note: capacityNote,
  });

  // --- Verification ---
  const cV = Boolean(input.creatorVerified);
  const oV = Boolean(input.operatorVerified);
  let verificationScore = 30;
  if (cV && oV) verificationScore = 100;
  else if (cV || oV) verificationScore = 65;
  factors.push({
    name: "verification",
    weight: 0.05,
    score: verificationScore,
    note:
      cV && oV
        ? "Both parties verified"
        : cV || oV
          ? "One party verified"
          : "Neither party verified",
  });

  // --- Language ---
  const langScore = jaccard(
    input.creatorLanguages ?? [],
    input.operatorLanguages ?? [],
  );
  // If both empty, jaccard returns 50 (neutral); boost slightly when any shared.
  factors.push({
    name: "language",
    weight: 0.05,
    score: Math.round(langScore),
    note:
      langScore >= 70
        ? "Shared languages"
        : langScore >= 40
          ? "Partial language overlap"
          : "No shared languages listed",
  });

  const raw = factors.reduce((sum, f) => sum + f.weight * f.score, 0);
  const score = Math.round(clamp(raw));

  return { score, factors };
}
