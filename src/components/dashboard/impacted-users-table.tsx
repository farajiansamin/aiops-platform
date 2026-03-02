"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Users } from "lucide-react";

interface ImpactedUser {
  id: string;
  externalUserId: string;
  email: string | null;
  tier: string | null;
  impactType: string | null;
  impactDetails: string | null;
}

interface ImpactedUsersTableProps {
  users: ImpactedUser[];
  incidentId: string;
}

function tierBadgeClass(tier: string | null): string {
  switch (tier?.toLowerCase()) {
    case "enterprise":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-400";
    case "pro":
    case "paid":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "free":
      return "bg-gray-500/15 text-gray-700 dark:text-gray-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ImpactedUsersTable({
  users,
  incidentId,
}: ImpactedUsersTableProps) {
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const tiers = useMemo(() => {
    const tierSet = new Set(users.map((u) => u.tier ?? "unknown"));
    return Array.from(tierSet).sort();
  }, [users]);

  const segmentation = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      const tier = u.tier ?? "unknown";
      counts.set(tier, (counts.get(tier) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => b.count - a.count);
  }, [users]);

  const filtered = useMemo(() => {
    if (tierFilter === "all") return users;
    return users.filter(
      (u) => (u.tier ?? "unknown") === tierFilter,
    );
  }, [users, tierFilter]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const handleExport = () => {
    const headers = ["User ID", "Email", "Tier", "Impact Type", "Details"];
    const rows = filtered.map((u) => [
      u.externalUserId,
      u.email ?? "",
      u.tier ?? "unknown",
      u.impactType ?? "",
      u.impactDetails ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `impacted-users-${incidentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Impacted Users ({users.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setPage(0); }}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tiers</SelectItem>
                {tiers.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-8 text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Segmentation summary */}
        <div className="flex gap-3 flex-wrap">
          {segmentation.map((s) => (
            <button
              key={s.tier}
              onClick={() => {
                setTierFilter(tierFilter === s.tier ? "all" : s.tier);
                setPage(0);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                tierFilter === s.tier
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${tierBadgeClass(s.tier)}`} />
              {s.tier}: {s.count}
            </button>
          ))}
        </div>

        {/* User table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Impact Type</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    {users.length === 0
                      ? "No impacted users recorded. Impact analysis requires APP_DATABASE_URL to be configured."
                      : "No users match the current filter."}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">
                      {u.externalUserId}
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={tierBadgeClass(u.tier)}
                      >
                        {u.tier ?? "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.impactType ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.impactDetails ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {page * pageSize + 1}–
              {Math.min((page + 1) * pageSize, filtered.length)} of{" "}
              {filtered.length}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="h-7 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="h-7 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
