import { db } from "@/lib/db";

export async function getUserDashboardMetrics(userId: string) {
  const [
    deals,
    proposalsInbox,
    proposalsSent,
    unreadNotifications,
    payments,
    activeDisputes,
  ] = await Promise.all([
    db.deal.findMany({
      where: { members: { some: { userId } }, deletedAt: null },
      select: {
        id: true,
        status: true,
        phase: true,
        healthScore: true,
        riskLevel: true,
        escrows: { select: { totalAmount: true, releasedAmount: true, status: true } },
      },
    }),
    db.proposal.count({
      where: { recipientId: userId, status: "SENT", deletedAt: null },
    }),
    db.proposal.count({
      where: { senderId: userId, deletedAt: null },
    }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.payment.findMany({
      where: { escrow: { deal: { members: { some: { userId } } } }, status: "SUCCEEDED" },
      select: { amount: true, type: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.dispute.count({
      where: {
        deal: { members: { some: { userId } } },
        status: { in: ["OPEN", "UNDER_REVIEW", "MEDIATION"] },
      },
    }),
  ]);

  const activeDeals = deals.filter((d) => d.status === "ACTIVE").length;
  const completedDeals = deals.filter((d) => d.status === "COMPLETED").length;
  const volume = deals.reduce((sum, d) => {
    const e = d.escrows[0];
    return sum + (e ? Number(e.totalAmount) : 0);
  }, 0);
  const released = deals.reduce((sum, d) => {
    const e = d.escrows[0];
    return sum + (e ? Number(e.releasedAmount) : 0);
  }, 0);
  const avgHealth =
    deals.filter((d) => d.healthScore != null).length > 0
      ? deals
          .filter((d) => d.healthScore != null)
          .reduce((s, d) => s + (d.healthScore ?? 0), 0) /
        deals.filter((d) => d.healthScore != null).length
      : null;

  return {
    activeDeals,
    completedDeals,
    totalDeals: deals.length,
    proposalsInbox,
    proposalsSent,
    unreadNotifications,
    activeDisputes,
    escrowVolume: volume,
    escrowReleased: released,
    averageHealthScore: avgHealth != null ? Math.round(avgHealth) : null,
    recentPayments: payments.map((p) => ({
      amount: Number(p.amount),
      type: p.type,
      createdAt: p.createdAt,
    })),
    riskBreakdown: {
      low: deals.filter((d) => d.riskLevel === "LOW").length,
      medium: deals.filter((d) => d.riskLevel === "MEDIUM").length,
      high: deals.filter((d) => d.riskLevel === "HIGH").length,
    },
  };
}

export async function getAdminAnalytics() {
  const [users, deals, proposals, disputes, verifications, payments] =
    await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.deal.groupBy({ by: ["status"], _count: true }),
      db.proposal.groupBy({ by: ["status"], _count: true }),
      db.dispute.groupBy({ by: ["status"], _count: true }),
      db.verificationRequest.count({ where: { status: "PENDING" } }),
      db.payment.aggregate({
        where: { status: "SUCCEEDED" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

  return {
    totalUsers: users,
    dealsByStatus: Object.fromEntries(deals.map((d) => [d.status, d._count])),
    proposalsByStatus: Object.fromEntries(proposals.map((p) => [p.status, p._count])),
    disputesByStatus: Object.fromEntries(disputes.map((d) => [d.status, d._count])),
    pendingVerifications: verifications,
    paymentVolume: Number(payments._sum.amount ?? 0),
    paymentCount: payments._count,
  };
}
