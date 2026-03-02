import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PostmortemEditor } from "@/components/postmortem/postmortem-editor";

export const dynamic = "force-dynamic";

export default async function PostmortemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [pm] = await db
    .select()
    .from(schema.postmortems)
    .where(eq(schema.postmortems.id, id))
    .limit(1);

  if (!pm) notFound();

  return (
    <div className="p-6 max-w-5xl">
      <PostmortemEditor
        postmortem={{
          id: pm.id,
          title: pm.title,
          content: pm.content,
          status: pm.status,
          incidentId: pm.incidentId,
          confluencePageId: pm.confluencePageId,
        }}
      />
    </div>
  );
}
