import { describe, expect, it } from "vitest";
import { computeDealHealth } from "@/domain/deal-health";

describe("computeDealHealth", () => {
  it("returns completed deals as low risk", () => {
    const result = computeDealHealth({ status: "COMPLETED" });
    expect(result.score).toBe(100);
    expect(result.riskLevel).toBe("LOW");
  });

  it("flags disputed deals as high risk", () => {
    const result = computeDealHealth({
      status: "DISPUTED",
      openDisputes: 1,
      overdueMilestones: 2,
      daysSinceLastActivity: 20,
      hasActiveContract: false,
    });
    expect(result.riskLevel).toBe("HIGH");
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it("rewards healthy active deals", () => {
    const result = computeDealHealth({
      status: "ACTIVE",
      milestoneCompletion: 0.8,
      overdueMilestones: 0,
      overdueTasks: 0,
      openDisputes: 0,
      daysSinceLastActivity: 1,
      escrowStatus: "FUNDED",
      hasActiveContract: true,
      memberTrustScores: [85, 90],
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.riskLevel).toBe("LOW");
  });
});
