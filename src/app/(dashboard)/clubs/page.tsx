 "use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type RequestRow = {
  id: string;
  item_id: string | null;
  custom_item_name: string | null;
  requested_quantity: number;
  product_url: string | null;
  estimated_unit_price?: number | null;
  delivery_details?: string | null;
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
  const [editing, setEditing] = useState<RequestRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

            const unitPrice =
              typeof r.estimated_unit_price === "number"
                ? r.estimated_unit_price
                : null;
            const estTotal =
              unitPrice != null
                ? unitPrice * Number(r.requested_quantity || 0)
                : null;

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
                      {unitPrice != null && (
                        <>
                          {" · ~$"}
                          {unitPrice.toFixed(2)} each
                        </>
                      )}
                    </p>
                    {estTotal != null && (
                      <p className="text-[11px] text-zinc-700">
                        Approx. total: ${estTotal.toFixed(2)}
                      </p>
                    )}
                    {r.delivery_details && (
                      <p className="text-[11px] text-amber-900">
                        {r.delivery_details}
                      </p>
                    )}
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
                          View
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
                        onClick={() => setEditing(r)}
                        className="rounded-2xl border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === r.id}
                        onClick={async () => {
                          if (!window.confirm("Delete this club request?")) {
                            return;
                          }
                          setDeletingId(r.id);
                          const supabase = createSupabaseBrowserClient();
                          await supabase
                            .from("club_requests")
                            .delete()
                            .eq("id", r.id);
                          setRows((prev) => prev.filter((row) => row.id !== r.id));
                          setDeletingId(null);
                        }}
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        {deletingId === r.id ? "Deleting…" : "Delete"}
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
      {editing && (
        <EditClubRequestModal
          row={editing}
          saving={savingEdit}
          onClose={() => setEditing(null)}
          onSave={async (updates) => {
            const supabase = createSupabaseBrowserClient();
            setSavingEdit(true);
            try {
              const { error } = await supabase
                .from("club_requests")
                .update({
                  custom_item_name: updates.custom_item_name,
                  requested_quantity: updates.requested_quantity,
                  product_url: updates.product_url,
                  estimated_unit_price: updates.estimated_unit_price,
                  delivery_details: updates.delivery_details,
                })
                .eq("id", editing.id);
              if (error) throw error;
              setRows((prev) =>
                prev.map((r) =>
                  r.id === editing.id ? { ...r, ...updates } : r,
                ),
              );
              setEditing(null);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error("Failed to update club request", e);
            } finally {
              setSavingEdit(false);
            }
          }}
        />
      )}
    </div>
  );
}

type EditClubRequestModalProps = {
  row: RequestRow;
  saving: boolean;
  onClose: () => void;
  onSave: (updates: Partial<RequestRow>) => Promise<void>;
};

function EditClubRequestModal({
  row,
  saving,
  onClose,
  onSave,
}: EditClubRequestModalProps) {
  const [form, setForm] = useState<Partial<RequestRow>>({
    custom_item_name: row.custom_item_name,
    requested_quantity: row.requested_quantity,
    product_url: row.product_url,
    estimated_unit_price: row.estimated_unit_price ?? null,
    delivery_details: row.delivery_details ?? "",
  });

  const setField = <K extends keyof RequestRow>(
    key: K,
    value: RequestRow[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const isCustom = !row.item_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-4 shadow-xl ring-1 ring-zinc-100">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            Edit club request
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-zinc-800"
          >
            Close
          </button>
        </div>
        <div className="space-y-3 text-xs">
          {isCustom && (
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Item name
              </label>
              <input
                type="text"
                value={form.custom_item_name ?? ""}
                onChange={(e) =>
                  setField("custom_item_name", e.target.value || null)
                }
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
              />
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Quantity
              </label>
              <input
                type="number"
                min={1}
                value={form.requested_quantity ?? 1}
                onChange={(e) =>
                  setField(
                    "requested_quantity",
                    Number(e.target.value) || 1,
                  )
                }
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Unit cost (optional)
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-zinc-500">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.estimated_unit_price ?? ""}
                  onChange={(e) =>
                    setField(
                      "estimated_unit_price",
                      e.target.value === ""
                        ? null
                        : (Number(e.target.value) || 0),
                    )
                  }
                  placeholder="Unit cost"
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-zinc-700">
              Product link
            </label>
            <input
              type="text"
              value={form.product_url ?? ""}
              onChange={(e) =>
                setField("product_url", e.target.value || null)
              }
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-zinc-700">
              Delivery details (optional)
            </label>
            <textarea
              rows={3}
              value={form.delivery_details ?? ""}
              onChange={(e) =>
                setField("delivery_details", e.target.value || null)
              }
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={saving}
            className="rounded-2xl bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

