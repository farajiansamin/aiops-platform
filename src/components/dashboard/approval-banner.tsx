"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";

interface ApprovalBannerProps {
  id: string;
  type: string;
  summary: string;
  status: string;
  createdAt: string;
  onResolve?: (id: string, decision: "approved" | "rejected") => void;
}

const typeLabels: Record<string, string> = {
  execution_authority: "Execution Approval",
  knowledge_approval: "Knowledge Review",
  data_validation: "Data Validation",
  tone_calibration: "Tone Review",
};

export function ApprovalBanner({
  id,
  type,
  summary,
  status,
  createdAt,
  onResolve,
}: ApprovalBannerProps) {
  const [loading, setLoading] = useState(false);

  const handleResolve = async (decision: "approved" | "rejected") => {
    setLoading(true);
    try {
      await fetch(`/api/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, decidedBy: "dashboard_user" }),
      });
      onResolve?.(id, decision);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardContent className="flex items-center justify-between py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {typeLabels[type] ?? type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(createdAt).toLocaleString()}
            </span>
          </div>
          <p className="text-sm truncate">{summary}</p>
        </div>
        {status === "pending" && (
          <div className="flex gap-2 ml-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleResolve("approved")}
              disabled={loading}
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleResolve("rejected")}
              disabled={loading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        )}
        {status !== "pending" && (
          <Badge
            variant="outline"
            className={
              status === "approved"
                ? "text-green-600"
                : "text-red-600"
            }
          >
            {status}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
