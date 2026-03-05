"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type RequestRow = {
  id: string;
  item_id: string | null;
  custom_item_name: string | null;
  requested_quantity: number;
  product_url: string | null;
  requester_name: string;
  club_name: string;
  level: string | null;
  will_collect_self: boolean | null;
  collector_name: string | null;
  collector_email: string | null;
  pickup_at: string | null;
  dropoff_at: string | null;
  responsibility_confirmed: boolean;
  status: string;
  created_at: string;
  items?: {
    item_groups?: {
      name?: string | null;
    } | null;
  } | null;
};

export default function RequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("club_requests")
        .select(
          "id, item_id, custom_item_name, requested_quantity, product_url, requester_name, club_name, level, will_collect_self, collector_name, collector_email, pickup_at, dropoff_at, responsibility_confirmed, status, created_at, items(item_groups(name))",
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load club_requests", error);
        setRows([]);
      } else {
        setRows((data as RequestRow[] | null) ?? []);
      }
      setLoading(false);
    };
    load();
  }, []);

  const markResolved = async (id: string) => {
    setUpdatingId(id);
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("club_requests")
      .update({ status: "resolved", seen: true })
      .eq("id", id);
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "resolved", seen: true } : r)),
    );
    setUpdatingId(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Requested by clubs
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Requests submitted from the public request form. Use this view to
            review, order, and mark them as resolved.
          </p>
        </div>
      </header>

      {loading ? (
        <p className="text-xs text-zinc-500">Loading requests…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-zinc-500">No club requests yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const itemName =
              r.custom_item_name ??
              r.items?.item_groups?.name ??
              "Requested items";
            const pickup =
              r.pickup_at &&
              new Date(r.pickup_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });
            const dropoff =
              r.dropoff_at &&
              new Date(r.dropoff_at).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              });
            return (
              <div
                key={r.id}
                className="space-y-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 text-xs">
                    <p className="text-sm font-semibold text-zinc-900">
                      {itemName}
                    </p>
                    <p className="text-[11px] text-zinc-700">
                      {r.requested_quantity} requested
                    </p>
                    {r.product_url && (
                      <p className="text-[11px]">
                        <span className="font-medium text-zinc-700">
                          Product link:{" "}
                        </span>
                        <a
                          href={r.product_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-700 underline"
                        >
                          Open
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                      {r.status}
                    </span>
                    {pickup && (
                      <p className="text-zinc-500">Pickup: {pickup}</p>
                    )}
                    {dropoff && (
                      <p className="text-zinc-500">
                        Expected drop-off: {dropoff}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={updatingId === r.id || r.status === "resolved"}
                      onClick={() => markResolved(r.id)}
                      className="mt-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {updatingId === r.id ? "Marking…" : "Mark resolved"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 text-[11px] md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="font-medium text-zinc-800">
                      Requester & club
                    </p>
                    <p className="text-zinc-700">
                      {r.requester_name} · {r.club_name}
                      {r.level ? ` · ${r.level}` : ""}
                    </p>
                    <p className="text-zinc-400">
                      Submitted{" "}
                      {new Date(r.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-zinc-800">
                      Collection details
                    </p>
                    <p className="text-zinc-700">
                      {r.will_collect_self
                        ? "Requester will collect"
                        : "Someone else will collect"}
                    </p>
                    {!r.will_collect_self && (
                      <p className="text-zinc-700">
                        {r.collector_name}
                        {r.collector_email ? ` · ${r.collector_email}` : ""}
                      </p>
                    )}
                    <p className="text-zinc-500">
                      Responsibility confirmed:{" "}
                      {r.responsibility_confirmed ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

