import { useState, useRef } from "react";
import { Bold, Italic, Strikethrough, Code, SmilePlus, Image as ImageIcon } from "lucide-react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface WhatsAppCampaignEditorProps {
  campaignName: string;
  message: string;
  onCampaignNameChange: (value: string) => void;
  onMessageChange: (value: string) => void;
}

export function WhatsAppCampaignEditor({
  campaignName,
  message,
  onCampaignNameChange,
  onMessageChange,
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

    // After updating, focus and set selection
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

    const newMessage =
      message.substring(0, start) + emojiData.emoji + message.substring(end);

    onMessageChange(newMessage);
    setShowEmojiPicker(false);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emojiData.emoji.length, start + emojiData.emoji.length);
    }, 0);
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
          Conteúdo
        </p>
        <h3 className="mt-1 text-lg font-black tracking-tight text-[#0c1826]">
          Editor da campanha
        </h3>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Estruture o texto principal e deixe a base pronta para a integração do disparo.
        </p>
      </div>

      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <label
            htmlFor="campaign-name"
            className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500"
          >
            Nome interno
          </label>
          <input
            id="campaign-name"
            type="text"
            value={campaignName}
            onChange={(event) => onCampaignNameChange(event.target.value)}
            placeholder="Ex.: Renovação plano familiar"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#d4af37] focus:ring-4 focus:ring-[#d4af37]/10"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="campaign-message"
            className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500"
          >
            Mensagem principal
          </label>
          
          <div className="relative rounded-[24px] border border-slate-200 bg-[#fcfcfd] focus-within:border-[#d4af37] focus-within:ring-4 focus-within:ring-[#d4af37]/10 transition">
            
            {/* Formatting Toolbar */}
            <div className="flex items-center gap-1 border-b border-slate-200 px-3 py-2 bg-white/50 rounded-t-[24px]">
              <button
                type="button"
                onClick={() => insertFormatting("*")}
                className="p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 rounded transition"
                title="Negrito"
              >
                <Bold size={16} />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("_")}
                className="p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 rounded transition"
                title="Itálico"
              >
                <Italic size={16} />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("~")}
                className="p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 rounded transition"
                title="Tachado"
              >
                <Strikethrough size={16} />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("```", "```")}
                className="p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 rounded transition"
                title="Monoespaçado"
              >
                <Code size={16} />
              </button>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-1.5 text-slate-500 hover:bg-slate-200 hover:text-[#d4af37] rounded transition"
                  title="Emojis"
                >
                  <SmilePlus size={16} />
                </button>
                {showEmojiPicker && (
                  <div className="absolute top-10 left-0 z-50 shadow-xl rounded-xl">
                    <EmojiPicker onEmojiClick={onEmojiClick} />
                  </div>
                )}
              </div>
              
              <div className="ml-auto flex items-center text-xs font-semibold text-slate-400 cursor-default" title="A seção de mídias fica no painel da direita">
                <ImageIcon size={14} className="mr-1 inline-block" />
                <span className="hidden sm:inline">Mídias no painel lateral</span>
              </div>
            </div>

            <textarea
              id="campaign-message"
              ref={textareaRef}
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              placeholder={
                "Use este espaço para montar sua mensagem.\n\nUse a barra acima para adicionar emojis ou formatação."
              }
              className="min-h-[160px] w-full resize-y bg-transparent px-4 py-4 text-sm leading-6 text-slate-700 outline-none rounded-b-[24px]"
            />
          </div>
          
          <div className="flex items-center justify-between gap-3 px-1 text-xs font-semibold text-slate-400">
            <span>Preview local apenas. Nenhum disparo será feito nesta etapa.</span>
            <span>{message.length} caracteres</span>
          </div>
        </div>

      </div>
    </section>
  );
}
