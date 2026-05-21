import { FileImage, FileText, Paperclip, Video, X } from "lucide-react";

import type { CampaignAttachment } from "../../types/whatsapp_campaign";

interface WhatsAppMediaPanelProps {
  attachments: CampaignAttachment[];
  isUploading: boolean;
  onPickFiles: () => void;
  onRemoveAttachment: (id: string) => void;
}

const attachmentIconByKind = {
  image: FileImage,
  video: Video,
  pdf: FileText,
  file: Paperclip,
} satisfies Record<CampaignAttachment["kind"], typeof FileImage>;

export function WhatsAppMediaPanel({
  attachments,
  isUploading,
  onPickFiles,
  onRemoveAttachment,
}: WhatsAppMediaPanelProps) {
  return (
    <section
      id="campanhas-media-panel"
      className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
              Midia
            </p>
            <h3 className="mt-0.5 text-sm font-black tracking-tight text-[#0c1826]">
              Anexos da campanha
            </h3>
          </div>

          <button
            type="button"
            onClick={onPickFiles}
            disabled={isUploading}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? "Enviando..." : "Selecionar"}
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <p className="text-xs font-semibold text-slate-700">
            Estrutura preparada para imagem, video e PDF.
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Os arquivos selecionados são guardados com segurança e ficam prontos para serem enviados na sua campanha.
          </p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Formatos: JPG, PNG, WEBP, GIF, MP4, MOV, WEBM e PDF. Limite de 12 MB.
          </p>
        </div>

        {attachments.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4 text-center">
            <Paperclip className="mx-auto text-slate-300" size={20} strokeWidth={1.6} />
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Nenhum anexo selecionado.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => {
              const AttachmentIcon = attachmentIconByKind[attachment.kind];

              return (
                <article
                  key={attachment.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#b58c2a] shadow-sm ring-1 ring-slate-200">
                      <AttachmentIcon size={16} strokeWidth={1.7} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-[#0c1826]">
                        {attachment.name}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {attachment.kind} | {attachment.sizeLabel}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">
                        {attachment.fileUrl ? "Persistido no servidor" : "Pendente de upload"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(attachment.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
                    aria-label={`Remover ${attachment.name}`}
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
