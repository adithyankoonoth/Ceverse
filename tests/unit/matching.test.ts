import { describe, expect, it } from "vitest";
import { computeCompatibilityScore } from "@/domain/matching";

describe("computeCompatibilityScore", () => {
  it("scores strong aligned partners highly", () => {
    const result = computeCompatibilityScore({
      creatorIndustries: ["beauty", "wellness"],
      operatorIndustries: ["beauty", "skincare"],
      creatorCategories: ["skincare"],
      operatorCategories: ["skincare", "haircare"],
      creatorCountry: "US",
      operatorCountry: "US",
      operatorRegionsServed: ["US", "CA"],
      creatorTrustScore: 85,
      operatorTrustScore: 90,
      engagementRate: 0.05,
      audienceSize: 500_000,
      moq: 1000,
      successRate: 0.95,
      creatorVerified: true,
      operatorVerified: true,
      creatorLanguages: ["en"],
      operatorLanguages: ["en"],
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.factors.length).toBeGreaterThan(5);
  });

  it("penalizes geo and industry mismatch", () => {
    const weak = computeCompatibilityScore({
      creatorIndustries: ["beauty"],
      operatorIndustries: ["industrial"],
      creatorCountry: "US",
      operatorCountry: "IN",
      operatorRegionsServed: ["IN"],
      creatorVerified: false,
      operatorVerified: false,
      moq: 100_000,
      audienceSize: 5_000,
    });
    expect(weak.score).toBeLessThan(60);
  });

  it("is deterministic", () => {
    const input = {
      creatorIndustries: ["beauty"],
      operatorIndustries: ["beauty"],
      creatorCountry: "US",
      operatorCountry: "US",
    };
    expect(computeCompatibilityScore(input)).toEqual(computeCompatibilityScore(input));
  });
});
