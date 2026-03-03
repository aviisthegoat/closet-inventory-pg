"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { logActivity } from "@/lib/activityLogger";

type BinOption = { id: string; label: string; locationName: string | null };
type GroupOption = { id: string; name: string };
type LocationOption = { id: string; name: string };

type ItemFormProps = {
  defaultBinId?: string;
  defaultItemGroupId?: string;
  onCreated?: () => void;
  /** Edit mode: pass item id and initial data from the items table */
  mode?: "add" | "edit";
  itemId?: string;
  initialData?: {
    item_group_id: string;
    item_group_name: string;
    bin_id: string | null;
    location_id: string | null;
    quantity_on_hand: number;
    unit: string;
    low_stock_threshold: number | null;
    notes: string | null;
  };
  onSaved?: () => void;
};

export function ItemForm({
  defaultBinId,
  defaultItemGroupId,
  onCreated,
  mode = "add",
  itemId,
  initialData,
  onSaved,
}: ItemFormProps) {
  const [bins, setBins] = useState<BinOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [itemGroupId, setItemGroupId] = useState(defaultItemGroupId ?? "");
  const [newGroupName, setNewGroupName] = useState("");
  const [binId, setBinId] = useState(defaultBinId ?? "");
  const [locationId, setLocationId] = useState(initialData?.location_id ?? "");
  const [quantity, setQuantity] = useState(initialData?.quantity_on_hand ?? 1);
  const [unit, setUnit] = useState(initialData?.unit ?? "pcs");
  const [lowStockThreshold, setLowStockThreshold] = useState<number | "">(
    initialData?.low_stock_threshold ?? ""
  );
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowserClient();
      const [binsRes, groupsRes, locationsRes] = await Promise.all([
        supabase
          .from("bins")
          .select("id, label, locations(name)")
          .order("label", { ascending: true }),
        supabase
          .from("item_groups")
          .select("id, name")
          .order("name", { ascending: true }),
        supabase
          .from("locations")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);
      setBins(
        (binsRes.data ?? []).map((b: any) => ({
          id: b.id,
          label: b.label,
          locationName: b.locations?.name ?? null,
        }))
      );
      setGroups(
        (groupsRes.data ?? []).map((g: any) => ({ id: g.id, name: g.name })),
      );
      setLocations(
        (locationsRes.data ?? []).map((l: any) => ({
          id: l.id as string,
          name: l.name as string,
        })),
      );
    };
    load();
  }, []);

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setItemGroupId(initialData.item_group_id);
      setBinId(initialData.bin_id ?? "");
      setLocationId(initialData.location_id ?? "");
      setQuantity(initialData.quantity_on_hand);
      setUnit(initialData.unit);
      setLowStockThreshold(initialData.low_stock_threshold ?? "");
      setNotes(initialData.notes ?? "");
    } else if (defaultBinId) {
      setBinId(defaultBinId);
    }
    if (defaultItemGroupId) setItemGroupId(defaultItemGroupId);
  }, [mode, initialData, defaultBinId, defaultItemGroupId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    if (mode === "edit" && itemId) {
      let resolvedGroupId = itemGroupId;
      if (newGroupName.trim()) {
        const { data: existing } = await supabase
          .from("item_groups")
          .select("id")
          .ilike("name", newGroupName.trim())
          .maybeSingle();
        if (existing?.id) resolvedGroupId = existing.id;
        else {
          const { data: created, error: ge } = await supabase
            .from("item_groups")
            .insert({ name: newGroupName.trim() })
            .select("id")
            .single();
          if (ge || !created) {
            setError(ge?.message ?? "Could not create group");
            setSaving(false);
            return;
          }
          resolvedGroupId = created.id;
        }
      }
      const { error: updateErr } = await supabase
        .from("items")
        .update({
          item_group_id: resolvedGroupId,
          bin_id: binId || null,
          location_id: binId ? null : locationId || null,
          quantity_on_hand: quantity,
          unit,
          low_stock_threshold: lowStockThreshold === "" ? null : Number(lowStockThreshold),
          notes: notes || null,
        })
        .eq("id", itemId);
      if (updateErr) {
        setError(updateErr.message);
        setSaving(false);
        return;
      }

      await logActivity(supabase, {
        userId: null,
        action: "item_updated",
        entityType: "item",
        entityId: itemId,
        details: {
          item_group_id: resolvedGroupId,
          bin_id: binId || null,
          location_id: binId ? null : locationId || null,
          quantity_on_hand: quantity,
          unit,
        },
      });

      onSaved?.();
      setSaving(false);
      return;
    }

    // Add mode
    let resolvedGroupId = itemGroupId;
    const nameToUse = newGroupName.trim() || groups.find((g) => g.id === itemGroupId)?.name;
    if (!nameToUse) {
      setError("Pick an item type or enter a new one.");
      setSaving(false);
      return;
    }
    if (!itemGroupId || newGroupName.trim()) {
      const { data: existing } = await supabase
        .from("item_groups")
        .select("id")
        .ilike("name", nameToUse)
        .maybeSingle();
      if (existing?.id) resolvedGroupId = existing.id;
      else {
        const { data: created, error: ge } = await supabase
          .from("item_groups")
          .insert({ name: nameToUse })
          .select("id")
          .single();
        if (ge || !created) {
          setError(ge?.message ?? "Could not create item group");
          setSaving(false);
          return;
        }
        resolvedGroupId = created.id;
      }
    }

    const { data: createdItem, error: insertErr } = await supabase
      .from("items")
      .insert({
        item_group_id: resolvedGroupId,
        bin_id: binId || null,
        location_id: binId ? null : locationId || null,
        quantity_on_hand: quantity,
        unit,
        low_stock_threshold:
          lowStockThreshold === "" ? null : Number(lowStockThreshold),
        notes: notes || null,
      })
      .select("id")
      .single();
    if (insertErr || !createdItem) {
      setError(insertErr?.message ?? "Could not create item.");
      setSaving(false);
      return;
    }

    await logActivity(supabase, {
      userId: null,
      action: "item_created",
      entityType: "item",
      entityId: createdItem.id,
      details: {
        item_group_id: resolvedGroupId,
        bin_id: binId || null,
        location_id: binId ? null : locationId || null,
        quantity_on_hand: quantity,
        unit,
      },
    });
    setNewGroupName("");
    setItemGroupId("");
    setBinId(defaultBinId ?? "");
    setLocationId("");
    setQuantity(1);
    setUnit("pcs");
    setLowStockThreshold("");
    setNotes("");
    setSaving(false);
    onCreated?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-700">Item type</label>
        <select
          value={itemGroupId}
          onChange={(e) => setItemGroupId(e.target.value)}
          className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        >
          <option value="">— Choose or type below —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="Or type new type (e.g. Christmas lights)"
          className="mt-1 block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-700">Bin</label>
        <select
          value={binId}
          onChange={(e) => setBinId(e.target.value)}
          className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        >
          <option value="">No bin</option>
          {bins.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
              {b.locationName ? ` · ${b.locationName}` : ""}
            </option>
          ))}
        </select>
        {binId && (
          <p className="mt-1 text-[11px] text-zinc-500">
            Location is set by this bin:{" "}
            {bins.find((b) => b.id === binId)?.locationName ??
              "No location set for this bin"}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-700">
          Location (for items not in bins)
        </label>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          disabled={!!binId}
          className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200 disabled:opacity-50"
        >
          <option value="">No location</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {!binId && (
          <p className="mt-1 text-[11px] text-zinc-500">
            Use this if the item is stored loose on a shelf or zone without a
            bin.
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <div className="flex-1 space-y-1">
          <label className="block text-xs font-medium text-zinc-700">Quantity</label>
          <input
            type="number"
            min={0}
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
          />
        </div>
        <div className="w-24 space-y-1">
          <label className="block text-xs font-medium text-zinc-700">Unit</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-700">
          Low stock threshold (optional)
        </label>
        <input
          type="number"
          min={0}
          value={lowStockThreshold}
          onChange={(e) =>
            setLowStockThreshold(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-700">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? "Saving..." : mode === "edit" ? "Save changes" : "Add item"}
      </button>
    </form>
  );
}
