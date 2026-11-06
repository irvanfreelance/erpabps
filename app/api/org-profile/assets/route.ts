import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { uploadOrgAsset } from "@/lib/blob/org-assets";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const g = await guard("app_config", "config");
  if (g.error) return g.error;
  const form = await req.formData();
  const kindRaw = String(form.get("kind") ?? "");
  const kind = kindRaw === "favicon" ? "favicon" : kindRaw === "logo" ? "logo" : null;
  const file = form.get("file");
  if (!kind || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Berkas dan jenis (logo/favicon) wajib" }, { status: 400 });
  }
  try {
    const url = await uploadOrgAsset(kind, file);
    const sql = getDb();
    if (kind === "logo") {
      await sql`
        UPDATE org_profile
        SET logo_url = ${url}, is_seed_default = FALSE, updated_at = now()
        WHERE id = 1
        RETURNING *
      `;
    } else {
      await sql`
        UPDATE org_profile
        SET favicon_url = ${url}, is_seed_default = FALSE, updated_at = now()
        WHERE id = 1
        RETURNING *
      `;
    }
    await logAudit({
      userId: g.session!.user.id,
      action: "update",
      entityType: "org_profile",
      fieldChanged: kind,
      valueAfter: { url },
    });
    return NextResponse.json({ url, kind });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unggah gagal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
