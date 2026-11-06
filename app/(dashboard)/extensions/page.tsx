import { Puzzle } from "lucide-react";
import { Badge } from "@/components/shared/badge";
import { GET as listExtensionConfigs } from "@/app/api/extension-configs/route";
import { fromRoute, internalRequest } from "@/lib/api/from-route";

export const metadata = { title: "Extensions — CRM RN", description: "Konfigurasi extension" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: Array<Record<string, unknown>> }>(
    await listExtensionConfigs(internalRequest("/api/extension-configs")),
  );
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Puzzle size={20} color="var(--primary)" />
        <h1 className="m-0 text-[18px] font-bold text-[var(--primary)] md:text-[20px]">Ekstensi</h1>
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {rows.map((e) => (
          <div
            key={String(e.ext_type)}
            className="rounded-[10px] bg-white p-[18px] shadow-sm"
            style={{ borderLeft: `4px solid ${e.is_active ? "#01665a" : "#ddd"}` }}
          >
            <div className="mb-1.5 flex justify-between">
              <strong className="text-[13px]">{String(e.ext_type).replace(/_/g, " ").toUpperCase()}</strong>
              <Badge color={e.is_active ? "#01665a" : "#999"}>{String(e.status)}</Badge>
            </div>
            <div className="text-[12px] text-[#666]">Siap dipanggil lewat /api/extension-configs dan /api/donors/lookup</div>
          </div>
        ))}
      </div>
    </div>
  );
}
