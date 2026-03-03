import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const BUCKET = "glasses";

if (!supabaseAdmin) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY not set — POST /api/items will return 503.");
}

function getPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Admin not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local" },
      { status: 503 }
    );
  }
  try {
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const rarity = (formData.get("rarity") as string) || null;
    const lenses = (formData.get("lenses") as string) || null;
    const frame = (formData.get("frame") as string) || null;
    const material = (formData.get("material") as string) || null;
    const slug = (formData.get("slug") as string) || name.toLowerCase().replace(/\s+/g, "-");
    const sortOrder = parseInt((formData.get("sort_order") as string) || "0", 10);
    const imageFile = formData.get("image") as File | null;
    const imageUrlFromForm = (formData.get("image_url") as string) || null;

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    let imageUrl = imageUrlFromForm;

    if (imageFile?.size) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${slug}-${Date.now()}.${ext}`;
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
      imageUrl = getPublicUrl(path);
    }

    if (!imageUrl?.trim()) {
      return NextResponse.json(
        { error: "Provide either image file or image_url" },
        { status: 400 }
      );
    }

    let slugValue = slug.trim() || null;
    let insertPayload = {
      name: name.trim(),
      description: description?.trim() || null,
      image_url: imageUrl,
      rarity: rarity?.trim() || null,
      lenses: lenses?.trim() || null,
      frame: frame?.trim() || null,
      material: material?.trim() || null,
      slug: slugValue,
      sort_order: sortOrder,
      status: "draft",
    };

    let result = await supabaseAdmin.from("collection_items").insert(insertPayload).select("id").single();

    if (result.error?.code === "23505" && result.error?.message?.includes("slug")) {
      slugValue = `${slugValue || "item"}-${Date.now()}`;
      insertPayload.slug = slugValue;
      result = await supabaseAdmin.from("collection_items").insert(insertPayload).select("id").single();
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error.code === "23505" ? "Slug уже занят. Введи другой или оставь пусто — подставится уникальный." : result.error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ id: result.data!.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
