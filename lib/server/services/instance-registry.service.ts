import { getSupabaseAdmin } from "../supabase-admin.js";

const FALLBACK_INSTANCE_ID = "11111111-1111-1111-1111-111111111111";
const FALLBACK_INSTANCE_LABEL = "WhatsApp Principal";

export class InstanceRegistryService {
  private readonly db = getSupabaseAdmin();

  getDefaultInstanceId(): string {
    return String(process.env.WHATSAPP_DEFAULT_INSTANCE_ID || FALLBACK_INSTANCE_ID).trim();
  }

  async ensureDefaultInstance(): Promise<string> {
    const id = this.getDefaultInstanceId();
    const label = String(process.env.WHATSAPP_DEFAULT_INSTANCE_LABEL || FALLBACK_INSTANCE_LABEL).trim();
    const ownerUserId = String(process.env.WHATSAPP_OWNER_USER_ID || "").trim() || null;
    const greenInstanceId =
      String(process.env.GREEN_API_BASE_URL || "")
        .trim()
        .match(/waInstance([^/]+)/)?.[1] || "default-green-instance";

    const { error } = await this.db.from("instances").upsert(
      {
        id,
        owner_user_id: ownerUserId,
        green_instance_id: greenInstanceId,
        api_base_url: String(process.env.GREEN_API_BASE_URL || "").trim() || null,
        label,
        meta: {
          provisionedBy: "instance-registry-service",
        },
      },
      { onConflict: "id" }
    );

    if (error) {
      throw error;
    }

    return id;
  }
}
