import { clearArchive, readArchive } from "@/server/archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const archive = await readArchive();
  return Response.json({ archive });
}

export async function DELETE() {
  await clearArchive();
  return Response.json({ archive: [] });
}
