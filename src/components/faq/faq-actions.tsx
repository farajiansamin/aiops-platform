"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface FAQActionsProps {
  faqId: string;
  status: string;
}

export function FAQActions({ faqId, status }: FAQActionsProps) {
  const router = useRouter();

  if (status === "published") return null;

  const handleAction = async (action: "publish" | "reject") => {
    await fetch(`/api/faqs/${faqId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: action === "publish" ? "published" : "rejected",
      }),
    });
    router.refresh();
  };

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleAction("publish")}
        className="text-green-600 hover:text-green-700 hover:bg-green-50"
      >
        <CheckCircle className="h-3 w-3 mr-1" />
        Publish
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleAction("reject")}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <XCircle className="h-3 w-3 mr-1" />
        Reject
      </Button>
    </div>
  );
}
