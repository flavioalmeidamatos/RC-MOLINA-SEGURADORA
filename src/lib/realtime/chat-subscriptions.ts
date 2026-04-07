import { supabase } from "../supabase";

type PostgresRealtimePayload<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | null;
  old: T | null;
};

export async function subscribeToChatRealtime(params: {
  instanceId: string;
  selectedChatId?: string | null;
  accessToken?: string | null;
  onChatChange: (payload: PostgresRealtimePayload<any>) => void;
  onMessageChange?: (payload: PostgresRealtimePayload<any>) => void;
}) {
  if (params.accessToken) {
    await supabase.realtime.setAuth(params.accessToken);
  }

  const channels = [];

  const chatsChannel = supabase
    .channel(`whatsapp-instance-${params.instanceId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "chats",
        filter: `instance_id=eq.${params.instanceId}`,
      },
      (payload) => params.onChatChange(payload as PostgresRealtimePayload<any>)
    );

  channels.push(chatsChannel);

  if (params.selectedChatId) {
    const messagesChannel = supabase
      .channel(`whatsapp-chat-${params.selectedChatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${params.selectedChatId}`,
        },
        (payload) => params.onMessageChange?.(payload as PostgresRealtimePayload<any>)
      );

    channels.push(messagesChannel);
  }

  await Promise.all(channels.map((channel) => channel.subscribe()));

  return () => {
    channels.forEach((channel) => {
      void supabase.removeChannel(channel);
    });
  };
}
