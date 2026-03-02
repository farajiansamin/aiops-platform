"use client";

import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "./message";
import { Send, Loader2, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChatPanelProps {
  onClose?: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [context, setContext] = useState("general");
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    id: `aiops-chat-${context}`,
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage({ text: inputValue });
    setInputValue("");
  };

  return (
    <div className="flex flex-col h-full border-l bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm">AI Agent Chat</h3>
          <Select value={context} onValueChange={setContext}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="infra-triage">Infra Triage</SelectItem>
              <SelectItem value="customer-impact">Customer Impact</SelectItem>
              <SelectItem value="postmortem">Post-Mortem</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-20">
            <p>Ask me about incidents, services, or infrastructure issues.</p>
          </div>
        )}
        {messages.map((m) => {
          const textContent = m.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("") ?? "";
          return (
            <Message
              key={m.id}
              role={m.role as "user" | "assistant"}
              content={textContent}
            />
          );
        })}
        {isLoading && (
          <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status === "submitted" ? "Thinking..." : "Streaming..."}
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-4 flex gap-2">
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask about an incident or service..."
          className="min-h-[40px] max-h-[120px] resize-none text-sm"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          onClick={handleSend}
          size="icon"
          disabled={isLoading || !inputValue.trim()}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
