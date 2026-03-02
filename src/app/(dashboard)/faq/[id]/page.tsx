import { getFAQ } from "@/lib/db/queries/faqs";
import { notFound } from "next/navigation";
import { FAQEditor } from "@/components/faq/faq-editor";

export const dynamic = "force-dynamic";

export default async function FAQEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const faq = await getFAQ(id);
  if (!faq) notFound();

  return (
    <div className="p-6 max-w-4xl">
      <FAQEditor
        faq={{
          id: faq.id,
          title: faq.title,
          content: faq.content,
          tags: faq.tags as string[] | null,
          status: faq.status,
          createdBy: faq.createdBy,
          relatedServices: faq.relatedServices as string[] | null,
        }}
      />
    </div>
  );
}
