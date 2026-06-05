import { useEffect, useRef, useState } from "react";
import { Bold, Code, Italic, Mic, Paperclip, Smartphone, SmilePlus, Square, Strikethrough, Wifi } from "lucide-react";
import EmojiPicker, { Categories, type CategoryConfig, type EmojiClickData } from "emoji-picker-react";

import type { WhatsAppBridgeStatus } from "../../types/whatsapp_campaign";

interface WhatsAppCampaignEditorProps {
  message: string;
  optInChecked: boolean;
  templateChecked: boolean;
  activeCampaignId?: string | null;
  isBridgeConnected?: boolean;
  status?: WhatsAppBridgeStatus | null;
  onMessageChange: (value: string) => void;
  onPickMedia: () => void;
  onOptInChange: (checked: boolean) => void;
  onTemplateChange: (checked: boolean) => void;
  onAudioRecorded?: (file: File, dataUrl: string) => void;
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
  activeCampaignId,
  isBridgeConnected,
  status,
  onMessageChange,
  onPickMedia,
  onOptInChange,
  onTemplateChange,
  onAudioRecorded,
}: WhatsAppCampaignEditorProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      alert("O seu navegador ou sistema operacional não suporta gravação de áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        const file = new File([audioBlob], `gravacao-${Date.now()}.webm`, {
          type: "audio/webm",
        });

        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = String(reader.result || "");
          onAudioRecorded?.(file, dataUrl);
        };
        reader.readAsDataURL(file);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("Não foi possível acessar o microfone. Verifique as permissões de áudio do seu navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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

    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;
    let selectedText = message.substring(start, end);

    if (selectedText.length > 0 && selectedText.endsWith(" ")) {
      selectedText = selectedText.substring(0, selectedText.length - 1);
      end = end - 1;
    }
    if (selectedText.length > 0 && selectedText.startsWith(" ")) {
      selectedText = selectedText.substring(1);
      start = start + 1;
    }

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
          
          {/* Header Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#f8fafc] px-4 py-2.5 rounded-t-[24px]">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 shrink-0">
              Editor de Mensagem
            </span>
            
            {isBridgeConnected ? (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#a2ebd3] bg-[#e6fcf5] px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#0ca678] shadow-sm">
                  <Wifi size={13} strokeWidth={2.5} className="text-[#0ca678]" />
                  <span>CONECTADO</span>
                </span>
                {status?.user ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#a2ebd3] bg-[#e6fcf5] px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#0ca678] shadow-sm">
                    <Smartphone size={13} strokeWidth={2.5} className="text-[#0ca678]" />
                    <span>Sessão ativa - {status.user.pushname}</span>
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-slate-400 shadow-sm">
                <Wifi size={13} strokeWidth={2.5} className="text-slate-400" />
                <span>DESCONECTADO</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white/70 px-3 py-2">
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

              {isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="ml-auto inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-red-600 transition hover:border-red-400 hover:bg-red-100 animate-pulse"
                  title="Parar Gravação"
                >
                  <Square size={14} className="fill-red-600" />
                  <span>Parar ({formatTime(recordingTime)})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-[#d4af37]/40 hover:bg-[#fff8e1] hover:text-[#9a7418]"
                  title="Gravar Áudio"
                >
                  <Mic size={14} />
                  <span>Gravar Áudio</span>
                </button>
              )}

              <button
                type="button"
                disabled={isRecording}
                onClick={onPickMedia}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-[#d4af37]/40 hover:bg-[#fff8e1] hover:text-[#9a7418] disabled:opacity-50 disabled:cursor-not-allowed"
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
                <span className="text-[11px] font-semibold text-slate-600">Texto revisado para o disparo</span>
              </label>
            </div>
            <span>{message.length} caracteres</span>
          </div>
      </div>
    </section>
  );
}
