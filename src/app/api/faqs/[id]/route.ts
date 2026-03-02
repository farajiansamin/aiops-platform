import { NextRequest, NextResponse } from "next/server";
import { getFAQ, updateFAQ } from "@/lib/db/queries/faqs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const faq = await getFAQ(id);
  if (!faq) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await updateFAQ(id, body);
  return NextResponse.json({ ok: true });
}
