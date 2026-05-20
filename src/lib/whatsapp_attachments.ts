import type { CampaignAttachment, CampaignAttachmentKind } from "../types/whatsapp_campaign";

export const formatCampaignFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getCampaignAttachmentKind = (file: File): CampaignAttachmentKind => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  return "file";
};

export const mapFilesToCampaignAttachments = (files: File[]): CampaignAttachment[] =>
  files.map((file) => ({
    id: crypto.randomUUID(),
    kind: getCampaignAttachmentKind(file),
    name: file.name,
    sizeLabel: formatCampaignFileSize(file.size),
    sizeBytes: file.size,
    mimeType: file.type || null,
    fileUrl: null,
    uploadedAt: null,
  }));

export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
