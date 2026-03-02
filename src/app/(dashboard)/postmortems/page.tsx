import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

async function getPostmortems() {
  try {
    return await db
      .select()
      .from(schema.postmortems)
      .orderBy(desc(schema.postmortems.createdAt))
      .limit(50);
  } catch {
    return [];
  }
}

export default async function PostmortemsPage() {
  const postmortems = await getPostmortems();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Post-Mortems</h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI-drafted post-incident reviews. Approve before publishing to
          Confluence.
        </p>
      </div>

      {postmortems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">No post-mortems drafted yet.</p>
            <p className="text-xs mt-1">
              When Rootly marks an incident as resolved, the AI will
              automatically draft a PIR document here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {postmortems.map((pm) => (
            <Card key={pm.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Link href={`/postmortems/${pm.id}`} className="hover:underline">
                    <CardTitle className="text-base">{pm.title}</CardTitle>
                  </Link>
                  <Badge
                    variant="outline"
                    className={
                      pm.status === "published"
                        ? "text-green-600 bg-green-500/10"
                        : "text-amber-600 bg-amber-500/10"
                    }
                  >
                    {pm.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {pm.content.slice(0, 800)}
                  {pm.content.length > 800 && "..."}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(pm.createdAt).toLocaleString()}
                  </p>
                  {pm.confluencePageId && (
                    <Badge variant="secondary" className="text-xs">
                      Confluence: {pm.confluencePageId}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
