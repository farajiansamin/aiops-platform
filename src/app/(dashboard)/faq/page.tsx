import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FAQActions } from "@/components/faq/faq-actions";

export const dynamic = "force-dynamic";

async function getFAQs() {
  try {
    return await db
      .select()
      .from(schema.faqs)
      .orderBy(desc(schema.faqs.updatedAt))
      .limit(50);
  } catch {
    return [];
  }
}

export default async function FAQPage() {
  const faqs = await getFAQs();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FAQ / Runbooks</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Knowledge base entries. AI-drafted entries appear here for review.
          </p>
        </div>
      </div>

      {faqs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">No FAQ entries yet.</p>
            <p className="text-xs mt-1">
              When the AI agent drafts FAQ entries from recurring issues, they
              will appear here for your review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {faqs.map((faq) => (
            <Card key={faq.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link href={`/faq/${faq.id}`} className="hover:underline">
                      <CardTitle className="text-base">{faq.title}</CardTitle>
                    </Link>
                    <Badge
                      variant="outline"
                      className={
                        faq.status === "published"
                          ? "text-green-600 bg-green-500/10"
                          : "text-amber-600 bg-amber-500/10"
                      }
                    >
                      {faq.status}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {faq.createdBy === "ai" ? "AI Drafted" : "Human"}
                    </Badge>
                  </div>
                  <FAQActions faqId={faq.id} status={faq.status} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {faq.content}
                </p>
                {(faq.tags as string[])?.length > 0 && (
                  <div className="flex gap-1 mt-3">
                    {(faq.tags as string[]).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Updated {new Date(faq.updatedAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
