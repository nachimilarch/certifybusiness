"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inboxApi, type ListConversationsParams } from "../lib/api/inbox";
import { useAuthStore } from "../lib/auth-store";
import type { ConversationDTO, ConversationDetailDTO } from "../types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export const inboxKeys = {
  all: ["inbox"] as const,
  list: (params?: ListConversationsParams) => ["inbox", "list", params] as const,
  detail: (id: string) => ["inbox", "detail", id] as const,
  stats: () => ["inbox", "stats"] as const,
};

// ─── SSE hook ─────────────────────────────────────────────────────────────────
/**
 * Opens a persistent SSE connection to /api/v1/inbox/stream.
 *
 * Auth: fetches a 30-second one-time token from POST /inbox/stream-token before
 * each connect. The full JWT never appears in the SSE URL or server access logs.
 * Because EventSource auto-reconnect would reuse the expired token, we manage
 * reconnection manually with exponential backoff.
 *
 * Cache updates:
 *  - inbox:new / inbox:update (non-read)  → full invalidation
 *  - inbox:update { event: "read" }       → optimistic zero-out of unread count
 *    so the badge drops immediately without waiting for the next poll.
 */
export function useInboxSSE() {
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (typeof window === "undefined" || !accessToken) return;

    let es: EventSource | null = null;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 1_000;
    const MAX_BACKOFF_MS = 30_000;

    async function connect() {
      if (cancelled) return;
      try {
        const { token } = await inboxApi.streamToken();
        if (cancelled) return;

        es = new EventSource(`${API_BASE}/inbox/stream?t=${encodeURIComponent(token)}`);

        es.addEventListener("connected", () => {
          backoffMs = 1_000; // reset backoff on confirmed handshake
        });

        es.addEventListener("inbox:new", () => {
          qc.invalidateQueries({ queryKey: inboxKeys.all });
        });

        es.addEventListener("inbox:update", (raw: Event) => {
          const e = raw as MessageEvent;
          try {
            const data = JSON.parse(e.data) as { conversationId: string; event: string };

            if (data.event === "read") {
              // Optimistic: zero out the conversation's unread count immediately
              // across every cached list page so the sidebar badge drops at once.
              qc.setQueriesData<{ data: ConversationDTO[] }>(
                { queryKey: ["inbox", "list"], exact: false },
                (old) => {
                  if (!old?.data) return old;
                  return {
                    ...old,
                    data: old.data.map((c) =>
                      c.id === data.conversationId ? { ...c, unreadCount: 0 } : c
                    ),
                  };
                }
              );
              qc.setQueryData<ConversationDetailDTO>(
                inboxKeys.detail(data.conversationId),
                (old) => (old ? { ...old, unreadCount: 0 } : old)
              );
              // Stats total needs a fresh fetch (we don't know the previous count)
              qc.invalidateQueries({ queryKey: inboxKeys.stats() });
            } else {
              qc.invalidateQueries({ queryKey: inboxKeys.all });
            }
          } catch {
            qc.invalidateQueries({ queryKey: inboxKeys.all });
          }
        });

        es.onerror = () => {
          // The one-time token is already consumed — EventSource auto-reconnect
          // would fail with 401. Close it and reconnect manually with a fresh token.
          es?.close();
          es = null;
          if (!cancelled) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
              connect();
            }, backoffMs);
          }
        };
      } catch {
        // streamToken() failed (network error, 401 session expired, etc.)
        if (!cancelled) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
            connect();
          }, backoffMs);
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [accessToken, qc]);
}

// ─── Data hooks ───────────────────────────────────────────────────────────────

export function useInboxStats() {
  return useQuery({
    queryKey: inboxKeys.stats(),
    queryFn: inboxApi.stats,
    // SSE handles push; polling is just a safety net
    refetchInterval: 60_000,
  });
}

export function useConversations(params?: ListConversationsParams) {
  return useQuery({
    queryKey: inboxKeys.list(params),
    queryFn: () => inboxApi.list(params),
    // SSE handles real-time; fallback poll every 30 s (down from 10 s)
    refetchInterval: 30_000,
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: inboxKeys.detail(id),
    queryFn: () => inboxApi.get(id),
    enabled: !!id,
    // SSE drives real-time; fallback every 30 s
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "awaiting_employee" || status === "open" ? 30_000 : false;
    },
  });
}

export function useReplyConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, bodyHtml }: { id: string; body: string; bodyHtml?: string }) =>
      inboxApi.reply(id, body, bodyHtml),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: inboxKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["inbox", "list"] });
    },
  });
}

export function useAssignConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId, reason }: { id: string; userId: string; reason?: string }) =>
      inboxApi.assign(id, userId, reason),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: inboxKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["inbox", "list"] });
    },
  });
}

export function useCloseConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inboxApi.close(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: inboxKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["inbox", "list"] });
      qc.invalidateQueries({ queryKey: inboxKeys.stats() });
    },
  });
}

export function useReopenConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inboxApi.reopen(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: inboxKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["inbox", "list"] });
    },
  });
}
