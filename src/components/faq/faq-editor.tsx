"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, CheckCircle, XCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface FAQEditorProps {
  faq: {
    id: string;
    title: string;
    content: string;
    tags: string[] | null;
    status: string;
    createdBy: string;
    relatedServices: string[] | null;
  };
}

export function FAQEditor({ faq }: FAQEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(faq.title);
  const [content, setContent] = useState(faq.content);
  const [tags, setTags] = useState((faq.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isDirty = title !== faq.title || content !== faq.content || tags !== (faq.tags ?? []).join(", ");
  const isPublished = faq.status === "published";

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/faqs/${faq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Saved." });
        router.refresh();
      } else {
        setMessage({ type: "error", text: "Failed to save." });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: "published" | "rejected") => {
    setSaving(true);
    setMessage(null);
    try {
      if (isDirty) await handleSave();
      const res = await fetch(`/api/faqs/${faq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setMessage({
          type: "success",
          text: newStatus === "published" ? "Published." : "Rejected.",
        });
        router.refresh();
      } else {
        setMessage({ type: "error", text: "Failed to update status." });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/faq")}
        className="mb-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to FAQ List
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Edit FAQ Entry
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  isPublished
                    ? "text-green-600 bg-green-500/10"
                    : faq.status === "rejected"
                      ? "text-red-600 bg-red-500/10"
                      : "text-amber-600 bg-amber-500/10"
                }
              >
                {faq.status}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {faq.createdBy === "ai" ? "AI Drafted" : "Human"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                message.type === "success"
                  ? "bg-green-500/10 text-green-700"
                  : "bg-red-500/10 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="text-sm font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Tags (comma-separated)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., payment-service, OOMKilled, Lambda"
              className="text-sm"
            />
          </div>

          {(faq.relatedServices ?? []).length > 0 && (
            <div className="flex gap-1 items-center">
              <span className="text-xs text-muted-foreground">Services:</span>
              {(faq.relatedServices ?? []).map((s) => (
                <Badge key={s} variant="outline" className="text-xs">
                  {s}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving || !isDirty}
              size="sm"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Draft
            </Button>

            {faq.status !== "published" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange("rejected")}
                  disabled={saving}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("published")}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Publish
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
