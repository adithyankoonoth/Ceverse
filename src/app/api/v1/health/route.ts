import { jsonOk } from "@/lib/api";
import { getSystemHealth } from "@/services/admin.service";

export async function GET() {
  const health = await getSystemHealth();
  return jsonOk(health);
}
