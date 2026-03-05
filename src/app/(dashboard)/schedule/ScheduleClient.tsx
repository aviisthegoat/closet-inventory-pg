"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export type ScheduleRow = {
  id: string;
  borrower_name: string;
  club_name: string | null;
  event_name: string | null;
  quantity: number | null;
  status: "planned" | "confirmed" | "cancelled" | "fulfilled";
  start_at: string | null;
  end_at: string | null;
  item_label: string;
};

type ViewMode = "date" | "club" | "item";

export function ScheduleClient({ initial }: { initial: ScheduleRow[] }) {
  const [view, setView] = useState<ViewMode>("date");
  const [rows, setRows] = useState<ScheduleRow[]>(initial ?? []);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (value: string | null) => {
    if (!value) return "No date";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "No date";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const groupBy = (keyFn: (row: ScheduleRow) => string) => {
    const map = new Map<string, ScheduleRow[]>();
    rows.forEach((r) => {
      const key = keyFn(r);
      const list = map.get(key);
      if (list) {
        list.push(r);
      } else {
        map.set(key, [r]);
      }
    });
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
  };

  let grouped: [string, ScheduleRow[]][];
  if (view === "club") {
    grouped = groupBy((r) => r.club_name || "No club");
  } else if (view === "item") {
    grouped = groupBy((r) => r.item_label);
  } else {
    grouped = groupBy((r) => formatDate(r.start_at));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Schedule
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Internal booking calendar for clubs: who has reserved what, and when.
          </p>
        </div>
        <a
          href="/schedule/new"
          className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
        >
          + New reservation
        </a>
        <div className="flex gap-1 rounded-2xl bg-zinc-100 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setView("date")}
            className={`rounded-2xl px-3 py-1.5 ${
              view === "date" ? "bg-white shadow-sm text-zinc-900" : ""
            }`}
          >
            By date
          </button>
          <button
            type="button"
            onClick={() => setView("club")}
            className={`rounded-2xl px-3 py-1.5 ${
              view === "club" ? "bg-white shadow-sm text-zinc-900" : ""
            }`}
          >
            By club
          </button>
          <button
            type="button"
            onClick={() => setView("item")}
            className={`rounded-2xl px-3 py-1.5 ${
              view === "item" ? "bg-white shadow-sm text-zinc-900" : ""
            }`}
          >
            By item
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-zinc-500">
          No reservations recorded yet.
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([groupLabel, groupRows]) => (
            <section key={groupLabel} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {groupLabel}
              </h2>
              <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-100">
                <table className="min-w-full divide-y divide-zinc-100 text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Item / Bin
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Club / Borrower
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        When
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Status
                      </th>
                      <th className="px-4 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {groupRows.map((r) => {
                      const start = r.start_at
                        ? formatDate(r.start_at)
                        : null;
                      const end = r.end_at
                        ? formatDate(r.end_at)
                        : null;
                      return (
                        <tr key={r.id} className="hover:bg-zinc-50/80">
                          <td className="px-4 py-2 text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium text-zinc-900">
                                {r.item_label}
                              </span>
                              {r.quantity != null && (
                                <span className="text-[11px] text-zinc-500">
                                  {r.quantity}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium text-zinc-900">
                                {r.borrower_name}
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                {r.club_name || "No club specified"}
                              </span>
                              {r.event_name && (
                                <span className="text-[11px] text-zinc-400">
                                  {r.event_name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <div className="flex flex-col text-[11px] text-zinc-600">
                              {start && <span>From: {start}</span>}
                              {end && <span>To: {end}</span>}
                              {!start && !end && (
                                <span className="text-zinc-400">
                                  No dates set
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                r.status === "planned"
                                  ? "bg-sky-100 text-sky-800"
                                  : r.status === "confirmed"
                                  ? "bg-indigo-100 text-indigo-800"
                                  : r.status === "fulfilled"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-zinc-100 text-zinc-700"
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-sm">
                            <button
                              type="button"
                              onClick={() => setEditing(r)}
                              className="rounded-2xl border border-zinc-200 px-3 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <EditReservationModal
          row={editing}
          saving={saving}
          deleting={deleting}
          onClose={() => setEditing(null)}
          onSave={async (updates) => {
            setSaving(true);
            setError(null);
            const supabase = createSupabaseBrowserClient();
            try {
              const { error: updateError } = await supabase
                .from("reservations")
                .update({
                  borrower_name: updates.borrower_name,
                  club_name: updates.club_name,
                  event_name: updates.event_name,
                  quantity: updates.quantity,
                  status: updates.status,
                  start_at: updates.start_at,
                  end_at: updates.end_at,
                })
                .eq("id", editing.id);
              if (updateError) throw updateError;
              setRows((prev) =>
                prev.map((r) =>
                  r.id === editing.id ? { ...r, ...updates } : r,
                ),
              );
              setEditing(null);
            } catch (e: any) {
              setError(
                e?.message ?? "Could not save changes to this reservation.",
              );
            } finally {
              setSaving(false);
            }
          }}
          onDelete={async () => {
            setDeleting(true);
            setError(null);
            const supabase = createSupabaseBrowserClient();
            try {
              const { error: delError } = await supabase
                .from("reservations")
                .delete()
                .eq("id", editing.id);
              if (delError) throw delError;
              setRows((prev) => prev.filter((r) => r.id !== editing.id));
              setEditing(null);
            } catch (e: any) {
              setError(
                e?.message ?? "Could not delete this reservation.",
              );
            } finally {
              setDeleting(false);
            }
          }}
        />
      )}
    </div>
  );
}

type EditReservationModalProps = {
  row: ScheduleRow;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: (updates: ScheduleRow) => Promise<void>;
  onDelete: () => Promise<void>;
};

function EditReservationModal({
  row,
  saving,
  deleting,
  onClose,
  onSave,
  onDelete,
}: EditReservationModalProps) {
  const [form, setForm] = useState<ScheduleRow>(row);

  const setField = <K extends keyof ScheduleRow>(key: K, value: ScheduleRow[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toLocalInput = (value: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  const fromLocalInput = (value: string) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-4 shadow-xl ring-1 ring-zinc-100">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            Edit reservation
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
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-zinc-700">
              Borrower name
            </label>
            <input
              type="text"
              value={form.borrower_name}
              onChange={(e) => setField("borrower_name", e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Club
              </label>
              <input
                type="text"
                value={form.club_name ?? ""}
                onChange={(e) => setField("club_name", e.target.value || null)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Event (optional)
              </label>
              <input
                type="text"
                value={form.event_name ?? ""}
                onChange={(e) =>
                  setField("event_name", e.target.value || null)
                }
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Start
              </label>
              <input
                type="datetime-local"
                value={toLocalInput(form.start_at)}
                onChange={(e) =>
                  setField("start_at", fromLocalInput(e.target.value))
                }
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                End (optional)
              </label>
              <input
                type="datetime-local"
                value={toLocalInput(form.end_at)}
                onChange={(e) =>
                  setField("end_at", fromLocalInput(e.target.value))
                }
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
              />
            </div>
          </div>
          {form.quantity != null && (
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-zinc-700">
                Quantity
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.quantity}
                onChange={(e) =>
                  setField(
                    "quantity",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-zinc-700">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setField(
                  "status",
                  e.target.value as ScheduleRow["status"],
                )
              }
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
            >
              <option value="planned">planned</option>
              <option value="confirmed">confirmed</option>
              <option value="fulfilled">fulfilled</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onDelete}
            disabled={saving || deleting}
            className="text-[11px] text-rose-600 hover:text-rose-700 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete reservation"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="rounded-2xl border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(form)}
              disabled={saving || deleting}
              className="rounded-2xl bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


