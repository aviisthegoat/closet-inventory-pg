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
  level?: string | null;
  will_collect_self?: boolean | null;
  collector_name?: string | null;
  collector_email?: string | null;
  pickup_at?: string | null;
  dropoff_at?: string | null;
  responsibility_confirmed: boolean;
  status: string;
  created_at: string;
  items?: {
    item_groups?: {
      name?: string | null;
    } | null;
  } | null;
};

export default function ClubRequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [orderingId, setOrderingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("club_requests")
        .select("*, items(item_groups(name))")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load club_requests", error);
        setRows([]);
      } else {
        const safeRows = ((data as any[]) ?? []).map((row) => ({
          ...row,
          dropoff_at: row.dropoff_at ?? null,
          level: row.level ?? null,
          will_collect_self: row.will_collect_self ?? null,
          collector_name: row.collector_name ?? null,
          collector_email: row.collector_email ?? null,
        })) as RequestRow[];
        setRows(safeRows);
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

  const markOrderedAndAddToInventory = async (row: RequestRow) => {
    setOrderingId(row.id);
    const supabase = createSupabaseBrowserClient();

    try {
      let itemId = row.item_id;

      if (!itemId) {
        // Create a new item group and item for custom requests
        const { data: group, error: groupErr } = await supabase
          .from("item_groups")
          .insert({
            name: row.custom_item_name ?? "Club requested item",
            description: row.product_url
              ? `Requested by ${row.club_name}. Link: ${row.product_url}`
              : `Requested by ${row.club_name}.`,
          })
          .select("id")
          .single();
        if (groupErr || !group) throw groupErr ?? new Error("Missing item group");

        const { data: item, error: itemErr } = await supabase
          .from("items")
          .insert({
            item_group_id: group.id,
            quantity_on_hand: row.requested_quantity,
            unit: "pcs",
          })
          .select("id")
          .single();
        if (itemErr || !item) throw itemErr ?? new Error("Missing item");

        itemId = item.id as string;
      } else {
        // Increase quantity_on_hand for an existing item
        const { data: existing, error: itemErr } = await supabase
          .from("items")
          .select("id, quantity_on_hand")
          .eq("id", itemId)
          .single();
        if (itemErr || !existing)
          throw itemErr ?? new Error("Existing item not found");
        const currentQty = Number(existing.quantity_on_hand) || 0;
        const newQty = currentQty + Number(row.requested_quantity || 0);
        const { error: updateErr } = await supabase
          .from("items")
          .update({ quantity_on_hand: newQty })
          .eq("id", itemId);
        if (updateErr) throw updateErr;
      }

      const startAt = row.pickup_at ?? new Date().toISOString();
      const endAt = row.dropoff_at ?? null;

      const { error: resErr } = await supabase.from("reservations").insert({
        item_id: itemId,
        bin_id: null,
        borrower_name: row.requester_name,
        club_name: row.club_name,
        event_name: null,
        quantity: row.requested_quantity,
        start_at: startAt,
        end_at: endAt,
        status: "planned",
        notes: "Club request order",
      });
      if (resErr) throw resErr;

      const { error: reqErr } = await supabase
        .from("club_requests")
        .update({ status: "ordered", item_id: itemId, seen: true })
        .eq("id", row.id);
      if (reqErr) throw reqErr;

      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, status: "ordered", item_id: itemId } : r,
        ),
      );
    } catch (err) {
      console.error("Failed to mark ordered and add to inventory", err);
      // We intentionally don't surface a toast here yet; console is enough for now.
    } finally {
      setOrderingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Club requests
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Requests submitted from the public request form. Mark them as{" "}
            <span className="font-medium">ordered</span> to add items into
            inventory and create reservations, or resolve them when done.
          </p>
        </div>
      </header>

      {loading ? (
        <p className="text-xs text-zinc-500">Loading club requests…</p>
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

            const productUrl =
              r.product_url && !/^https?:\/\//i.test(r.product_url)
                ? `https://${r.product_url}`
                : r.product_url ?? null;

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
                    {productUrl && (
                      <p className="text-[11px]">
                        <span className="font-medium text-zinc-700">
                          Product link:{" "}
                        </span>
                        <a
                          href={productUrl}
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
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          orderingId === r.id ||
                          r.status === "ordered" ||
                          r.status === "resolved"
                        }
                        onClick={() => markOrderedAndAddToInventory(r)}
                        className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                      >
                        {orderingId === r.id ? "Saving…" : "Mark ordered"}
                      </button>
                      <button
                        type="button"
                        disabled={
                          updatingId === r.id || r.status === "resolved"
                        }
                        onClick={() => markResolved(r.id)}
                        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {updatingId === r.id ? "Marking…" : "Mark resolved"}
                      </button>
                    </div>
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

