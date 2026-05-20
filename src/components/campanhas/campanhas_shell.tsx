import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Loader2, Megaphone, Save, Send, ShieldCheck, Sparkles, Trash2, Users } from "lucide-react";

import { fileToDataUrl } from "../../lib/whatsapp_attachments";
import {
  apiCreateCampaign,
  apiDeleteCampaign,
  apiDeleteCampaignAttachment,
  apiListCampaignHistory,
  apiListCampaigns,
  apiUpdateCampaign,
  apiUploadCampaignAttachment,
} from "../../lib/campanhas_api";
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
  CampaignHistoryEntry,
  SaveWhatsAppCampaignPayload,
  SavedWhatsAppCampaign,
  WhatsAppBridgeStatus,
  WhatsAppCampaignDraft,
} from "../../types/whatsapp_campaign";
import { CampaignHistory } from "./campaign_history";
import { WhatsAppCampaignEditor } from "./whatsapp_campaign_editor";
import { WhatsAppConnectionStatus } from "./whatsapp_connection_status";
import { WhatsAppMediaPanel } from "./whatsapp_media_panel";
import { WhatsAppMessagePreview } from "./whatsapp_message_preview";
import { WhatsAppOptInPanel } from "./whatsapp_optin_panel";
import { WhatsAppRecipientFields } from "./whatsapp_recipient_fields";

interface CampanhasShellProps {
  userId: string | null;
  userEmail: string | null;
}

const createEmptyDraft = (): WhatsAppCampaignDraft => ({
  campaignName: "",
  message: "",
  recipients: createRecipientState(""),
  attachments: [],
  optInChecked: false,
  templateChecked: false,
});

const campaignToDraft = (campaign: SavedWhatsAppCampaign): WhatsAppCampaignDraft => ({
  campaignName: campaign.campaignName,
  message: campaign.message,
  recipients: normalizeRecipientState(campaign.recipients),
  attachments: campaign.attachments,
  optInChecked: campaign.optInChecked,
  templateChecked: campaign.templateChecked,
});

const draftToPayload = (draft: WhatsAppCampaignDraft): SaveWhatsAppCampaignPayload => ({
  campaignName: draft.campaignName,
  message: draft.message,
  recipients: draft.recipients,
  attachments: draft.attachments,
  optInChecked: draft.optInChecked,
  templateChecked: draft.templateChecked,
});

