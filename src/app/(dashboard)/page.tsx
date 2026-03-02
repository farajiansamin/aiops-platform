import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, Activity } from "lucide-react";
import { db, schema } from "@/lib/db";
import { eq, desc, count } from "drizzle-orm";
import { IncidentCard } from "@/components/dashboard/incident-card";
import { ApprovalBanner } from "@/components/dashboard/approval-banner";

export const dynamic = "force-dynamic";

async function getStats() {
  try {
    const [activeIncidents] = await db
      .select({ count: count() })
      .from(schema.incidents)
      .where(eq(schema.incidents.status, "active"));

    const [pendingApprovals] = await db
      .select({ count: count() })
      .from(schema.approvals)
      .where(eq(schema.approvals.status, "pending"));

    const recentIncidents = await db
      .select()
      .from(schema.incidents)
      .orderBy(desc(schema.incidents.createdAt))
      .limit(5);

    const recentApprovals = await db
      .select()
      .from(schema.approvals)
      .where(eq(schema.approvals.status, "pending"))
      .orderBy(desc(schema.approvals.createdAt))
      .limit(5);

    return {
      activeIncidentCount: activeIncidents?.count ?? 0,
      pendingApprovalCount: pendingApprovals?.count ?? 0,
      recentIncidents,
      recentApprovals,
    };
  } catch {
    return {
      activeIncidentCount: 0,
      pendingApprovalCount: 0,
      recentIncidents: [],
      recentApprovals: [],
    };
  }
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          AIOps Agent overview and pending actions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeIncidentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingApprovalCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Agent Status</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-600 bg-green-500/10">
                Online
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
          </CardContent>
        </Card>
      </div>

      {stats.recentApprovals.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Pending Approvals</h2>
          {stats.recentApprovals.map((a) => (
            <ApprovalBanner
              key={a.id}
              id={a.id}
              type={a.type}
              summary={a.summary}
              status={a.status}
              createdAt={a.createdAt.toISOString()}
            />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Recent Incidents</h2>
        {stats.recentIncidents.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No incidents yet. Incidents will appear here when synced from Rootly.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {stats.recentIncidents.map((inc) => (
              <IncidentCard
                key={inc.id}
                id={inc.id}
                title={inc.title}
                severity={inc.severity}
                status={inc.status}
                commander={inc.commander}
                startedAt={inc.startedAt}
                services={(inc.services as string[]) ?? []}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
