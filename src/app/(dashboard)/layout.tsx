"use client";

import { Sidebar } from "@/components/dashboard/sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      {chatOpen && (
        <div className="w-[400px] shrink-0">
          <ChatPanel onClose={() => setChatOpen(false)} />
        </div>
      )}
      {!chatOpen && (
        <Button
          onClick={() => setChatOpen(true)}
          size="icon"
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
