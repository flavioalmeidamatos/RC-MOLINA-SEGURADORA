import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Loader2, Send } from "lucide-react";

import { fileToDataUrl, getCampaignAttachmentKind, formatCampaignFileSize } from "../../lib/whatsapp_attachments";
import { apiGetWhatsAppBridgeStatus, apiLogoutWhatsAppBridge, apiSendWhatsAppCampaign } from "../../lib/whatsapp_bridge_api";
import {
  MAX_WHATSAPP_RECIPIENTS,
  createRecipientState,
  getRecipientSummary,
  normalizeRecipientState,
  removeRecipientAt,
  replaceRecipientAt,
} from "../../lib/whatsapp_recipients";
import type {
  WhatsAppBridgeStatus,
  WhatsAppCampaignDraft,
  CampaignAttachment,
} from "../../types/whatsapp_campaign";
import { WhatsAppCampaignEditor } from "./whatsapp_campaign_editor";
import { WhatsAppConnectionGateModal } from "./whatsapp_connection_gate_modal";
import { WhatsAppMediaPanel } from "./whatsapp_media_panel";
import { WhatsAppMessagePreview } from "./whatsapp_message_preview";
import { WhatsAppRecipientFields } from "./whatsapp_recipient_fields";
import { EmailComposeModal } from "../shared/email_compose_modal";
import { splitWhatsAppMessageLines } from "../../lib/whatsapp_text_formatter";


interface CampanhasShellProps {
  userId: string | null;
  userEmail: string | null;
  initialMessage?: string;
  onConnectionGateClose?: () => void;
}

const createEmptyDraft = (): WhatsAppCampaignDraft => ({
  campaignName: "",
  message: "",
  recipients: createRecipientState(""),
  attachments: [],
  optInChecked: true,
  templateChecked: true,
});

const sortCampaignAttachments = (atts: CampaignAttachment[]): CampaignAttachment[] => {
  return [...atts].sort((a, b) => {
    if (a.kind === "image" && b.kind !== "image") return -1;
    if (a.kind !== "image" && b.kind === "image") return 1;
    return 0;
  });
};

const BRIDGE_STATUS_POLL_MS = 4000;

