import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bold, Code, Italic, Mic, MicOff, Paperclip, Search, Smartphone, SmilePlus, Square, Strikethrough, Wifi, X, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import EmojiPicker, { Categories, type CategoryConfig, type EmojiClickData } from "emoji-picker-react";

import type { WhatsAppBridgeStatus } from "../../types/whatsapp_campaign";

interface WhatsAppCampaignEditorProps {
  message: string;
  optInChecked: boolean;
  templateChecked: boolean;
  activeCampaignId?: string | null;
  isBridgeConnected?: boolean;
  status?: WhatsAppBridgeStatus | null;
  sentPhones?: string[];
  onMessageChange: (value: string) => void;
  onPickMedia: () => void;
  onOptInChange: (checked: boolean) => void;
  onTemplateChange: (checked: boolean) => void;
  onAudioRecorded?: (file: File, dataUrl: string) => void;
  onPhoneSelected?: (phone: string) => void;
  onPhonesSelected?: (phones: string[]) => void;
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
  sentPhones = [],
  onMessageChange,
  onPickMedia,
  onOptInChange,
  onTemplateChange,
  onAudioRecorded,
  onPhoneSelected,
  onPhonesSelected,
}: WhatsAppCampaignEditorProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedSearchPhones, setSelectedSearchPhones] = useState<string[]>([]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/clientes/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  interface MicPopupState {
    isOpen: boolean;
    type: "request" | "error" | "unsupported";
  }
  const [micPopup, setMicPopup] = useState<MicPopupState>({
    isOpen: false,
    type: "request",
  });

  const startRecording = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      setMicPopup({ isOpen: true, type: "unsupported" });
      return;
    }
    setMicPopup({ isOpen: true, type: "request" });
  };

  const triggerRecordCapture = async () => {
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
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp4" });
        stream.getTracks().forEach((track) => track.stop());

        const file = new File([audioBlob], `gravacao-${Date.now()}.mp4`, {
          type: "audio/mp4",
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
      setMicPopup({ isOpen: true, type: "error" });
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

  const renderMicPopup = () => {
    if (!micPopup.isOpen || typeof document === "undefined") return null;

    const getIcon = () => {
      switch (micPopup.type) {
        case "request":
          return <Mic size={32} className="text-[#a2812a]" />;
        case "error":
          return <MicOff size={32} className="text-rose-500" />;
        case "unsupported":
          return <AlertCircle size={32} className="text-amber-500" />;
      }
    };

    const getTitle = () => {
      switch (micPopup.type) {
        case "request":
          return "Autorização de Microfone";
        case "error":
          return "Acesso Negado ao Microfone";
        case "unsupported":
          return "Gravação não Suportada";
      }
    };

    const getDescription = () => {
      switch (micPopup.type) {
        case "request":
          return "Para gravar mensagens de voz diretamente no sistema e anexá-las à sua campanha, precisamos da sua permissão para acessar o microfone do dispositivo.";
        case "error":
          return "Não foi possível acessar o microfone. Certifique-se de que o dispositivo está conectado e que você permitiu o acesso ao áudio nas configurações do seu navegador para este site.";
        case "unsupported":
          return "O seu navegador ou sistema operacional não suporta a gravação direta de áudio. Tente utilizar uma versão mais recente ou outro navegador.";
      }
    };

    return createPortal(
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm animate-fade-in">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,#d4af3712,transparent_45%)]" />

        <div className="relative w-full max-w-[440px] overflow-hidden rounded-[32px] border border-white/70 bg-white/95 p-7 shadow-[0_32px_80px_rgba(15,23,42,0.25)] transform transition-all animate-scale-in">
          <button
            type="button"
            onClick={() => setMicPopup({ isOpen: false, type: "request" })}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-800 transition"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full ring-4 ${
              micPopup.type === "request" 
                ? "bg-[#d4af37]/10 ring-[#d4af37]/10 border border-[#d4af37]/20" 
                : micPopup.type === "error"
                ? "bg-rose-50 ring-rose-50 border border-rose-100"
                : "bg-amber-50 ring-amber-50 border border-amber-100"
            }`}>
              {getIcon()}
            </div>

            <h3 className="text-lg font-black text-[#0c1826] tracking-tight">
              {getTitle()}
            </h3>
            <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500 px-1">
              {getDescription()}
            </p>

            <div className="mt-6 flex w-full flex-col gap-2">
              {micPopup.type === "request" ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      setMicPopup({ isOpen: false, type: "request" });
                      await triggerRecordCapture();
                    }}
                    className="flex w-full items-center justify-center rounded-full bg-[#a2812a] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#8f7124]"
                  >
                    Permitir e Gravar
                  </button>
                  <button
                    type="button"
                    onClick={() => setMicPopup({ isOpen: false, type: "request" })}
                    className="flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setMicPopup({ isOpen: false, type: "request" })}
                  className="flex w-full items-center justify-center rounded-full bg-[#0c1826] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-slate-800"
                >
                  Entendido
                </button>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
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
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-[280px] ml-auto mr-2">
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                {isSearching && (
                  <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#d4af37]" />
                )}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    if (val.toLowerCase().includes("remalho")) {
                      setShowSearchResults(true);
                    } else {
                      setShowSearchResults(false);
                    }
                  }}
                  onFocus={() => searchQuery.toLowerCase().includes("remalho") && setShowSearchResults(true)}
                  placeholder="Localizar cliente..."
                  className="h-8 w-full rounded-full border border-slate-200 bg-white pl-8 pr-8 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
                />
              </div>
              {showSearchResults && searchResults.length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-[4px] p-4">
                  <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col max-h-[80vh]">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <h3 className="font-bold text-slate-800">Selecionar Destinatários</h3>
                      <button onClick={() => { setShowSearchResults(false); setSelectedSearchPhones([]); setSearchQuery(""); }} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                      </button>
                    </div>
                    <div className="overflow-y-auto p-2">
                      {searchResults.map((c) => {
                        const phone = c.contatos?.find((ct: any) => ct.tipo_contato === "Celular")?.valor || c.contatos?.[0]?.valor;
                        const isSent = phone && sentPhones.includes(phone);
                        const isSelected = phone && selectedSearchPhones.includes(phone);
                        return (
                          <label key={c.id_cliente} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition ${isSent ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:bg-[#d4af37]/5'}`}>
                            <input 
                              type="checkbox" 
                              disabled={isSent || (!isSelected && selectedSearchPhones.length >= 10)}
                              checked={isSelected || false}
                              onChange={(e) => {
                                if (!phone) return;
                                if (e.target.checked) {
                                  if (selectedSearchPhones.length < 10) setSelectedSearchPhones([...selectedSearchPhones, phone]);
                                } else {
                                  setSelectedSearchPhones(selectedSearchPhones.filter(p => p !== phone));
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-[#d4af37] focus:ring-[#d4af37]"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">
                                {c.nome_completo} 
                                {isSent && <span className="ml-2 text-[10px] uppercase text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-full">Já enviado</span>}
                              </span>
                              <span className="text-xs text-slate-500">{phone || "Sem número"}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <div className="border-t border-slate-100 p-4 flex justify-between items-center bg-slate-50">
                      <span className="text-sm text-slate-600 font-medium">{selectedSearchPhones.length} / 10 selecionados</span>
                      <button 
                        onClick={() => {
                          if (onPhonesSelected && selectedSearchPhones.length > 0) {
                            onPhonesSelected(selectedSearchPhones);
                          }
                          setShowSearchResults(false);
                          setSelectedSearchPhones([]);
                          setSearchQuery("");
                        }}
                        disabled={selectedSearchPhones.length === 0}
                        className="rounded-lg bg-[#d4af37] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#c4a133] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Adicionar Selecionados
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
      {renderMicPopup()}
    </section>
  );
}
