import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User } from "lucide-react";

interface MessageProps {
  role: "user" | "assistant";
  content: string;
}

export function Message({ role, content }: MessageProps) {
  return (
    <div
      className={cn(
        "flex gap-3 py-4",
        role === "user" ? "justify-end" : "justify-start",
      )}
    >
      {role === "assistant" && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "rounded-lg px-4 py-2 max-w-[80%] text-sm",
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted",
        )}
      >
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
      {role === "user" && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
