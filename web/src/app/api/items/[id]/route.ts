import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const BUCKET = "glasses";

function getPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Admin not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local" },
      { status: 503 }
    );
  }
  try {
    const id = (await params).id;
    const formData = await request.formData();
    const name = formData.get("name") as string | null;
    const description = (formData.get("description") as string) || null;
    const rarity = (formData.get("rarity") as string) || null;
    const lenses = (formData.get("lenses") as string) || null;
    const frame = (formData.get("frame") as string) || null;
    const material = (formData.get("material") as string) || null;
    const slug = formData.get("slug") as string | null;
    const sortOrderStr = formData.get("sort_order") as string | null;
    const imageFile = formData.get("image") as File | null;
    const imageUrlFromForm = (formData.get("image_url") as string) || null;

    const updates: Record<string, unknown> = {};
    if (name != null) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (rarity !== undefined) updates.rarity = rarity?.trim() || null;
    if (lenses !== undefined) updates.lenses = lenses?.trim() || null;
    if (frame !== undefined) updates.frame = frame?.trim() || null;
    if (material !== undefined) updates.material = material?.trim() || null;
    if (slug !== undefined) updates.slug = slug?.trim() || null;
    if (sortOrderStr !== undefined) updates.sort_order = parseInt(sortOrderStr || "0", 10);

    if (imageFile?.size) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `item-${id}-${Date.now()}.${ext}`;
      const buf = await imageFile.arrayBuffer();
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: imageFile.type, upsert: true });
      if (uploadError) {
        return NextResponse.json(
          { error: "Upload failed: " + uploadError.message },
          { status: 500 }
        );
      }
      updates.image_url = getPublicUrl(path);
    } else if (imageUrlFromForm?.trim()) {
      updates.image_url = imageUrlFromForm.trim();
    }

    const { error } = await supabaseAdmin
      .from("collection_items")
      .update(updates)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
