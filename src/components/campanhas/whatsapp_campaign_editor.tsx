import { useEffect, useRef, useState } from "react";
import { Bold, Code, Italic, Paperclip, SmilePlus, Strikethrough } from "lucide-react";
import EmojiPicker, { Categories, type CategoryConfig, type EmojiClickData } from "emoji-picker-react";

interface WhatsAppCampaignEditorProps {
  message: string;
  optInChecked: boolean;
  templateChecked: boolean;
  onMessageChange: (value: string) => void;
  onPickMedia: () => void;
  onOptInChange: (checked: boolean) => void;
  onTemplateChange: (checked: boolean) => void;
}

const emojiCategories: CategoryConfig[] = [
  { category: Categories.SUGGESTED, name: "Mais usados" },
  { category: Categories.SMILEYS_PEOPLE, name: "Sorrisos e pessoas" },
  { category: Categories.ANIMALS_NATURE, name: "Animais e natureza" },
  { category: Categories.FOOD_DRINK, name: "Comidas e bebidas" },
  { category: Categories.TRAVEL_PLACES, name: "Viagens e lugares" },
  { category: Categories.ACTIVITIES, name: "Atividades" },
  { category: Categories.OBJECTS, name: "Objetos" },
  { category: Categories.SYMBOLS, name: "Símbolos" },
  { category: Categories.FLAGS, name: "Bandeiras" },
];

export function WhatsAppCampaignEditor({
  message,
  optInChecked,
  templateChecked,
  onMessageChange,
  onPickMedia,
  onOptInChange,
  onTemplateChange,
}: WhatsAppCampaignEditorProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!showEmojiPicker) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowEmojiPicker(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showEmojiPicker]);

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
    <section className="rounded-[20px] border border-slate-200 bg-white shadow-sm p-3">
      <div className="space-y-2">

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
                title="Itálico"
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
                  <div className="absolute left-0 top-10 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Emojis
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(false)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 transition hover:bg-slate-50"
                      >
                        Fechar
                      </button>
                    </div>
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
                <span>Anexar mídia</span>
              </button>
            </div>

            <textarea
              id="campaign-message"
              ref={textareaRef}
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              placeholder="Use este espaço para montar sua mensagem. Use a barra acima para adicionar emojis ou formatação."
              className="h-[72px] w-full resize-none rounded-b-[24px] bg-transparent px-4 py-2 text-sm leading-6 text-slate-700 outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3 px-1 text-[11px] font-semibold text-slate-400">
            <div className="flex items-center gap-4">
              <span>Preview local apenas. Nenhum disparo será feito nesta etapa.</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optInChecked}
                  onChange={(event) => onOptInChange(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#b58c2a] focus:ring-[#d4af37]"
                />
                <span className="text-[11px] font-semibold text-slate-600">Opt-in confirmado</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateChecked}
                  onChange={(event) => onTemplateChange(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#b58c2a] focus:ring-[#d4af37]"
                />
                <span className="text-[11px] font-semibold text-slate-600">Texto revisado para disparo</span>
              </label>
            </div>
            <span>{message.length} caracteres</span>
          </div>
      </div>
    </section>
  );
}
