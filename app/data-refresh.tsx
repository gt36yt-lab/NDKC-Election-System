"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

const REFRESH_INTERVAL_MS = 15_000;
const TABLES = ["students", "candidates", "parties", "election_settings", "votes"] as const;

export default function DataRefresh() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createClient();
    let refreshTimeout: number | undefined;

    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(refresh, 300);
    };

    const channel = supabase.channel("application-data-refresh");
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
    }
    channel.subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("[DataRefresh] Supabase Realtime subscription failed:", error ?? status);
      }
    });

    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refreshOnVisible);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.clearTimeout(refreshTimeout);
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnVisible);
      document.removeEventListener("visibilitychange", refreshOnVisible);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
