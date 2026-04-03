import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type ChannelStatus = "SUBSCRIBED" | "CONNECTING" | "CLOSED" | "CHANNEL_ERROR";

export function useRealtimeChannel(
  channelName: string,
  subscriptions: Array<{
    table: string;
    event?: "INSERT" | "UPDATE" | "DELETE" | "*";
    filter?: string;
    callback: (payload: any) => void;
  }>
) {
  const [status, setStatus] = useState<ChannelStatus>("CONNECTING");

  useEffect(() => {
    let channel: RealtimeChannel = supabase.channel(channelName);

    subscriptions.forEach((sub) => {
      const config: any = {
        event: sub.event ?? "*",
        schema: "public",
        table: sub.table,
      };
      if (sub.filter) config.filter = sub.filter;
      channel = channel.on("postgres_changes", config, sub.callback);
    });

    channel.subscribe((s) => {
      setStatus(s as ChannelStatus);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName]);

  return status;
}
