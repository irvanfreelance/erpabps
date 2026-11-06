import { put } from "@vercel/blob";

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/gif",
]);

const MAX: Record<"logo" | "favicon", number> = {
  logo: 2 * 1024 * 1024,
  favicon: 512 * 1024,
};

function extOf(file: File) {
  const name = file.name.toLowerCase();
  const fromName = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  if (fromName && /^[a-z0-9]+$/.test(fromName) && fromName.length <= 5) return fromName;
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type.includes("icon")) return "ico";
  return "png";
}

export async function uploadOrgAsset(kind: "logo" | "favicon", file: File) {
  if (!ALLOWED.has(file.type) && !file.name.toLowerCase().endsWith(".ico")) {
    throw new Error("Format tidak didukung. Gunakan PNG, JPG, WEBP, SVG, atau ICO.");
  }
  if (file.size > MAX[kind]) {
    throw new Error(kind === "logo" ? "Logo maksimal 2 MB." : "Favicon maksimal 512 KB.");
  }
  const pathname = `org/${kind}.${extOf(file)}`;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN belum di-set. Jalankan vercel env pull atau isi token Blob di .env.local.");
  }
  const blob = await put(pathname, file, {
    access: "public",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: file.type || undefined,
  });
  return blob.url;
}