export function CampanhasShell({ userId, userEmail, initialMessage, onConnectionGateClose }: CampanhasShellProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const actor = useMemo(
    () => (userId && userEmail ? { id: userId, email: userEmail } : null),
    [userEmail, userId],
  );
  const [draft, setDraft] = useState<WhatsAppCampaignDraft>({
    campaignName: "",
    message: initialMessage || "",
    recipients: createRecipientState(""),
    attachments: [],
    optInChecked: true,
    templateChecked: true,
  });
  const [campaignStatus, setCampaignStatus] = useState("");
  const [bridgeStatus, setBridgeStatus] = useState<WhatsAppBridgeStatus | null>(null);
  const [isLoadingBridgeStatus, setIsLoadingBridgeStatus] = useState(false);
  const [isLoggingOutBridge, setIsLoggingOutBridge] = useState(false);
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [isConnectionGateDismissed, setIsConnectionGateDismissed] = useState(false);
  const [sentPhones, setSentPhones] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [showEmailComposeModal, setShowEmailComposeModal] = useState(false);

  useEffect(() => {
    if (initialMessage) {
      setDraft((current) => ({
        ...current,
        message: current.message ? current.message : initialMessage,
      }));
    }
  }, [initialMessage]);

  const { campaignName, message, recipients, attachments, optInChecked, templateChecked } = draft;

  const recipientSummary = useMemo(() => getRecipientSummary(recipients), [recipients]);

  const emailBodyHtml = useMemo(() => {
    if (!message) return "";

    const lines = splitWhatsAppMessageLines(message);
    return lines
      .map((lineTokens) => {
        const lineContent = lineTokens
          .map((token): string => {
            const renderToken = (tok: typeof token): string => {
              if (tok.kind === "text") return tok.value || "";
              const childrenHtml = tok.children
                ? tok.children.map(renderToken).join("")
                : tok.value || "";
              switch (tok.kind) {
                case "bold":
                  return `<strong>${childrenHtml}</strong>`;
                case "italic":
                  return `<em>${childrenHtml}</em>`;
                case "strike":
                  return `<del>${childrenHtml}</del>`;
                case "code":
                  return `<code>${childrenHtml}</code>`;
                default:
                  return childrenHtml;
              }
            };
            return renderToken(token);
          })
          .join("");
        return `<p>${lineContent || "&nbsp;"}</p>`;
      })
      .join("");
  }, [message]);

  const emailFiles = useMemo(() => {
    if (!attachments || attachments.length === 0) return [];
    return attachments
      .map((att) => {
        if (!att.fileUrl) return null;
        try {
          const arr = att.fileUrl.split(",");
          if (arr.length < 2) return null;
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : (att.mimeType || "application/octet-stream");
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          return new File([u8arr], att.name, { type: mime });
        } catch (e) {
          console.error("Erro ao converter anexo para email:", e);
          return null;
        }
      })
      .filter((file): file is File => file !== null);
  }, [attachments]);

  const isBridgeConnected = bridgeStatus?.status === "connected";
  const shouldShowConnectionGate = Boolean(actor) && !isBridgeConnected && !isConnectionGateDismissed;

  useEffect(() => {
    if (isBridgeConnected) {
      setIsConnectionGateDismissed(false);
    }
  }, [isBridgeConnected]);

  useEffect(() => {
    let ignore = false;
    let intervalId: number | undefined;

    const loadBridgeStatus = async () => {
      if (!actor) {
        setBridgeStatus(null);
        return;
      }

      setIsLoadingBridgeStatus(true);

      try {
        const result = await apiGetWhatsAppBridgeStatus(actor);
        if (ignore) return;

        if (result.error) {
          setBridgeStatus({
            configured: false,
            available: false,
            status: "disabled",
            qr: null,
            qrAvailable: false,
            user: null,
            error: result.error,
          });
          return;
        }

        setBridgeStatus(result.data || null);
      } catch (error) {
        if (!ignore) {
          console.error("Erro ao carregar status da bridge:", error);
          setBridgeStatus({
            configured: false,
            available: false,
            status: "disabled",
            qr: null,
            qrAvailable: false,
            user: null,
            error: "Não foi possível consultar o status do WhatsApp.",
          });
        }
      } finally {
        if (!ignore) {
          setIsLoadingBridgeStatus(false);
        }
      }
    };

    void loadBridgeStatus();
    intervalId = window.setInterval(() => {
      void loadBridgeStatus();
    }, BRIDGE_STATUS_POLL_MS);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [actor]);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleRecipientChange = (index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      recipients: replaceRecipientAt(current.recipients, index, value),
    }));
  };

  const handleAddRecipient = () => {
    setDraft((current) => ({
      ...current,
      recipients:
        current.recipients.length >= MAX_WHATSAPP_RECIPIENTS
          ? current.recipients
          : normalizeRecipientState([...current.recipients, ""]),
    }));
  };

  const handleRemoveRecipient = (index: number) => {
    setDraft((current) => ({
      ...current,
      recipients: removeRecipientAt(current.recipients, index),
    }));
  };

  const handlePickFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles: File[] = event.target.files
      ? Array.from(event.target.files as ArrayLike<File>)
      : [];

    if (selectedFiles.length === 0) {
      return;
    }

    event.target.value = "";

    try {
      setIsUploadingAttachments(true);
      setCampaignStatus("Processando anexos em mídia...");

      const newAttachments = [];
      for (const file of selectedFiles) {
        const dataUrl = await fileToDataUrl(file);
        newAttachments.push({
          id: crypto.randomUUID(),
          kind: getCampaignAttachmentKind(file),
          name: file.name,
          sizeLabel: formatCampaignFileSize(file.size),
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
          fileUrl: dataUrl,
          uploadedAt: new Date().toISOString(),
        });
      }

      setDraft((current) => ({
        ...current,
        attachments: sortCampaignAttachments([...current.attachments, ...newAttachments]),
      }));

      setCampaignStatus(`${selectedFiles.length} anexo(s) carregado(s) com sucesso.`);
    } catch (error) {
      console.error("Erro ao carregar anexos:", error);
      setCampaignStatus("Erro ao processar arquivos de mídia.");
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setDraft((current) => ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment.id !== id),
    }));
    setCampaignStatus("Anexo removido.");
  };

  const handleReset = () => {
    setDraft(createEmptyDraft());
    setCampaignStatus("Nova campanha em branco.");
  };

  const handleRefreshBridgeStatus = async () => {
    if (!actor) {
      setCampaignStatus("Usuário atual indisponível para consultar o status do WhatsApp.");
      return;
    }

    setIsLoadingBridgeStatus(true);
    setIsConnectionGateDismissed(false); // <--- Forçar exibição do modal caso ainda esteja desconectado

    try {
      const result = await apiGetWhatsAppBridgeStatus(actor);
      if (result.error) {
        setCampaignStatus(result.error);
        return;
      }

      setBridgeStatus(result.data || null);
      setCampaignStatus("Status do WhatsApp atualizado.");
    } catch (error) {
      console.error("Erro ao atualizar bridge:", error);
      setCampaignStatus("Não foi possível atualizar o status do WhatsApp.");
    } finally {
      setIsLoadingBridgeStatus(false);
    }
  };

  const handleLogoutBridge = async () => {
    if (!actor) {
      setCampaignStatus("Usuário atual indisponível para desconectar o WhatsApp.");
      return;
    }

    setIsLoggingOutBridge(true);

    try {
      const result = await apiLogoutWhatsAppBridge(actor);
      if (result.error) {
        setCampaignStatus(result.error);
        return;
      }

      setCampaignStatus("Comando de desconexão enviado ao WhatsApp.");
      await handleRefreshBridgeStatus();
    } catch (error) {
      console.error("Erro ao desconectar bridge:", error);
      setCampaignStatus("Não foi possível desconectar o WhatsApp.");
    } finally {
      setIsLoggingOutBridge(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!actor) {
      setCampaignStatus("Usuário atual indisponível para disparar campanhas.");
      setFeedback({
        show: true,
        type: "error",
        title: "Erro no Disparo",
        message: "Usuário atual indisponível para disparar campanhas.",
      });
      return;
    }

    const hasValidNumbers = recipientSummary.validNumbers.length > 0;
    if (!optInChecked || !templateChecked || !hasValidNumbers) {
      setFeedback({
        show: true,
        type: "error",
        title: "Requisitos de Envio",
        message: "É necessário marcar as caixas \"Opt-in confirmado\", \"Texto revisado para o disparo\" e garantir que o número de telefone esteja devidamente preenchido.",
      });
      return;
    }

    setIsSendingCampaign(true);
    setCampaignStatus("Enviando campanha pelo WhatsApp...");

    try {
      const result = await apiSendWhatsAppCampaign(actor, {
        campaignName: draft.campaignName,
        message: draft.message,
        recipients: draft.recipients,
        attachments: draft.attachments,
        optInChecked: draft.optInChecked,
        templateChecked: draft.templateChecked,
      });
      if (result.error || !result.data) {
        setCampaignStatus(result.error || "Não foi possível disparar a campanha.");
        setFeedback({
          show: true,
          type: "error",
          title: "Erro no Disparo",
          message: result.error || "Não foi possível disparar a campanha.",
        });
        return;
      }

      const summary = result.data;
      setCampaignStatus(
        `Disparo concluído: ${summary.sent}/${summary.attempted} enviado(s), ${summary.failed} falha(s).`,
      );

      const successfulPhones = summary.results.filter((r: any) => r.success).map((r: any) => r.number);
      if (successfulPhones.length > 0) {
        setSentPhones((prev) => [...prev, ...successfulPhones]);
        
        try {
          const content = `Data do Disparo: ${new Date().toLocaleString('pt-BR')}\nCampanha: ${draft.campaignName || 'Campanha WhatsApp'}\n\nMensagem:\n${draft.message}`;
          const base64Content = btoa(unescape(encodeURIComponent(content)));
          const filename = `Campanha_WhatsApp_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.txt`;
          
          for (const phone of successfulPhones) {
            const searchResponse = await fetch(`/api/clientes/search?q=${phone}`);
            if (!searchResponse.ok) continue;
            const searchData = await searchResponse.json();
            const client = searchData.find((c: any) => 
              c.contatos?.some((ct: any) => ct.valor.replace(/\D/g, '').includes(phone))
            );
            
            if (client) {
              await fetch(`/api/clientes/${client.id_cliente}/anexos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nome: filename,
                  tipoMime: 'text/plain',
                  dataUrl: `data:text/plain;base64,${base64Content}`
                })
              });

              if (summary.generatedVideo) {
                await fetch(`/api/clientes/${client.id_cliente}/anexos`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    nome: summary.generatedVideo.name,
                    tipoMime: summary.generatedVideo.mimeType,
                    dataUrl: summary.generatedVideo.dataUrl
                  })
                });

                // Salva os outros anexos que não foram fundidos no vídeo (ex: PDFs)
                const videoComponents = ['image/', 'audio/'];
                for (const att of draft.attachments) {
                  const isMerged = videoComponents.some(prefix => att.mimeType.startsWith(prefix));
                  if (!isMerged) {
                    await fetch(`/api/clientes/${client.id_cliente}/anexos`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        nome: att.name,
                        tipoMime: att.mimeType,
                        dataUrl: att.fileUrl
                      })
                    });
                  }
                }
              } else {
                // Salva todos os anexos já que nenhum vídeo foi gerado
                for (const att of draft.attachments) {
                  await fetch(`/api/clientes/${client.id_cliente}/anexos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      nome: att.name,
                      tipoMime: att.mimeType,
                      dataUrl: att.fileUrl
                    })
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error("Failed to save campaign history to client attachments", err);
        }
      }

      if (summary.failed > 0 && summary.sent === 0) {
        const errors = [...new Set(summary.results.map((r: any) => r.error).filter(Boolean))].join(', ');
        setFeedback({
          show: true,
          type: "error",
          title: "Falha no Envio",
          message: `Nenhuma mensagem pôde ser enviada. Falhas: ${summary.failed}. Detalhe: ${errors || 'Erro desconhecido.'}`,
        });
      } else if (summary.failed > 0) {
        const errors = [...new Set(summary.results.map((r: any) => r.error).filter(Boolean))].join(', ');
        setFeedback({
          show: true,
          type: "success",
          title: "Envio Parcial",
          message: `Campanha disparada parcialmente: ${summary.sent} enviado(s), ${summary.failed} falha(s). Detalhe: ${errors || 'Erro desconhecido.'}`,
        });
      } else {
        setFeedback({
          show: true,
          type: "success",
          title: "Envio Concluído!",
          message: `Campanha enviada com sucesso para os ${summary.sent} destinatários.`,
        });
      }

      await handleRefreshBridgeStatus();
      
      // Limpa todos os campos do shell após o envio concluído com sucesso
      handleReset();
    } catch (error) {
      console.error("Erro ao disparar campanha:", error);
      setCampaignStatus("Erro inesperado ao disparar a campanha.");
      setFeedback({
        show: true,
        type: "error",
        title: "Erro Inesperado",
        message: "Ocorreu um erro inesperado ao processar o disparo da campanha.",
      });
    } finally {
      setIsSendingCampaign(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#f2f6fb_45%,#eef2f7_100%)] pl-2 pr-3 pb-4 pt-3 sm:pl-3 sm:pr-5 sm:pb-6 sm:pt-4 md:pl-4 md:pr-6 md:pb-8 lg:pl-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,application/pdf"
        multiple
        onChange={handleFileSelection}
        className="hidden"
      />

      <div className="mr-auto flex w-full max-w-[1760px] flex-col gap-4 2xl:max-w-[1880px]">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.28fr)_420px] 2xl:grid-cols-[minmax(0,1.25fr)_470px]">
          <div className="space-y-3">
            <WhatsAppCampaignEditor
              message={message}
              optInChecked={optInChecked}
              templateChecked={templateChecked}
              isBridgeConnected={isBridgeConnected}
              status={bridgeStatus}
              onMessageChange={(value) =>
                setDraft((current) => {
                  const firstLine = value.split("\n")[0].trim();
                  const autoName =
                    firstLine.substring(0, 30) ||
                    "Campanha " + new Date().toLocaleDateString("pt-BR");
                  return {
                    ...current,
                    message: value,
                    campaignName:
                      !current.campaignName ||
                      current.campaignName === "Renovação e oportunidades" ||
                      current.campaignName.startsWith("Campanha ") ||
                      current.campaignName === current.message.split("\n")[0].trim().substring(0, 30)
                        ? autoName
                        : current.campaignName,
                  };
                })
              }
              onPickMedia={handlePickFiles}
              onOptInChange={(checked) => setDraft((current) => ({ ...current, optInChecked: checked }))}
              onTemplateChange={(checked) => setDraft((current) => ({ ...current, templateChecked: checked }))}
              onAudioRecorded={(file, dataUrl) => {
                const newAttachment = {
                  id: crypto.randomUUID(),
                  kind: "file" as const,
                  name: file.name,
                  sizeLabel: formatCampaignFileSize(file.size),
                  sizeBytes: file.size,
                  mimeType: file.type || "audio/mp4",
                  fileUrl: dataUrl,
                  uploadedAt: new Date().toISOString(),
                };

                setDraft((current) => ({
                  ...current,
                  attachments: sortCampaignAttachments([...current.attachments, newAttachment]),
                }));

                setCampaignStatus("Áudio gravado e anexado com sucesso.");
              }}
              onPhoneSelected={(phone) => {
                setDraft((current) => {
                  const cleaned = phone.replace(/\D/g, '');
                  const emptyIndex = current.recipients.findIndex(r => !r || r.replace(/\D/g, '').length === 0);
                  
                  if (emptyIndex >= 0) {
                    return {
                      ...current,
                      recipients: replaceRecipientAt(current.recipients, emptyIndex, cleaned)
                    };
                  }
                  
                  if (current.recipients.length < MAX_WHATSAPP_RECIPIENTS) {
                    return {
                      ...current,
                      recipients: normalizeRecipientState([...current.recipients, cleaned])
                    };
                  }
                  
                  return current;
                });
                setCampaignStatus(`Telefone ${phone} adicionado aos destinatários.`);
              }}
              sentPhones={sentPhones}
              onPhonesSelected={(phones) => {
                setDraft((current) => {
                  let newRecipients = [...current.recipients];
                  
                  for (const phone of phones) {
                    const cleaned = phone.replace(/\D/g, '');
                    const emptyIndex = newRecipients.findIndex(r => !r || r.replace(/\D/g, '').length === 0);
                    
                    if (emptyIndex >= 0) {
                      newRecipients = replaceRecipientAt(newRecipients, emptyIndex, cleaned);
                    } else if (newRecipients.length < MAX_WHATSAPP_RECIPIENTS) {
                      newRecipients.push(cleaned);
                    }
                  }
                  
                  return {
                    ...current,
                    recipients: normalizeRecipientState(newRecipients)
                  };
                });
              }}
            />

            <WhatsAppRecipientFields
              recipients={recipients}
              onRecipientChange={handleRecipientChange}
              onAddRecipient={handleAddRecipient}
              onRemoveRecipient={handleRemoveRecipient}
              validRecipients={recipientSummary.validNumbers.length}
              invalidRecipients={recipientSummary.invalidNumbers.length}
              onComposeEmail={() => setShowEmailComposeModal(true)}
            />

            <WhatsAppMediaPanel
              attachments={attachments}
              isUploading={isUploadingAttachments}
              onPickFiles={handlePickFiles}
              onRemoveAttachment={(id) => handleRemoveAttachment(id)}
            />
          </div>

          <div className="flex flex-col h-full min-h-0">
            <WhatsAppMessagePreview
              message={message}
              attachments={attachments}
              onSend={() => void handleSendCampaign()}
              isSending={isSendingCampaign}
              canSend={message.trim().length > 0 && !isUploadingAttachments}
              onRefresh={() => void handleRefreshBridgeStatus()}
              onLogout={() => void handleLogoutBridge()}
              isLoadingRefresh={isLoadingBridgeStatus}
              isLoggingOut={isLoggingOutBridge}
              isConfigured={bridgeStatus?.configured}
            />
          </div>
        </div>
      </div>

      {feedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-[4px] transition-all duration-300 animate-fade-in">
          <div className="relative w-full max-w-[420px] overflow-hidden rounded-[32px] border border-slate-100 bg-white p-6 shadow-[0_24px_50px_rgba(15,23,42,0.15)] transition-all duration-300 transform scale-100 animate-scale-in">
            {/* Top Close Button */}
            <button
              onClick={() => setFeedback(null)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Icon Container with elegant micro-animations */}
              <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-transform duration-500 scale-100 animate-bounce-subtle ${
                feedback.type === "success" 
                  ? "bg-emerald-50 text-emerald-500 border border-emerald-100" 
                  : "bg-rose-50 text-rose-500 border border-rose-100"
              }`}>
                {feedback.type === "success" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-8 w-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-8 w-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                )}
              </div>

              {/* Title & Description */}
              <h3 className="text-base font-black text-slate-900 tracking-tight">{feedback.title}</h3>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500 px-2">{feedback.message}</p>

              {/* Elegant automatic closing progress bar */}
              <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div 
                  className={`h-full rounded-full transition-all duration-[5000ms] ease-linear w-0 animate-progress-bar ${
                    feedback.type === "success" ? "bg-emerald-500" : "bg-rose-500"
                  }`} 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <WhatsAppConnectionGateModal
        open={shouldShowConnectionGate}
        status={bridgeStatus}
        isLoading={isLoadingBridgeStatus}
        isLoggingOut={isLoggingOutBridge}
        onClose={() => {
          setIsConnectionGateDismissed(true);
          onConnectionGateClose?.();
        }}
        onRefresh={() => void handleRefreshBridgeStatus()}
        onLogout={() => void handleLogoutBridge()}
      />

      <EmailComposeModal
        open={showEmailComposeModal}
        onClose={() => setShowEmailComposeModal(false)}
        userId={userId}
        userEmail={userEmail}
        initialBodyHtml={emailBodyHtml}
        initialFiles={emailFiles}
      />
    </div>
  );
}
