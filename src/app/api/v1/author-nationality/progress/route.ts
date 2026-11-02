import { getProgress } from "@/lib/enrichment-progress";

export async function GET() {
  return Response.json(getProgress());
}
