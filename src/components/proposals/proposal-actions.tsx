"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ProposalActions({
  proposalId,
  status,
  isRecipient,
  isSender,
}: {
  proposalId: string;
  status: string;
  isRecipient: boolean;
  isSender: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function act(action: string) {
    setLoading(action);
    const res = await fetch(`/api/v1/proposals/${proposalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    setLoading(null);
    if (!res.ok || !json.ok) {
      toast.error(json?.error?.message ?? "Action failed");
      return;
    }
    toast.success(
      action === "accept"
        ? "Proposal accepted — deal room ready"
        : `Proposal ${action}ed`,
    );
    router.refresh();
    if (action === "accept" && json.data?.deal?.id) {
      router.push(`/deals/${json.data.deal.id}`);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {isSender && (status === "DRAFT" || status === "COUNTERED") ? (
        <Button size="sm" disabled={loading !== null} onClick={() => act("send")}>
          {loading === "send" ? "Sending…" : "Send"}
        </Button>
      ) : null}
      {isRecipient && (status === "SENT" || status === "COUNTERED") ? (
        <>
          <Button size="sm" disabled={loading !== null} onClick={() => act("accept")}>
            {loading === "accept" ? "Accepting…" : "Accept"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading !== null}
            onClick={() => act("reject")}
          >
            Decline
          </Button>
        </>
      ) : null}
      {isSender && status !== "ACCEPTED" && status !== "WITHDRAWN" ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={loading !== null}
          onClick={() => act("withdraw")}
        >
          Withdraw
        </Button>
      ) : null}
    </div>
  );
}
