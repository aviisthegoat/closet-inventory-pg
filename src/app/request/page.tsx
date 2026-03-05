"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type PublicItem = {
  id: string;
  name: string;
  quantity_on_hand: number;
  low_stock_threshold: number | null;
};

type RequestLine = {
  itemId: string;
  quantity: number;
};

type NewItemLine = {
  name: string;
  quantity: number;
  productUrl: string;
};

export default function PublicRequestPage() {
  const [items, setItems] = useState<PublicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [existingLines, setExistingLines] = useState<RequestLine[]>([]);
  const [newLines, setNewLines] = useState<NewItemLine[]>([
    { name: "", quantity: 1, productUrl: "" },
  ]);
  const [requesterName, setRequesterName] = useState("");
  const [clubName, setClubName] = useState("");
  const [level, setLevel] = useState<"UG" | "PG" | "">("");
  const [willCollectSelf, setWillCollectSelf] = useState(true);
  const [collectorName, setCollectorName] = useState("");
  const [collectorEmail, setCollectorEmail] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [responsibility, setResponsibility] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("items")
        .select(
          "id, quantity_on_hand, low_stock_threshold, unit, item_groups(name), bins(label, locations(name)), locations(name)",
        );
      const rows = (data as any[] | null) ?? [];

      // Filter out items that have any planned/confirmed reservation
      const { data: reserved } = await supabase
        .from("reservations")
        .select("item_id")
        .in("status", ["planned", "confirmed"]);
      const reservedIds = new Set(
        ((reserved as any[] | null) ?? [])
          .map((r) => r.item_id)
          .filter(Boolean) as string[],
      );

      const available: PublicItem[] = rows
        .filter((row) => row.quantity_on_hand > 0 && !reservedIds.has(row.id))
        .map((row) => ({
          id: row.id as string,
          name: (row.item_groups?.name as string) ?? "Item",
          quantity_on_hand: Number(row.quantity_on_hand) || 0,
          low_stock_threshold:
            row.low_stock_threshold !== null
              ? Number(row.low_stock_threshold)
              : null,
        }));

      setItems(available);
      if (available.length > 0) {
        setExistingLines([{ itemId: available[0].id, quantity: 1 }]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const updateExistingLine = (index: number, patch: Partial<RequestLine>) => {
    setExistingLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addExistingLine = () => {
    if (items.length === 0) return;
    setExistingLines((prev) => [
      ...prev,
      { itemId: items[0].id, quantity: 1 },
    ]);
  };

  const removeExistingLine = (index: number) => {
    setExistingLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateNewLine = (index: number, patch: Partial<NewItemLine>) => {
    setNewLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addNewLine = () => {
    setNewLines((prev) => [...prev, { name: "", quantity: 1, productUrl: "" }]);
  };

  const removeNewLine = (index: number) => {
    setNewLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!requesterName.trim() || !clubName.trim()) {
      setError("Please enter your name and club.");
      return;
    }
    if (!pickupDate || !pickupTime) {
      setError("Please choose a pickup date and time.");
      return;
    }
    if (!responsibility) {
      setError(
        "You must confirm responsibility for the equipment to submit this request.",
      );
      return;
    }

    setSaving(true);

    const supabase = createSupabaseBrowserClient();
    const pickupAt = new Date(`${pickupDate}T${pickupTime}:00`).toISOString();

    const itemsById = new Map(items.map((i) => [i.id, i]));

    const clubRequestRows: any[] = [];
    const reservationRows: any[] = [];

    // Existing items
    existingLines.forEach((line) => {
      const item = itemsById.get(line.itemId);
      if (!item || line.quantity <= 0) return;

      const available = item.quantity_on_hand;
      const requested = line.quantity;

      if (available > 0) {
        const reservedQty = Math.min(requested, available);
        reservationRows.push({
          item_id: item.id,
          bin_id: null,
          borrower_name: requesterName.trim(),
          club_name: clubName.trim(),
          event_name: null,
          quantity: reservedQty,
          start_at: pickupAt,
          end_at: null,
          status: "planned",
          notes: notes || null,
        });
      }

      if (requested > available) {
        const shortfall = requested - available;
        clubRequestRows.push({
          item_id: item.id,
          custom_item_name: null,
          requested_quantity: shortfall,
          product_url: null,
          requester_name: requesterName.trim(),
          club_name: clubName.trim(),
          level: level || null,
          will_collect_self: willCollectSelf,
          collector_name: willCollectSelf ? null : collectorName || null,
          collector_email: willCollectSelf ? null : collectorEmail || null,
          pickup_at: pickupAt,
          responsibility_confirmed: responsibility,
          status: "open",
        });
      }
    });

    // New items to order
    newLines.forEach((line) => {
      if (!line.name.trim() || line.quantity <= 0 || !line.productUrl.trim())
        return;
      clubRequestRows.push({
        item_id: null,
        custom_item_name: line.name.trim(),
        requested_quantity: line.quantity,
        product_url: line.productUrl.trim(),
        requester_name: requesterName.trim(),
        club_name: clubName.trim(),
        level: level || null,
        will_collect_self: willCollectSelf,
        collector_name: willCollectSelf ? null : collectorName || null,
        collector_email: willCollectSelf ? null : collectorEmail || null,
        pickup_at: pickupAt,
        responsibility_confirmed: responsibility,
        status: "open",
      });
    });

    try {
      if (reservationRows.length > 0) {
        const { error: resErr } = await supabase
          .from("reservations")
          .insert(reservationRows);
        if (resErr) throw resErr;
      }

      if (clubRequestRows.length > 0) {
        const { error: reqErr } = await supabase
          .from("club_requests")
          .insert(clubRequestRows);
        if (reqErr) throw reqErr;
      }

      setSuccess(true);
      setSaving(false);
      // Reset minimal fields, keep items list loaded
      setExistingLines(items.length ? [{ itemId: items[0].id, quantity: 1 }] : []);
      setNewLines([{ name: "", quantity: 1, productUrl: "" }]);
      setRequesterName("");
      setClubName("");
      setLevel("");
      setWillCollectSelf(true);
      setCollectorName("");
      setCollectorEmail("");
      setPickupDate("");
      setPickupTime("");
      setResponsibility(false);
      setNotes("");
    } catch (err: any) {
      setSaving(false);
      setError(err?.message ?? "Something went wrong submitting your request.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Request items from the closet
        </h1>
        <p className="text-sm text-zinc-500">
          Tell us what your club needs and when you&apos;ll pick it up. We&apos;ll
          confirm what we can set aside and what we need to order.
        </p>
      </header>

      <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-900">
          1. Choose items
        </h2>
        <p className="text-[11px] text-zinc-500">
          Start with items we already have in the closet. We only show items
          that are currently available to borrow.
        </p>
        {loading ? (
          <p className="text-xs text-zinc-500">Loading available items…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Nothing is currently available to request.
          </p>
        ) : null}
      </section>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100"
      >
        {error && (
          <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Request submitted! We&apos;ll review and follow up.
          </p>
        )}

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            2. What would you like to request?
          </h2>
          <p className="text-[11px] text-zinc-500">
            Choose items from the list below. If you need something we don&apos;t
            currently own, add it under &quot;New items to order&quot; with a
            link.
          </p>
          <div className="space-y-2">
            {existingLines.map((line, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-2"
              >
                <select
                  value={line.itemId}
                  onChange={(e) =>
                    updateExistingLine(index, { itemId: e.target.value })
                  }
                  className="min-w-[200px] flex-1 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) =>
                    updateExistingLine(index, {
                      quantity: Number(e.target.value) || 1,
                    })
                  }
                  className="w-20 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                />
                {existingLines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExistingLine(index)}
                    className="rounded-xl border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {items.length > 0 && (
              <button
                type="button"
                onClick={addExistingLine}
                className="rounded-xl border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
              >
                + Add another existing item
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-900">
            Request new items (we don&apos;t have these yet)
          </h3>
          <div className="space-y-2">
            {newLines.map((line, index) => (
              <div
                key={index}
                className="space-y-1 rounded-2xl border border-zinc-200 bg-zinc-50 p-2 text-xs"
              >
                <div className="flex flex-wrap gap-2">
                  <input
                    value={line.name}
                    onChange={(e) =>
                      updateNewLine(index, { name: e.target.value })
                    }
                    placeholder="Item name"
                    className="min-w-[160px] flex-1 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      updateNewLine(index, {
                        quantity: Number(e.target.value) || 1,
                      })
                    }
                    placeholder="Qty"
                    className="w-20 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                  />
                </div>
                <input
                  value={line.productUrl}
                  onChange={(e) =>
                    updateNewLine(index, { productUrl: e.target.value })
                  }
                  placeholder="Link to the exact product you want us to order"
                  className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                />
                {newLines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeNewLine(index)}
                    className="mt-1 text-[11px] text-zinc-500 hover:text-zinc-800"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addNewLine}
            className="rounded-xl border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            + Add new item to order
          </button>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Who is requesting?
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">
                Your name
              </label>
              <input
                type="text"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">
                Club
              </label>
              <input
                type="text"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              Program / degree
            </label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setLevel("UG")}
                className={`flex-1 rounded-2xl border px-3 py-1.5 ${
                  level === "UG"
                    ? "border-sky-500 bg-sky-50 text-sky-800"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700"
                }`}
              >
                UG
              </button>
              <button
                type="button"
                onClick={() => setLevel("PG")}
                className={`flex-1 rounded-2xl border px-3 py-1.5 ${
                  level === "PG"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700"
                }`}
              >
                PG
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Pickup details
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">
                Pickup date
              </label>
              <input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">
                Pickup time
              </label>
              <input
                type="time"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            Who will collect the items?
          </h2>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setWillCollectSelf(true)}
              className={`flex-1 rounded-2xl border px-3 py-1.5 ${
                willCollectSelf
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700"
              }`}
            >
              I will collect
            </button>
            <button
              type="button"
              onClick={() => setWillCollectSelf(false)}
              className={`flex-1 rounded-2xl border px-3 py-1.5 ${
                !willCollectSelf
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700"
              }`}
            >
              Someone else will collect
            </button>
          </div>
          {!willCollectSelf && (
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Collector name
                </label>
                <input
                  type="text"
                  value={collectorName}
                  onChange={(e) => setCollectorName(e.target.value)}
                  className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Collector email
                </label>
                <input
                  type="email"
                  value={collectorEmail}
                  onChange={(e) => setCollectorEmail(e.target.value)}
                  className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-zinc-700">
            Notes for the closet team (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
          />
        </div>

        <div className="space-y-2 rounded-2xl bg-zinc-50 px-3 py-2 text-[11px] text-zinc-700">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={responsibility}
              onChange={(e) => setResponsibility(e.target.checked)}
            />
            <span>
              I understand our club and the person collecting will be
              responsible for all items and will return them in the same
              condition.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "Submitting..." : "Submit request"}
        </button>
      </form>
    </div>
  );
}

