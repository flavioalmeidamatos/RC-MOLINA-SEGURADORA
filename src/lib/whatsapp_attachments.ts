import type { CampaignAttachment, CampaignAttachmentKind } from "../types/whatsapp_campaign";

export const formatCampaignFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getMimeTypeFromExtension = (name: string): string => {
  const ext = name.toLowerCase().split('.').pop() || '';
  if (['mp3', 'ogg', 'wav', 'm4a', 'aac'].includes(ext)) return `audio/${ext}`;
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return `video/${ext}`;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return `image/${ext}`;
  return '';
};

export const getCampaignAttachmentKind = (file: File): CampaignAttachmentKind => {
  const mimeType = file.type || getMimeTypeFromExtension(file.name);
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  return "file";
};

export const mapFilesToCampaignAttachments = (files: File[]): CampaignAttachment[] =>
  files.map((file) => ({
    id: crypto.randomUUID(),
    kind: getCampaignAttachmentKind(file),
    name: file.name,
    sizeLabel: formatCampaignFileSize(file.size),
    sizeBytes: file.size,
    mimeType: file.type || getMimeTypeFromExtension(file.name) || "application/octet-stream",
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