export function CampanhasShell({ userId, userEmail }: CampanhasShellProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const actor = useMemo(
    () => (userId && userEmail ? { id: userId, email: userEmail } : null),
    [userEmail, userId],
  );
  const [draft, setDraft] = useState<WhatsAppCampaignDraft>({
    campaignName: "Renovação e oportunidades",
    message:
      "Olá! *Estamos passando para lembrar* sobre as opções de renovação do seu plano.\n\nSe quiser, responda esta mensagem e seguimos com o atendimento.",
    recipients: createRecipientState(""),
    attachments: [],
    optInChecked: false,
    templateChecked: false,
  });
  const [savedCampaigns, setSavedCampaigns] = useState<SavedWhatsAppCampaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignStatus, setCampaignStatus] = useState("");
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);
  const [isDeletingCampaignId, setIsDeletingCampaignId] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<WhatsAppBridgeStatus | null>(null);
  const [isLoadingBridgeStatus, setIsLoadingBridgeStatus] = useState(false);
  const [isLoggingOutBridge, setIsLoggingOutBridge] = useState(false);
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [campaignHistory, setCampaignHistory] = useState<CampaignHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);

  const { campaignName, message, recipients, attachments, optInChecked, templateChecked } = draft;

  const recipientSummary = useMemo(() => getRecipientSummary(recipients), [recipients]);

  const readyForNextPhase =
    message.trim().length > 0 &&
    recipientSummary.validNumbers.length > 0 &&
    optInChecked &&
    templateChecked;

  useEffect(() => {
    let ignore = false;

    const loadCampaigns = async () => {
      if (!actor) {
        setSavedCampaigns([]);
        setActiveCampaignId(null);
        setCampaignStatus("Sessão de campanhas indisponível.");
        return;
      }

      setIsLoadingCampaigns(true);

      try {
        const result = await apiListCampaigns(actor);
        if (ignore) return;

        if (result.error) {
          setSavedCampaigns([]);
          setCampaignStatus(result.error);
          return;
        }

        const campaigns = result.data || [];
        setSavedCampaigns(campaigns);
        setCampaignStatus(
          campaigns.length > 0
            ? `${campaigns.length} campanha(s) carregada(s) do servidor.`
            : "Nenhuma campanha salva ainda.",
        );
      } catch (error) {
        if (!ignore) {
          console.error("Erro ao carregar campanhas:", error);
          setSavedCampaigns([]);
          setCampaignStatus("Não foi possível carregar as campanhas.");
        }
      } finally {
        if (!ignore) {
          setIsLoadingCampaigns(false);
        }
      }
    };

    void loadCampaigns();

    return () => {
      ignore = true;
    };
  }, [actor]);

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
    }, 15000);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [actor]);

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
      setCampaignStatus("Enviando anexos para a campanha...");

      const hadActiveCampaign = Boolean(activeCampaignId);
      const campaignId = await ensureCampaignForAttachments();
      let latestCampaign: SavedWhatsAppCampaign | null = null;

      for (const file of selectedFiles) {
        const dataUrl = await fileToDataUrl(file);
        const result = await apiUploadCampaignAttachment(actor!, campaignId, {
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          dataUrl,
        });

        if (result.error || !result.data) {
          throw new Error(result.error || `Não foi possível enviar o anexo "${file.name}".`);
        }

        latestCampaign = result.data;
      }

      if (latestCampaign) {
        if (hadActiveCampaign) {
          setDraft((current) => ({
            ...current,
            attachments: latestCampaign?.attachments || current.attachments,
          }));
        } else {
          setDraft(campaignToDraft(latestCampaign));
        }
        setActiveCampaignId(latestCampaign.id);
        await refreshCampaigns(null);
        await refreshCampaignHistory(latestCampaign.id);
      }

      setCampaignStatus(`${selectedFiles.length} anexo(s) enviado(s) para o servidor.`);
    } catch (error) {
      console.error("Erro ao enviar anexos:", error);
      setCampaignStatus(error instanceof Error ? error.message : "Não foi possível enviar os anexos.");
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const handleRemoveAttachment = async (id: string) => {
    const localAttachment = attachments.find((attachment) => attachment.id === id);
    if (!localAttachment) {
      return;
    }

    if (!actor || !activeCampaignId || !localAttachment.fileUrl) {
      setDraft((current) => ({
        ...current,
        attachments: current.attachments.filter((attachment) => attachment.id !== id),
      }));
      return;
    }

    try {
      setCampaignStatus(`Removendo anexo "${localAttachment.name}"...`);
      const result = await apiDeleteCampaignAttachment(actor, activeCampaignId, id);
      if (result.error || !result.data) {
        setCampaignStatus(result.error || "Não foi possível remover o anexo.");
        return;
      }

      setDraft((current) => ({
        ...current,
        attachments: result.data?.attachments || current.attachments,
      }));
      await refreshCampaigns(null);
      await refreshCampaignHistory(result.data.id);
      setCampaignStatus(`Anexo "${localAttachment.name}" removido.`);
    } catch (error) {
      console.error("Erro ao remover anexo:", error);
      setCampaignStatus("Não foi possível remover o anexo.");
    }
  };

  const handleReset = () => {
    setDraft(createEmptyDraft());
    setActiveCampaignId(null);
    setCampaignHistory([]);
    setCampaignStatus("Nova campanha em branco.");
  };

  const handleSelectCampaign = (campaign: SavedWhatsAppCampaign) => {
    setDraft(campaignToDraft(campaign));
    setActiveCampaignId(campaign.id);
    setCampaignStatus(`Campanha "${campaign.campaignName}" carregada.`);
  };

  const refreshCampaignHistory = async (campaignId: string | null) => {
    if (!actor || !campaignId) {
      setCampaignHistory([]);
      return;
    }

    setIsLoadingHistory(true);

    try {
      const result = await apiListCampaignHistory(actor, campaignId);
      if (result.error) {
        setCampaignStatus(result.error);
        return;
      }

      setCampaignHistory(result.data || []);
    } catch (error) {
      console.error("Erro ao carregar historico:", error);
      setCampaignStatus("Não foi possível carregar o histórico da campanha.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const refreshCampaigns = async (nextActiveId?: string | null) => {
    if (!actor) return;

    const result = await apiListCampaigns(actor);
    if (result.error) {
      setCampaignStatus(result.error);
      return;
    }

    const campaigns = result.data || [];
    setSavedCampaigns(campaigns);

    if (nextActiveId) {
      const selected = campaigns.find((campaign) => campaign.id === nextActiveId);
      if (selected) {
        setDraft(campaignToDraft(selected));
        setActiveCampaignId(selected.id);
      }
    }
  };

  const ensureCampaignForAttachments = async () => {
    if (!actor) {
      throw new Error("Usuário atual indisponível para anexar arquivos.");
    }

    if (activeCampaignId) {
      return activeCampaignId;
    }

    const result = await apiCreateCampaign(actor, draftToPayload(draft));
    if (result.error || !result.data) {
      throw new Error(result.error || "Não foi possível criar a campanha antes do upload.");
    }

    setDraft(campaignToDraft(result.data));
    setActiveCampaignId(result.data.id);
    await refreshCampaigns(result.data.id);
    await refreshCampaignHistory(result.data.id);
    return result.data.id;
  };

  const handleSaveCampaign = async () => {
    if (!actor) {
      setCampaignStatus("Usuário atual indisponível para salvar campanhas.");
      return;
    }

    setIsSavingCampaign(true);
    setCampaignStatus(activeCampaignId ? "Atualizando campanha..." : "Salvando campanha...");

    try {
      const payload = draftToPayload(draft);
      const result = activeCampaignId
        ? await apiUpdateCampaign(actor, activeCampaignId, payload)
        : await apiCreateCampaign(actor, payload);

      if (result.error || !result.data) {
        setCampaignStatus(result.error || "Não foi possível salvar a campanha.");
        return;
      }

      await refreshCampaigns(result.data.id);
      await refreshCampaignHistory(result.data.id);
      setCampaignStatus(
        activeCampaignId
          ? `Campanha "${result.data.campaignName}" atualizada com sucesso.`
          : `Campanha "${result.data.campaignName}" salva com sucesso.`,
      );
    } catch (error) {
      console.error("Erro ao salvar campanha:", error);
      setCampaignStatus("Erro inesperado ao salvar a campanha.");
    } finally {
      setIsSavingCampaign(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!actor) {
      setCampaignStatus("Usuário atual indisponível para excluir campanhas.");
      return;
    }

    setIsDeletingCampaignId(id);

    try {
      const result = await apiDeleteCampaign(actor, id);
      if (result.error) {
        setCampaignStatus(result.error);
        return;
      }

      const wasActive = activeCampaignId === id;
      if (wasActive) {
        setDraft(createEmptyDraft());
        setActiveCampaignId(null);
        setCampaignHistory([]);
      }

      await refreshCampaigns(null);
      setCampaignStatus("Campanha removida com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir campanha:", error);
      setCampaignStatus("Erro inesperado ao excluir a campanha.");
    } finally {
      setIsDeletingCampaignId(null);
    }
  };

  const handleRefreshBridgeStatus = async () => {
    if (!actor) {
      setCampaignStatus("Usuário atual indisponível para consultar o status do WhatsApp.");
      return;
    }

    setIsLoadingBridgeStatus(true);

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
      return;
    }

    if (!activeCampaignId) {
      setCampaignStatus("Salve a campanha antes do disparo para manter a trilha de auditoria.");
      return;
    }

    setIsSendingCampaign(true);
    setCampaignStatus("Enviando campanha pelo WhatsApp...");

    try {
      const result = await apiSendWhatsAppCampaign(actor, {
        ...draftToPayload(draft),
        campaignId: activeCampaignId,
      });
      if (result.error || !result.data) {
        setCampaignStatus(result.error || "Não foi possível disparar a campanha.");
        return;
      }

      const summary = result.data;
      setCampaignStatus(
        `Disparo concluido: ${summary.sent}/${summary.attempted} enviado(s), ${summary.failed} falha(s).`,
      );
      await handleRefreshBridgeStatus();
      await refreshCampaignHistory(activeCampaignId);
    } catch (error) {
      console.error("Erro ao disparar campanha:", error);
      setCampaignStatus("Erro inesperado ao disparar a campanha.");
    } finally {
      setIsSendingCampaign(false);
    }
  };

  useEffect(() => {
    void refreshCampaignHistory(activeCampaignId);
  }, [activeCampaignId, actor]);

  return (
    <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#f2f6fb_45%,#eef2f7_100%)] px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4 md:px-8 md:pb-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,application/pdf"
        multiple
        onChange={handleFileSelection}
        className="hidden"
      />

      <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-4">
        <section className="overflow-hidden rounded-[34px] border border-white/70 bg-[#0c1826] text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
          <div className="relative px-5 py-4 sm:px-6 sm:py-5">
            <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-[#d4af37]/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-300/10 blur-3xl" />

            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#d4af37]">
                  Campanhas
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                  Shell de WhatsApp pronto para evolucao
                </h2>
                <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-white/65 sm:text-sm">
                  Esta fase substitui o placeholder por uma interface modular ja encaixada no dashboard da RC Molina.
                  Agora o modulo tambem monitora a conexao com o servico externo do WhatsApp e ja consegue disparar
                  mensagens com anexos persistidos de forma controlada.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-[#d4af37]">
                    <Megaphone size={15} strokeWidth={1.8} />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                      Shell
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-black">Ativo</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-[#d4af37]">
                    <Users size={15} strokeWidth={1.8} />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                      Validos
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-black">{recipientSummary.validNumbers.length}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-[#d4af37]">
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                      Compliance
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-black">{readyForNextPhase ? "OK" : "Pendente"}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-[#d4af37]">
                    <Sparkles size={15} strokeWidth={1.8} />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                      Proxima
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-black">Bridge</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-amber-900 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">
            Escopo desta fase
          </p>
          <p className="mt-1 text-xs font-semibold leading-5">
            A aplicacao agora persiste anexos no servidor da RC Molina e os envia pela bridge do WhatsApp junto com a
            mensagem, respeitando politica de formato e tamanho.
          </p>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_420px]">
          <div className="space-y-4">
            <WhatsAppCampaignEditor
              campaignName={campaignName}
              message={message}
              onCampaignNameChange={(value) => setDraft((current) => ({ ...current, campaignName: value }))}
              onMessageChange={(value) => setDraft((current) => ({ ...current, message: value }))}
            />

            <WhatsAppRecipientFields
              recipients={recipients}
              onRecipientChange={handleRecipientChange}
              onAddRecipient={handleAddRecipient}
              onRemoveRecipient={handleRemoveRecipient}
              validRecipients={recipientSummary.validNumbers.length}
              invalidRecipients={recipientSummary.invalidNumbers.length}
            />
          </div>

          <div className="space-y-4">
            <WhatsAppConnectionStatus
              status={bridgeStatus}
              isLoading={isLoadingBridgeStatus}
              isLoggingOut={isLoggingOutBridge}
              onRefresh={() => void handleRefreshBridgeStatus()}
              onLogout={() => void handleLogoutBridge()}
            />

            <WhatsAppMessagePreview
              campaignName={campaignName}
              message={message}
              validRecipients={recipientSummary.validNumbers.length}
              attachments={attachments}
              readyForNextPhase={readyForNextPhase}
            />

            <WhatsAppMediaPanel
              attachments={attachments}
              isUploading={isUploadingAttachments}
              onPickFiles={handlePickFiles}
              onRemoveAttachment={(id) => void handleRemoveAttachment(id)}
            />

            <WhatsAppOptInPanel
              optInChecked={optInChecked}
              templateChecked={templateChecked}
              onOptInChange={(checked) => setDraft((current) => ({ ...current, optInChecked: checked }))}
              onTemplateChange={(checked) => setDraft((current) => ({ ...current, templateChecked: checked }))}
            />

            <CampaignHistory
              items={campaignHistory}
              isLoading={isLoadingHistory}
              activeCampaignName={activeCampaignId ? campaignName || "Campanha sem nome" : ""}
            />

            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#b58c2a]">
                      Rascunhos
                    </p>
                    <h3 className="mt-1 text-lg font-black tracking-tight text-[#0c1826]">
                      Campanhas salvas
                    </h3>
                  </div>

                  {isLoadingCampaigns ? (
                    <Loader2 size={16} className="animate-spin text-[#b58c2a]" />
                  ) : null}
                </div>
              </div>

              <div className="space-y-3 p-5">
                {savedCampaigns.length === 0 ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">
                    Nenhuma campanha salva no servidor.
                  </div>
                ) : (
                  savedCampaigns.map((campaign) => {
                    const isActiveCampaign = campaign.id === activeCampaignId;

                    return (
                      <article
                        key={campaign.id}
                        className={`rounded-[24px] border px-4 py-4 transition ${
                          isActiveCampaign
                            ? "border-[#d4af37] bg-[#fff9ec] shadow-sm"
                            : "border-slate-200 bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => handleSelectCampaign(campaign)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-sm font-black text-[#0c1826]">
                              {campaign.campaignName || "Campanha sem nome"}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {campaign.recipients.filter(Boolean).length} contato(s) · atualizado em{" "}
                              {new Date(campaign.updatedAt).toLocaleDateString("pt-BR")}
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteCampaign(campaign.id)}
                            disabled={isDeletingCampaignId === campaign.id}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-red-200 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Excluir ${campaign.campaignName}`}
                          >
                            {isDeletingCampaignId === campaign.id ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} strokeWidth={1.8} />
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#b58c2a]">
                Estado de entrega
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {campaignStatus || "Campanhas agora possui shell proprio no dashboard e persistencia basica no servidor."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSaveCampaign()}
                disabled={isSavingCampaign || isUploadingAttachments || !actor}
                className="inline-flex items-center gap-2 rounded-full bg-[#0c1826] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#132338] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSavingCampaign ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} strokeWidth={1.8} />}
                {activeCampaignId ? "Atualizar" : "Salvar"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Limpar shell
              </button>
              <button
                type="button"
                onClick={() => void handleSendCampaign()}
                disabled={
                  isSendingCampaign ||
                  isUploadingAttachments ||
                  !readyForNextPhase ||
                  !activeCampaignId ||
                  bridgeStatus?.status !== "connected"
                }
                className="inline-flex items-center gap-2 rounded-full bg-[#0c1826] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#132338] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSendingCampaign ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} strokeWidth={1.8} />}
                Disparar agora
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
