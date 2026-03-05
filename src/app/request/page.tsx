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
  price: number;
};

export default function PublicRequestPage() {
  const [items, setItems] = useState<PublicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [existingLines, setExistingLines] = useState<RequestLine[]>([]);
  const [newLines, setNewLines] = useState<NewItemLine[]>([
    { name: "", quantity: 1, productUrl: "", price: 0 },
  ]);
  const [isFoodOrder, setIsFoodOrder] = useState(false);
  const [foodLines, setFoodLines] = useState<NewItemLine[]>([
    { name: "", quantity: 1, productUrl: "", price: 0 },
  ]);
  const [requesterName, setRequesterName] = useState("");
  const [clubName, setClubName] = useState("");
  const [level, setLevel] = useState<"UG" | "PG" | "">("");
  const [willCollectSelf, setWillCollectSelf] = useState(true);
  const [collectorName, setCollectorName] = useState("");
  const [collectorEmail, setCollectorEmail] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropoffTime, setDropoffTime] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryPlace, setDeliveryPlace] = useState("");
  const [responsibility, setResponsibility] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const allNewLinesForTotal = [
    ...newLines,
    ...(isFoodOrder ? foodLines : []),
  ];
  const estimatedNewItemsTotal = allNewLinesForTotal.reduce((sum, line) => {
    if (
      !line.name.trim() ||
      !line.productUrl.trim() ||
      !line.quantity ||
      !line.price
    ) {
      return sum;
    }
    return sum + line.price * line.quantity;
  }, 0);

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
    setNewLines((prev) => [
      ...prev,
      { name: "", quantity: 1, productUrl: "", price: 0 },
    ]);
  };

  const removeNewLine = (index: number) => {
    setNewLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFoodLine = (index: number, patch: Partial<NewItemLine>) => {
    setFoodLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addFoodLine = () => {
    setFoodLines((prev) => [
      ...prev,
      { name: "", quantity: 1, productUrl: "", price: 0 },
    ]);
  };

  const removeFoodLine = (index: number) => {
    setFoodLines((prev) => prev.filter((_, i) => i !== index));
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

    // Budget check for new items we don't own yet (including food/beverage orders)
    const allNewLines = [
      ...newLines,
      ...(isFoodOrder ? foodLines : []),
    ];
    const activeNewLines = allNewLines.filter(
      (line) => line.name.trim() && line.quantity > 0 && line.productUrl.trim(),
    );
    for (const line of activeNewLines) {
      if (!line.price || line.price <= 0) {
        setError(
          "Please enter an estimated price for each new item you want us to order.",
        );
        return;
      }
    }
    const totalNewCost = activeNewLines.reduce(
      (sum, line) => sum + line.price * line.quantity,
      0,
    );
    if (totalNewCost > 150) {
      setError(
        `We typically fund new items when the estimated total is around $150 or less. Your current total is approximately $${totalNewCost.toFixed(
          2,
        )}. For larger budgets, please email rachel.rowe@hult.edu or emilie.bader@hult.edu to enquire about pitching to the Funding Committee.`,
      );
      return;
    }

    const hasFoodLines =
      isFoodOrder &&
      foodLines.some(
        (line) => line.name.trim() && line.quantity > 0 && line.productUrl.trim(),
      );
    if (hasFoodLines) {
      if (!deliveryDate || !deliveryTime || !deliveryPlace.trim()) {
        setError(
          "Please enter delivery date, time, and place for food or beverage orders.",
        );
        return;
      }
    }

    setSaving(true);

    const supabase = createSupabaseBrowserClient();
    const pickupAt = new Date(`${pickupDate}T${pickupTime}:00`).toISOString();
    const dropoffAt = dropoffTime
      ? new Date(`${pickupDate}T${dropoffTime}:00`).toISOString()
      : null;

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
          dropoff_at: dropoffAt,
          responsibility_confirmed: responsibility,
          status: "open",
        });
      }
    });

    // New items to order
    const pushNewItemRow = (line: NewItemLine, isFood: boolean) => {
      if (!line.name.trim() || line.quantity <= 0 || !line.productUrl.trim())
        return;
      const deliveryDetails =
        isFood && deliveryDate && deliveryTime && deliveryPlace.trim()
          ? `Food/beverage delivery at ${deliveryPlace.trim()} on ${deliveryDate} at ${deliveryTime}`
          : null;
      clubRequestRows.push({
        item_id: null,
        custom_item_name: line.name.trim(),
        requested_quantity: line.quantity,
        product_url: line.productUrl.trim(),
        estimated_unit_price: line.price,
        requester_name: requesterName.trim(),
        club_name: clubName.trim(),
        level: level || null,
        will_collect_self: willCollectSelf,
        collector_name: willCollectSelf ? null : collectorName || null,
        collector_email: willCollectSelf ? null : collectorEmail || null,
        pickup_at: pickupAt,
        dropoff_at: dropoffAt,
        delivery_details: deliveryDetails,
        responsibility_confirmed: responsibility,
        status: "open",
      });
    };

    newLines.forEach((line) => pushNewItemRow(line, false));
    if (isFoodOrder) {
      foodLines.forEach((line) => pushNewItemRow(line, true));
    }

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
      setNewLines([{ name: "", quantity: 1, productUrl: "", price: 0 }]);
      setRequesterName("");
      setClubName("");
      setLevel("");
      setWillCollectSelf(true);
      setCollectorName("");
      setCollectorEmail("");
      setPickupDate("");
      setPickupTime("");
      setDropoffTime("");
       setDeliveryDate("");
       setDeliveryTime("");
       setDeliveryPlace("");
       setIsFoodOrder(false);
       setFoodLines([{ name: "", quantity: 1, productUrl: "", price: 0 }]);
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
            Start by choosing items from our existing closet if you need them. If
            you only need things we don&apos;t currently own, you can skip this
            list and just use &quot;New items to order&quot; below.
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
                <button
                  type="button"
                  onClick={() => removeExistingLine(index)}
                  className="rounded-xl border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100"
                >
                  Remove
                </button>
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
          <p className="text-[11px] text-zinc-500">
            For items we don&apos;t already own, we&apos;ll do our best but{" "}
            <span className="font-medium">
              ordering is not guaranteed and the total budget for new items is
              capped at $150 per request
            </span>
            .
          </p>
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
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-zinc-500">$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={line.price || ""}
                      onChange={(e) =>
                        updateNewLine(index, {
                          price:
                            e.target.value === ""
                              ? 0
                              : Number(e.target.value) || 0,
                        })
                      }
                      placeholder="Unit cost"
                      className="w-24 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                    />
                  </div>
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

        <div className="space-y-2 pt-2">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={isFoodOrder}
              onChange={(e) => setIsFoodOrder(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
            />
            Are you ordering food or beverages?
          </label>
          {isFoodOrder && (
            <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
              <p className="text-[11px] text-amber-900">
                Use this for pizzas, snacks, drinks, catering, etc. We&apos;ll do
                our best, but ordering is not guaranteed and the total budget for
                new items is still capped at $150 per request.
              </p>
              <div className="space-y-2">
                {foodLines.map((line, index) => (
                  <div
                    key={index}
                    className="space-y-1 rounded-2xl border border-amber-100 bg-white p-2 text-xs"
                  >
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={line.name}
                        onChange={(e) =>
                          updateFoodLine(index, { name: e.target.value })
                        }
                        placeholder="Food or drink (e.g. Large cheese pizza)"
                        className="min-w-[160px] flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs"
                      />
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateFoodLine(index, {
                            quantity: Number(e.target.value) || 1,
                          })
                        }
                        placeholder="Qty"
                        className="w-20 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-zinc-500">$</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.price || ""}
                          onChange={(e) =>
                            updateFoodLine(index, {
                              price:
                                e.target.value === ""
                                  ? 0
                                  : Number(e.target.value) || 0,
                            })
                          }
                          placeholder="Unit cost"
                          className="w-24 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                    <input
                      value={line.productUrl}
                      onChange={(e) =>
                        updateFoodLine(index, { productUrl: e.target.value })
                      }
                      placeholder="Link to the exact food/drink you want us to order"
                      className="mt-1 block w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs"
                    />
                    {foodLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFoodLine(index)}
                        className="mt-1 text-[11px] text-zinc-500 hover:text-zinc-800"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFoodLine}
                  className="rounded-xl border border-amber-200 bg-white px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-50"
                >
                  + Add food / beverage item
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-zinc-700">
                    Delivery date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-zinc-700">
                    Delivery time
                  </label>
                  <input
                    type="time"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-zinc-700">
                    Delivery place
                  </label>
                  <input
                    type="text"
                    value={deliveryPlace}
                    onChange={(e) => setDeliveryPlace(e.target.value)}
                    placeholder="e.g. Campus cafeteria, Event hall"
                    className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {estimatedNewItemsTotal > 0 && (
          <p className="text-[11px] font-medium text-zinc-800">
            Estimated total for new items (including any food / beverages): $
            {estimatedNewItemsTotal.toFixed(2)}
          </p>
        )}

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
            Pickup / drop-off details
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
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">
                Expected drop-off time (optional)
              </label>
              <input
                type="time"
                value={dropoffTime}
                onChange={(e) => setDropoffTime(e.target.value)}
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

