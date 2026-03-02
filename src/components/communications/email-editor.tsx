"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Save, Send, Mail, AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Communication {
  id: string;
  subject: string;
  body: string;
  recipientCount: number | null;
  recipientSegment: string | null;
  status: string;
  sentAt: string | null;
}

interface EmailEditorProps {
  communication: Communication;
}

export function EmailEditor({ communication }: EmailEditorProps) {
  const router = useRouter();
  const [subject, setSubject] = useState(communication.subject);
  const [body, setBody] = useState(communication.body);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isDirty =
    subject !== communication.subject || body !== communication.body;
  const isSent = communication.status === "sent";

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/communications/${communication.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Draft saved." });
        router.refresh();
      } else {
        setMessage({ type: "error", text: "Failed to save." });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail) return;
    setTestSending(true);
    setMessage(null);
    try {
      if (isDirty) await handleSave();
      const res = await fetch(`/api/communications/${communication.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", testEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
      } else {
        setMessage({ type: "error", text: data.error ?? "Test send failed." });
      }
    } finally {
      setTestSending(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setMessage(null);
    try {
      if (isDirty) await handleSave();
      const res = await fetch(`/api/communications/${communication.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        setConfirmOpen(false);
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error ?? "Send failed." });
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Editor
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                isSent
                  ? "text-green-600 bg-green-500/10"
                  : "text-amber-600 bg-amber-500/10"
              }
            >
              {communication.status}
            </Badge>
            {communication.recipientCount != null && (
              <Badge variant="secondary">
                {communication.recipientCount} recipients
              </Badge>
            )}
            {communication.recipientSegment && (
              <Badge variant="outline" className="text-xs">
                {communication.recipientSegment}
              </Badge>
            )}
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
          <Label>Subject</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isSent}
            className="text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>Body</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isSent}
            rows={16}
            className="text-sm font-mono"
          />
        </div>

        {!isSent && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
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

              <div className="flex items-center gap-1">
                <Input
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="h-8 w-[200px] text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestSend}
                  disabled={testSending || !testEmail}
                >
                  {testSending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-1" />
                  )}
                  Test Send
                </Button>
              </div>
            </div>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <Send className="h-4 w-4 mr-1" />
                  Send to {communication.recipientCount ?? 0} Users
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Confirm Send
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm">
                    You are about to send this email to{" "}
                    <strong>
                      {communication.recipientCount?.toLocaleString() ?? 0}{" "}
                      users
                    </strong>
                    .
                  </p>
                  {communication.recipientSegment && (
                    <p className="text-sm text-muted-foreground">
                      Segments: {communication.recipientSegment}
                    </p>
                  )}
                  <p className="text-sm font-medium">
                    Subject: {subject}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This action cannot be undone. Make sure you have reviewed the
                    content and sent a test email first.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setConfirmOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      onClick={handleSend}
                      disabled={sending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Confirm Send
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {isSent && communication.sentAt && (
          <div className="pt-2 border-t text-sm text-muted-foreground">
            Sent on {new Date(communication.sentAt).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
