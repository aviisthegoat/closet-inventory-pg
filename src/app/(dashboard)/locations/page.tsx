"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { logActivity } from "@/lib/activityLogger";

type BinItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
};

type BinWithContents = {
  id: string;
  label: string;
  notes: string | null;
  contents: BinItem[];
};

type LocationRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  photo_url: string | null;
};

type LocationWithBins = LocationRow & {
  bins: BinWithContents[];
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationWithBins[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingLocation, setEditingLocation] = useState<LocationWithBins | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadLocations = async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    const [{ data: locationRows }, { data: binRows }, { data: itemRows }] =
      await Promise.all([
        supabase
          .from("locations")
          .select("id, name, description, sort_order, photo_url")
          .order("sort_order", { ascending: true, nullsFirst: true })
          .order("name", { ascending: true }),
        supabase
          .from("bins")
          .select("id, label, notes, location_id")
          .order("label", { ascending: true }),
        supabase
          .from("items")
          .select("id, quantity_on_hand, unit, bin_id, item_groups(name)"),
      ]);

    const itemsByBin = new Map<string, BinItem[]>();
    (itemRows ?? []).forEach((row: any) => {
      if (!row.bin_id) return;
      const quantityRaw = row.quantity_on_hand;
      const quantity =
        typeof quantityRaw === "number"
          ? quantityRaw
          : Number(quantityRaw ?? 0);
      const entry: BinItem = {
        id: row.id as string,
        name: (row.item_groups?.name as string) ?? "Item",
        quantity,
        unit: (row.unit as string | null) ?? "pcs",
      };
      const existing = itemsByBin.get(row.bin_id as string) ?? [];
      existing.push(entry);
      itemsByBin.set(row.bin_id as string, existing);
    });

    const binsByLocation = new Map<string, BinWithContents[]>();
    (binRows ?? []).forEach((row: any) => {
      if (!row.location_id) return;
      const bin: BinWithContents = {
        id: row.id as string,
        label: row.label as string,
        notes: (row.notes as string | null) ?? null,
        contents: itemsByBin.get(row.id as string) ?? [],
      };
      const existing = binsByLocation.get(row.location_id as string) ?? [];
      existing.push(bin);
      binsByLocation.set(row.location_id as string, existing);
    });

    const withBins: LocationWithBins[] =
      (locationRows as LocationRow[] | null | undefined)?.map((loc) => ({
        ...loc,
        bins: binsByLocation.get(loc.id) ?? [],
      })) ?? [];

    setLocations(withBins);
    setLoading(false);
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const beginEditLocation = (loc: LocationWithBins) => {
    setEditingLocation(loc);
    setEditName(loc.name);
    setEditDescription(loc.description ?? "");
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation) return;
    setSavingEdit(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("locations")
      .update({
        name: editName,
        description: editDescription || null,
      })
      .eq("id", editingLocation.id);

    if (!error) {
      await logActivity(supabase, {
        userId: null,
        action: "location_updated",
        entityType: "location",
        entityId: editingLocation.id,
        details: { name: editName, description: editDescription || null },
      });
    }

    setSavingEdit(false);
    setEditingLocation(null);
    setEditName("");
    setEditDescription("");
    await loadLocations();
  };

  const handleDeleteLocation = async () => {
    if (!editingLocation) return;
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(
      "Delete this location? Bins will stay in the system but lose their location.",
    );
    if (!confirmed) return;

    setSavingEdit(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.from("locations").delete().eq("id", editingLocation.id);

    await logActivity(supabase, {
      userId: null,
      action: "location_deleted",
      entityType: "location",
      entityId: editingLocation.id,
      details: { name: editingLocation.name },
    });

    setSavingEdit(false);
    setEditingLocation(null);
    setEditName("");
    setEditDescription("");
    await loadLocations();
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const { data: created, error } = await supabase
      .from("locations")
      .insert({
        name,
        description: description || null,
      })
      .select("id")
      .single();

    if (!error && created?.id) {
      await logActivity(supabase, {
        userId: null,
        action: "location_created",
        entityType: "location",
        entityId: created.id,
        details: { name, description: description || null },
      });
    }
    setName("");
    setDescription("");
    await loadLocations();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Closet map locations
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Define shelves, zones, and floor areas to power the visual map.
        </p>
      </header>

      <form
        onSubmit={handleAddLocation}
        className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 md:flex-row"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Location name (e.g. Shelf A, Floor back-left)"
          className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
        />
        <button
          type="submit"
          className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 md:self-center"
        >
          + Add location
        </button>
      </form>

      <div className="grid gap-3 md:grid-cols-3">
        {loading ? (
          <p className="text-xs text-zinc-500">Loading locations…</p>
        ) : locations.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No locations yet. Start by adding main shelves and floor zones.
          </p>
        ) : (
          locations.map((loc) => (
            <div
              key={loc.id}
              className="flex flex-col rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100"
            >
              <div className="flex items-start justify-between gap-3">
                {loc.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={loc.photo_url}
                    alt={loc.name}
                    className="h-14 w-14 rounded-2xl object-cover"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {loc.name}
                  </p>
                  {loc.description && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {loc.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <a
                    href={`/map#${loc.id}`}
                    className="shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-zinc-800"
                  >
                    Open location
                  </a>
                  <button
                    type="button"
                    onClick={() => beginEditLocation(loc)}
                    className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {loc.bins.length === 0 ? (
                  <p className="text-xs text-zinc-400">
                    No bins assigned to this location yet.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      Bins in this location
                    </p>
                    {loc.bins.map((bin) => (
                      <div
                        key={bin.id}
                        className="rounded-2xl bg-zinc-50 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-zinc-900">
                              {bin.label}
                            </p>
                            {bin.notes && (
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
                                {bin.notes}
                              </p>
                            )}
                          </div>
                          <a
                            href={`/bins/${bin.id}`}
                            className="shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-zinc-800"
                          >
                            Open
                          </a>
                        </div>
                        {bin.contents.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            {bin.contents.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-[11px] text-zinc-600"
                              >
                                <span>{item.name}</span>
                                <span>
                                  {item.quantity} {item.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-[11px] text-zinc-400">
                            No items logged in this bin yet.
                          </p>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {editingLocation && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl md:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Edit location
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (savingEdit) return;
                  setEditingLocation(null);
                  setEditName("");
                  setEditDescription("");
                }}
                className="text-xs text-zinc-500 hover:text-zinc-800"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleUpdateLocation} className="space-y-3 text-sm">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="block w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleDeleteLocation}
                  disabled={savingEdit}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  Delete location
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={() => {
                      setEditingLocation(null);
                      setEditName("");
                      setEditDescription("");
                    }}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="rounded-2xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {savingEdit ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

