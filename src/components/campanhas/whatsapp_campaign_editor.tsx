import { useRef, useState } from "react";
import { Bold, Code, Italic, Paperclip, SmilePlus, Strikethrough } from "lucide-react";
import EmojiPicker, { Categories, type CategoryConfig, type EmojiClickData } from "emoji-picker-react";

interface WhatsAppCampaignEditorProps {
  campaignName: string;
  message: string;
  onCampaignNameChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onPickMedia: () => void;
}

const emojiCategories: CategoryConfig[] = [
  { category: Categories.SUGGESTED, name: "Mais usados" },
  { category: Categories.SMILEYS_PEOPLE, name: "Sorrisos e pessoas" },
  { category: Categories.ANIMALS_NATURE, name: "Animais e natureza" },
  { category: Categories.FOOD_DRINK, name: "Comidas e bebidas" },
  { category: Categories.TRAVEL_PLACES, name: "Viagens e lugares" },
  { category: Categories.ACTIVITIES, name: "Atividades" },
  { category: Categories.OBJECTS, name: "Objetos" },
  { category: Categories.SYMBOLS, name: "Simbolos" },
  { category: Categories.FLAGS, name: "Bandeiras" },
];

export function WhatsAppCampaignEditor({
  campaignName,
  message,
  onCampaignNameChange,
  onMessageChange,
  onPickMedia,
}: WhatsAppCampaignEditorProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);

    const newMessage =
      message.substring(0, start) +
      prefix +
      selectedText +
      suffix +
      message.substring(end);

    onMessageChange(newMessage);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const newMessage = message.substring(0, start) + emojiData.emoji + message.substring(end);

    onMessageChange(newMessage);
    setShowEmojiPicker(false);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emojiData.emoji.length, start + emojiData.emoji.length);
    }, 0);
  };

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="rounded-t-[28px] border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <h3 className="text-base font-black tracking-tight text-[#0c1826]">
          Editor da campanha
        </h3>
      </div>

      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <label
            htmlFor="campaign-name"
            className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"
          >
            Nome interno
          </label>
          <input
            id="campaign-name"
            type="text"
            value={campaignName}
            onChange={(event) => onCampaignNameChange(event.target.value)}
            placeholder="Ex.: Renovacao plano familiar"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#d4af37] focus:ring-4 focus:ring-[#d4af37]/10"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="campaign-message"
            className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"
          >
            Mensagem principal
          </label>

          <div className="relative rounded-[24px] border border-slate-200 bg-[#fcfcfd] transition focus-within:border-[#d4af37] focus-within:ring-4 focus-within:ring-[#d4af37]/10">
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white/70 px-3 py-2 rounded-t-[24px]">
              <button
                type="button"
                onClick={() => insertFormatting("*")}
                className="rounded transition p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                title="Negrito"
              >
                <Bold size={16} />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("_")}
                className="rounded transition p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                title="Italico"
              >
                <Italic size={16} />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("~")}
                className="rounded transition p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                title="Tachado"
              >
                <Strikethrough size={16} />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("```", "```")}
                className="rounded transition p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                title="Monoespacado"
              >
                <Code size={16} />
              </button>
              <div className="mx-1 h-5 w-px bg-slate-200" />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((current) => !current)}
                  className="rounded transition p-1.5 text-slate-500 hover:bg-slate-200 hover:text-[#d4af37]"
                  title="Emojis"
                >
                  <SmilePlus size={16} />
                </button>

                {showEmojiPicker ? (
                  <div className="absolute left-0 top-10 z-50 overflow-hidden rounded-2xl shadow-2xl">
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      categories={emojiCategories}
                      searchPlaceholder="Buscar emoji"
                      searchClearButtonLabel="Limpar busca"
                      previewConfig={{
                        defaultCaption: "Escolha um emoji",
                        showPreview: true,
                      }}
                    />
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onPickMedia}
                className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-[#d4af37]/40 hover:bg-[#fff8e1] hover:text-[#9a7418]"
                title="Selecionar imagens, videos ou PDF"
              >
                <Paperclip size={14} />
                <span>Anexar midia</span>
              </button>
            </div>

            <textarea
              id="campaign-message"
              ref={textareaRef}
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              placeholder={
                "Use este espaco para montar sua mensagem.\n\nUse a barra acima para adicionar emojis ou formatacao."
              }
              className="h-[118px] w-full resize-none rounded-b-[24px] bg-transparent px-4 py-3 text-xs leading-6 text-slate-700 outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3 px-1 text-[11px] font-semibold text-slate-400">
            <span>Preview local apenas. Nenhum disparo sera feito nesta etapa.</span>
            <span>{message.length} caracteres</span>
          </div>
        </div>
      </div>
    </section>
  );
}
