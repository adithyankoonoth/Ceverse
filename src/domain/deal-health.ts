/**
 * Pure deal-room health scoring.
 * Deterministic, DB-free — services map DB rows into DealHealthInput.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type DealHealthInput = {
  /** Deal lifecycle status. */
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED" | "DISPUTED";
  /** Current project phase (string to stay free of Prisma imports). */
  phase?: string;
  /** Fraction of milestones completed (0–1) or percent (0–100). */
  milestoneCompletion?: number;
  /** Count of milestones past due and not done. */
  overdueMilestones?: number;
  /** Count of open tasks past due. */
  overdueTasks?: number;
  /** Open dispute count. */
  openDisputes?: number;
  /** Days since last activity in the deal room. */
  daysSinceLastActivity?: number;
  /** Escrow: funded ratio releasedAmount/totalAmount, 0–1. */
  escrowReleaseRatio?: number;
  /** Escrow status string. */
  escrowStatus?: string;
  /** Member trust scores (0–100). */
  memberTrustScores?: number[];
  /** Contract active? */
  hasActiveContract?: boolean;
  /** Budget burn vs plan (1.0 = on plan, >1 over). */
  budgetBurnRatio?: number;
  /** Days remaining until next milestone due (negative = overdue). */
  daysToNextMilestone?: number | null;
};

