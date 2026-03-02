import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface IncidentCardProps {
  id: string;
  title: string;
  severity: string | null;
  status: string;
  commander: string | null;
  startedAt: Date | null;
  services: string[];
}

function severityColor(severity: string | null): string {
  switch (severity?.toUpperCase()) {
    case "P0":
    case "SEV0":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "P1":
    case "SEV1":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    case "P2":
    case "SEV2":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    default:
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "started":
    case "investigating":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "mitigated":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    case "resolved":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function IncidentCard({
  id,
  title,
  severity,
  status,
  commander,
  startedAt,
  services,
}: IncidentCardProps) {
  return (
    <Link href={`/incidents/${id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={severityColor(severity)}>
                {severity ?? "Unknown"}
              </Badge>
              <Badge variant="outline" className={statusColor(status)}>
                {status}
              </Badge>
            </div>
            {startedAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(startedAt).toLocaleString()}
              </span>
            )}
          </div>
          <CardTitle className="text-base mt-1">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Commander: {commander ?? "Unassigned"}</span>
            {services.length > 0 && (
              <span className="truncate ml-4">
                {services.join(", ")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
