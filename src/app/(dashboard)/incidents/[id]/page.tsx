import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ImpactedUsersTable } from "@/components/dashboard/impacted-users-table";

export const dynamic = "force-dynamic";

async function getIncidentWithRelated(id: string) {
  try {
    const [incident] = await db
      .select()
      .from(schema.incidents)
      .where(eq(schema.incidents.id, id))
      .limit(1);

    if (!incident) return null;

    const [comms, postmortems, impactedUsers] = await Promise.all([
      db
        .select()
        .from(schema.communications)
        .where(eq(schema.communications.incidentId, id)),
      db
        .select()
        .from(schema.postmortems)
        .where(eq(schema.postmortems.incidentId, id)),
      db
        .select()
        .from(schema.impactedUsers)
        .where(eq(schema.impactedUsers.incidentId, id))
        .limit(5000),
    ]);

    return { incident, communications: comms, postmortems, impactedUsers };
  } catch {
    return null;
  }
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getIncidentWithRelated(id);
  if (!data) notFound();

  const { incident, communications, postmortems, impactedUsers } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className={
            incident.severity?.startsWith("P0") || incident.severity?.startsWith("SEV0")
              ? "bg-red-500/15 text-red-700"
              : "bg-orange-500/15 text-orange-700"
          }
        >
          {incident.severity ?? "Unknown"}
        </Badge>
        <Badge variant="outline">{incident.status}</Badge>
        <h1 className="text-2xl font-bold">{incident.title}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {incident.summary && <p className="text-sm">{incident.summary}</p>}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Commander</span>
                  <p className="font-medium">{incident.commander ?? "Unassigned"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Started</span>
                  <p className="font-medium">
                    {incident.startedAt ? new Date(incident.startedAt).toLocaleString() : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Mitigated</span>
                  <p className="font-medium">
                    {incident.mitigatedAt ? new Date(incident.mitigatedAt).toLocaleString() : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Resolved</span>
                  <p className="font-medium">
                    {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : "N/A"}
                  </p>
                </div>
              </div>
              {(incident.services as string[])?.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Affected Services</span>
                  <div className="flex gap-2 mt-1">
                    {(incident.services as string[]).map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {incident.impactedUserCount != null && (
                <div>
                  <span className="text-sm text-muted-foreground">Total Impacted Users</span>
                  <p className="text-2xl font-bold">{incident.impactedUserCount.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Impacted Users Table with segmentation and export */}
          <ImpactedUsersTable users={impactedUsers} incidentId={id} />

          {communications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Communications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {communications.map((comm) => (
                  <div key={comm.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{comm.subject}</h4>
                      <div className="flex gap-2">
                        {comm.recipientSegment && (
                          <Badge variant="secondary" className="text-xs">
                            {comm.recipientSegment}
                          </Badge>
                        )}
                        <Badge variant="outline">{comm.status}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{comm.body}</p>
                    <Separator />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {postmortems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Post-Mortems</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {postmortems.map((pm) => (
                  <div key={pm.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{pm.title}</h4>
                      <Badge variant="outline">{pm.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {pm.content.slice(0, 150)}...
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rootly</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Rootly ID: {incident.rootlyId ?? "N/A"}
              </p>
              {incident.slackChannelId && (
                <p className="text-sm text-muted-foreground mt-1">
                  Slack Channel: #{incident.slackChannelId}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
