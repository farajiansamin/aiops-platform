"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface ApprovalActionsProps {
  approvalId: string;
}

export function ApprovalActions({ approvalId }: ApprovalActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDecision = async (decision: "approved" | "rejected") => {
    setLoading(true);
    try {
      await fetch(`/api/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: decision, decidedBy: "dashboard_user" }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-3 pt-4 border-t">
      <Button
        onClick={() => handleDecision("approved")}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <CheckCircle className="h-4 w-4 mr-1" />
        )}
        Approve
      </Button>
      <Button
        variant="outline"
        onClick={() => handleDecision("rejected")}
        disabled={loading}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <XCircle className="h-4 w-4 mr-1" />
        )}
        Reject
      </Button>
    </div>
  );
}
