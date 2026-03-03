"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { ItemForm } from "@/components/forms/ItemForm";
import { BulkItemForm } from "@/components/forms/BulkItemForm";

type ItemRow = {
  id: string;
  item_group_name: string;
  bin_label: string | null;
  location_name: string | null;
  quantity_on_hand: number;
  unit: string;
  low_stock_threshold: number | null;
  is_checked_out: boolean;
};

export default function InventoryPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNewItem, setShowNewItem] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<{
    item_group_id: string;
    item_group_name: string;
    bin_id: string | null;
    location_id: string | null;
    quantity_on_hand: number;
    unit: string;
    low_stock_threshold: number | null;
    notes: string | null;
  } | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();
      let query = supabase.from("v_items_with_status").select("*");

      const filter = searchParams.get("filter");
      if (filter === "low-stock") {
        query = supabase.from("v_low_stock_items").select("*");
      }

      const { data } = await query;

      setItems((data as ItemRow[]) ?? []);
      setLoading(false);
    };

    fetchItems();
  }, [searchParams]);

  const filtered = items.filter((item) =>
    [item.item_group_name, item.bin_label, item.location_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Inventory
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Search everything in the closet and quickly add new items.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowNewItem(true)}
            className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
          >
            + Add item
          </button>
          <button
            onClick={() => setShowBulkAdd(true)}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            + Add multiple
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          placeholder="Search by item, bin, shelf, event..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        />
        <span className="text-xs text-zinc-500">
          {filtered.length} of {items.length} results
        </span>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-100">
        <table className="min-w-full divide-y divide-zinc-100 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Item
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Bin
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Quantity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-xs text-zinc-500"
                >
                  Loading items...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-xs text-zinc-500"
                >
                  No items found yet. Try adjusting your search or add your
                  first item.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isLow =
                  item.low_stock_threshold !== null &&
                  item.quantity_on_hand <= item.low_stock_threshold;
                return (
                  <tr key={item.id} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-900">
                          {item.item_group_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {item.bin_label ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {item.location_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {item.quantity_on_hand} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.is_checked_out && (
                          <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                            Checked out
                          </span>
                        )}
                        {isLow && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            Low
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            const supabase = createSupabaseBrowserClient();
                            // #region agent log
                            fetch(
                              "http://127.0.0.1:7815/ingest/b307b67c-0b91-415b-ba95-a48343d93232",
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  "X-Debug-Session-Id": "ddae03",
                                },
                                body: JSON.stringify({
                                  sessionId: "ddae03",
                                  runId: "pre-fix",
                                  hypothesisId: "H3_click_handler_runs",
                                  location:
                                    "src/app/(dashboard)/inventory/page.tsx:174",
                                  message: "Inventory Edit button clicked",
                                  data: { itemId: item.id },
                                  timestamp: Date.now(),
                                }),
                              },
                            ).catch(() => {});
                            // #endregion
                            const { data: row, error } = await supabase
                              .from("items")
                              .select(
                                "id, item_group_id, bin_id, location_id, quantity_on_hand, unit, low_stock_threshold, notes, item_groups(name)",
                              )
                              .eq("id", item.id)
                              .single();
                            // #region agent log
                            fetch(
                              "http://127.0.0.1:7815/ingest/b307b67c-0b91-415b-ba95-a48343d93232",
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  "X-Debug-Session-Id": "ddae03",
                                },
                                body: JSON.stringify({
                                  sessionId: "ddae03",
                                  runId: "pre-fix",
                                  hypothesisId: "H1_items_query_succeeds",
                                  location:
                                    "src/app/(dashboard)/inventory/page.tsx:181",
                                  message: "Inventory Edit load item result",
                                  data: {
                                    itemId: item.id,
                                    hasRow: !!row,
                                    errorMessage: error?.message ?? null,
                                  },
                                  timestamp: Date.now(),
                                }),
                              },
                            ).catch(() => {});
                            // #endregion
                            if (!row) return;
                            setEditInitial({
                              item_group_id: row.item_group_id,
                              item_group_name:
                                (row.item_groups as any)?.name ??
                                item.item_group_name,
                              bin_id: row.bin_id,
                              location_id: row.location_id ?? null,
                              quantity_on_hand: row.quantity_on_hand,
                              unit: row.unit ?? "pcs",
                              low_stock_threshold: row.low_stock_threshold,
                              notes: row.notes,
                            });
                            setEditItemId(item.id);
                          }}
                          className="rounded-xl border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showNewItem && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl md:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Add a new item</h2>
              <button
                onClick={() => setShowNewItem(false)}
                className="text-xs text-zinc-500 hover:text-zinc-800"
              >
                Close
              </button>
            </div>
            <ItemForm
              onCreated={async () => {
                setShowNewItem(false);
                const supabase = createSupabaseBrowserClient();
                const { data } = await supabase.from("v_items_with_status").select("*");
                setItems((data as ItemRow[]) ?? []);
              }}
            />
          </div>
        </div>
      )}

      {showBulkAdd && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-xl md:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Add multiple items
              </h2>
              <button
                onClick={() => setShowBulkAdd(false)}
                className="text-xs text-zinc-500 hover:text-zinc-800"
              >
                Close
              </button>
            </div>
            <BulkItemForm
              onCreated={async () => {
                setShowBulkAdd(false);
                const supabase = createSupabaseBrowserClient();
                const { data } =
                  await supabase.from("v_items_with_status").select("*");
                setItems((data as ItemRow[]) ?? []);
              }}
            />
          </div>
        </div>
      )}

      {editItemId && editInitial && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl md:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Edit item</h2>
              <button
                onClick={() => { setEditItemId(null); setEditInitial(null); }}
                className="text-xs text-zinc-500 hover:text-zinc-800"
              >
                Close
              </button>
            </div>
            <ItemForm
              mode="edit"
              itemId={editItemId}
              initialData={editInitial}
              onSaved={async () => {
                setEditItemId(null);
                setEditInitial(null);
                const supabase = createSupabaseBrowserClient();
                const { data } = await supabase.from("v_items_with_status").select("*");
                setItems((data as ItemRow[]) ?? []);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

