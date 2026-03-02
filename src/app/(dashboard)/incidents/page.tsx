import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import { IncidentCard } from "@/components/dashboard/incident-card";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function getIncidents() {
  try {
    return await db
      .select()
      .from(schema.incidents)
      .orderBy(desc(schema.incidents.createdAt))
      .limit(50);
  } catch {
    return [];
  }
}

export default async function IncidentsPage() {
  const incidents = await getIncidents();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Incidents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Incidents synced from Rootly with blast radius data
        </p>
      </div>

      {incidents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">No incidents recorded yet.</p>
            <p className="text-xs mt-1">
              Incidents will appear here when received from Rootly webhooks.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {incidents.map((inc) => (
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
  );
}
