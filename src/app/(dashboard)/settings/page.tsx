import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db, schema } from "@/lib/db";
import { getRegistry } from "@/lib/agent/tools";
import { SettingsForms } from "@/components/dashboard/settings-forms";

export const dynamic = "force-dynamic";

async function getSettingsData() {
  try {
    const alertChannels = await db.select().from(schema.alertChannels);
    const serviceRepos = await db.select().from(schema.serviceRepos);
    return { alertChannels, serviceRepos };
  } catch {
    return { alertChannels: [], serviceRepos: [] };
  }
}

export default async function SettingsPage() {
  const { alertChannels, serviceRepos } = await getSettingsData();
  const registry = getRegistry();
  const providers = registry.listProviders();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure providers, alert channels, and service-to-repo mappings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {["slack", "rootly", "jira", "confluence", "github"].map(
              (name) => (
                <div key={name} className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      providers.includes(name)
                        ? "text-green-600 bg-green-500/10"
                        : "text-muted-foreground"
                    }
                  >
                    {providers.includes(name) ? "Connected" : "Not configured"}
                  </Badge>
                  <span className="text-sm capitalize">{name}</span>
                </div>
              ),
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Provider connections are configured via environment variables. See
            the README for setup instructions.
          </p>
        </CardContent>
      </Card>

      <SettingsForms
        alertChannels={alertChannels}
        serviceRepos={serviceRepos}
      />
    </div>
  );
}