export type DealHealthResult = {
  /** 0–100 health score (higher is healthier). */
  score: number;
  riskLevel: RiskLevel;
  rationale: string[];
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

function toUnit(value: number | undefined, defaultUnit = 0): number {
  if (value === undefined || Number.isNaN(value)) return defaultUnit;
  if (value > 1) return clamp(value / 100, 0, 1);
  return clamp(value, 0, 1);
}

/**
 * Score a deal's operational health.
 *
 * Starts at 100 and applies deterministic penalties/bonuses, then maps
 * to risk bands: HIGH < 40, MEDIUM < 70, else LOW.
 */
export function computeDealHealth(input: DealHealthInput): DealHealthResult {
  let score = 100;
  const rationale: string[] = [];

  // Terminal / critical statuses
  if (input.status === "CANCELLED") {
    return {
      score: 0,
      riskLevel: "HIGH",
      rationale: ["Deal cancelled"],
    };
  }
  if (input.status === "COMPLETED") {
    return {
      score: 100,
      riskLevel: "LOW",
      rationale: ["Deal completed successfully"],
    };
  }
  if (input.status === "DISPUTED") {
    score -= 45;
    rationale.push("Deal is in dispute (−45)");
  }
  if (input.status === "ON_HOLD") {
    score -= 20;
    rationale.push("Deal is on hold (−20)");
  }

  // Milestone completion (bonus when healthy progress)
  const completion = toUnit(input.milestoneCompletion, 0);
  if (completion >= 0.75) {
    score += 5;
    rationale.push("Strong milestone progress (+5)");
  } else if (completion < 0.25 && input.status === "ACTIVE") {
    score -= 10;
    rationale.push("Low milestone completion (−10)");
  }

  // Overdue milestones
  const overdueMs = input.overdueMilestones ?? 0;
  if (overdueMs > 0) {
    const penalty = Math.min(30, overdueMs * 10);
    score -= penalty;
    rationale.push(`${overdueMs} overdue milestone(s) (−${penalty})`);
  }

  // Overdue tasks
  const overdueTasks = input.overdueTasks ?? 0;
  if (overdueTasks > 0) {
    const penalty = Math.min(20, overdueTasks * 4);
    score -= penalty;
    rationale.push(`${overdueTasks} overdue task(s) (−${penalty})`);
  }

  // Disputes
  const disputes = input.openDisputes ?? 0;
  if (disputes > 0) {
    const penalty = Math.min(40, disputes * 20);
    score -= penalty;
    rationale.push(`${disputes} open dispute(s) (−${penalty})`);
  }

  // Activity staleness
  const idle = input.daysSinceLastActivity ?? 0;
  if (idle >= 30) {
    score -= 25;
    rationale.push(`No activity for ${idle} days (−25)`);
  } else if (idle >= 14) {
    score -= 15;
    rationale.push(`Quiet for ${idle} days (−15)`);
  } else if (idle >= 7) {
    score -= 8;
    rationale.push(`Slow activity (${idle} days) (−8)`);
  }

  // Escrow health
  const escrowStatus = (input.escrowStatus ?? "").toUpperCase();
  if (escrowStatus === "DISPUTED") {
    score -= 20;
    rationale.push("Escrow disputed (−20)");
  } else if (escrowStatus === "FUNDED" || escrowStatus === "PARTIALLY_RELEASED") {
    score += 5;
    rationale.push("Escrow funded (+5)");
  } else if (escrowStatus === "PENDING" && input.status === "ACTIVE") {
    score -= 8;
    rationale.push("Escrow not yet funded (−8)");
  }

  const release = input.escrowReleaseRatio;
  if (release !== undefined && !Number.isNaN(release)) {
    if (release > 1.05) {
      score -= 15;
      rationale.push("Escrow over-released (−15)");
    } else if (release >= 0 && release <= 1 && completion > 0) {
      // Penalize when money is far ahead of work (or far behind late stage)
      const drift = Math.abs(release - completion);
      if (drift > 0.4) {
        score -= 12;
        rationale.push("Escrow release vs progress mismatch (−12)");
      }
    }
  }

  // Contract coverage
  if (input.hasActiveContract === false) {
    score -= 12;
    rationale.push("No active contract (−12)");
  } else if (input.hasActiveContract === true) {
    score += 3;
    rationale.push("Active contract in place (+3)");
  }

  // Budget burn
  const burn = input.budgetBurnRatio;
  if (burn !== undefined && !Number.isNaN(burn)) {
    if (burn > 1.25) {
      score -= 18;
      rationale.push(`Budget overrun ${Math.round((burn - 1) * 100)}% (−18)`);
    } else if (burn > 1.1) {
      score -= 10;
      rationale.push("Budget slightly over plan (−10)");
    } else if (burn > 0 && burn <= 0.9) {
      score += 2;
      rationale.push("Budget under plan (+2)");
    }
  }

  // Upcoming / overdue next milestone
  if (input.daysToNextMilestone != null) {
    if (input.daysToNextMilestone < 0) {
      score -= 10;
      rationale.push("Next milestone is overdue (−10)");
    } else if (input.daysToNextMilestone <= 3) {
      score -= 3;
      rationale.push("Next milestone due within 3 days (−3)");
    }
  }

  // Member trust average
  const trusts = input.memberTrustScores ?? [];
  if (trusts.length > 0) {
    const avg =
      trusts.reduce((a, b) => a + clamp(b), 0) / Math.max(1, trusts.length);
    if (avg < 40) {
      score -= 15;
      rationale.push(`Low average member trust (${Math.round(avg)}) (−15)`);
    } else if (avg >= 80) {
      score += 5;
      rationale.push(`High average member trust (${Math.round(avg)}) (+5)`);
    }
  }

  // Early-phase deals with no movement still ok; late phases with low completion hurt
  const latePhases = new Set([
    "MANUFACTURING",
    "QA",
    "SHIPPING",
    "LAUNCH",
    "POST_LAUNCH",
    "REFUND_MONITORING",
  ]);
  if (input.phase && latePhases.has(input.phase.toUpperCase()) && completion < 0.5) {
    score -= 10;
    rationale.push("Late phase with weak milestone completion (−10)");
  }

  score = Math.round(clamp(score));

  let riskLevel: RiskLevel;
  if (score < 40) riskLevel = "HIGH";
  else if (score < 70) riskLevel = "MEDIUM";
  else riskLevel = "LOW";

  if (rationale.length === 0) {
    rationale.push("No risk signals detected");
  }

  return { score, riskLevel, rationale };
}
