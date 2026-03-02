import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { EmailEditor } from "@/components/communications/email-editor";

export const dynamic = "force-dynamic";

async function getCommunications() {
  try {
    return await db
      .select()
      .from(schema.communications)
      .orderBy(desc(schema.communications.createdAt))
      .limit(50);
  } catch {
    return [];
  }
}

export default async function CommunicationsPage() {
  const communications = await getCommunications();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Communications</h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI-drafted customer communications. Edit, test, and send from here.
        </p>
      </div>

      {communications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">No communications drafted yet.</p>
            <p className="text-xs mt-1">
              When a high-severity incident impacts customers, the AI will draft
              notification emails for your review here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {communications.map((comm) => (
            <EmailEditor
              key={comm.id}
              communication={{
                id: comm.id,
                subject: comm.subject,
                body: comm.body,
                recipientCount: comm.recipientCount,
                recipientSegment: comm.recipientSegment,
                status: comm.status,
                sentAt: comm.sentAt?.toISOString() ?? null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
