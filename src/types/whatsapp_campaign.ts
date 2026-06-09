export type CampaignAttachmentKind = "image" | "video" | "pdf" | "file";

export interface CampaignAttachment {
  id: string;
  kind: CampaignAttachmentKind;
  name: string;
  sizeLabel: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
  fileUrl?: string | null;
  uploadedAt?: string | null;
}

export interface RecipientSummary {
  filledNumbers: string[];
  validNumbers: string[];
  invalidNumbers: string[];
}

export type WhatsAppInlineTokenKind = "text" | "bold" | "italic" | "strike" | "code";

export interface WhatsAppInlineToken {
  kind: WhatsAppInlineTokenKind;
  value: string;
  children?: WhatsAppInlineToken[];
}

export interface WhatsAppCampaignDraft {
  campaignName: string;
  message: string;
  recipients: string[];
  attachments: CampaignAttachment[];
  optInChecked: boolean;
  templateChecked: boolean;
}

export interface SavedWhatsAppCampaign extends WhatsAppCampaignDraft {
  id: string;
  channel: "WHATSAPP";
  status: "draft";
  createdByUserId: string;
  createdByUserEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveWhatsAppCampaignPayload extends WhatsAppCampaignDraft {}

export interface WhatsAppDispatchPayload extends SaveWhatsAppCampaignPayload {
  campaignId?: string | null;
}

export type WhatsAppBridgeConnectionState =
  | "disabled"
  | "disconnected"
  | "connecting"
  | "qr"
  | "logging_in"
  | "connected";

export interface WhatsAppBridgeUserInfo {
  pushname: string;
  phone: string;
}

export interface WhatsAppBridgeStatus {
  configured: boolean;
  available: boolean;
  status: WhatsAppBridgeConnectionState;
  qr: string | null;
  qrSvg?: string | null;
  qrAvailable: boolean;
  user: WhatsAppBridgeUserInfo | null;
  error?: string | null;
}

export interface WhatsAppDispatchRecipientResult {
  number: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppDispatchResult {
  attempted: number;
  sent: number;
  failed: number;
  results: WhatsAppDispatchRecipientResult[];
  generatedVideo?: {
    dataUrl: string;
    name: string;
    mimeType: string;
  };
}

export type CampaignHistoryEventType = "created" | "updated" | "deleted" | "dispatched";

export type CampaignHistoryStatus = "success" | "error";

export interface CampaignHistoryEntry {
  id: string;
  campaignId: string | null;
  campaignName: string;
  eventType: CampaignHistoryEventType;
  status: CampaignHistoryStatus;
  summary: string;
  actorUserId: string | null;
  actorUserEmail: string;
  createdAt: string;
  details: Record<string, unknown> | null;
}
