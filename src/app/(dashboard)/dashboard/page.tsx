import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseClient";
import { ActiveCheckoutsList } from "@/components/dashboard/ActiveCheckoutsList";
import { LostBrokenList } from "@/components/dashboard/LostBrokenList";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const nowIso = new Date().toISOString();
  const twoWeeksIso = new Date(
    Date.now() + 14 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    { data: lowStock },
    { data: activeRows },
    { data: issueCheckouts },
    { data: reservations },
    { data: expiringSoon },
    { data: clubRequests },
  ] = await Promise.all([
    supabase.from("v_low_stock_items").select("*").limit(5),
    supabase
      .from("checkouts")
      .select(
        "id, checkout_batch_id, borrower_name, club_name, event_name, notes, status, due_back_at",
      )
      .eq("status", "checked_out")
      .order("due_back_at", { ascending: true })
      .limit(5),
    supabase
      .from("checkouts")
      .select(
        "id, borrower_name, club_name, event_name, issue_type, issue_resolved, notes, items(item_groups(name)), bins(label)",
      )
      .not("issue_type", "is", null)
      .neq("event_name", "Used")
      .or("issue_resolved.is.null,issue_resolved.eq.false")
      .order("checked_out_at", { ascending: false })
      .limit(5),
    supabase
      .from("reservations")
      .select(
        "id, borrower_name, club_name, event_name, status, start_at, end_at, quantity, items(item_groups(name)), bins(label)",
      )
      .in("status", ["planned", "confirmed"])
      .gte("start_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(5),
    supabase
      .from("items")
      .select(
        "id, expiry_date, quantity_on_hand, unit, item_groups(name), bins(label, locations(name)), locations(name)",
      )
      .gte("expiry_date", nowIso)
      .lte("expiry_date", twoWeeksIso)
      .order("expiry_date", { ascending: true })
      .limit(5),
    supabase
      .from("club_requests")
      .select(
        "id, requester_name, club_name, custom_item_name, requested_quantity, status, pickup_at",
      )
      .in("status", ["open", "approved", "ordered"])
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const activeMap = new Map<
    string,
    { id: string; borrower_name: string; club_name: string | null; event_name: string | null; notes: string | null }
  >();

  (activeRows ?? []).forEach((row: any) => {
    const key = (row.checkout_batch_id as string | null) ?? (row.id as string);
    if (!activeMap.has(key)) {
      activeMap.set(key, {
        id: key,
        borrower_name: row.borrower_name as string,
        club_name: row.club_name as string | null,
        event_name: row.event_name as string | null,
        notes: (row.notes as string | null) ?? null,
      });
    }
  });

  const activeCheckouts = Array.from(activeMap.values());

  // #region agent log
  fetch("http://127.0.0.1:7815/ingest/b307b67c-0b91-415b-ba95-a48343d93232", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "ddae03",
    },
    body: JSON.stringify({
      sessionId: "ddae03",
      runId: "pre-fix",
      hypothesisId: "H-dashboard",
      location: "dashboard/page.tsx:loader",
      message: "Dashboard activeRows and grouped activeCheckouts",
      data: { activeRowCount: (activeRows as any[])?.length ?? 0, activeGroupCount: activeCheckouts.length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Closet overview
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Quick view of low stock, active checkouts, and storage health.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
          <p className="text-xs font-medium uppercase text-zinc-500">
            Low stock
          </p>
          <p className="mt-3 text-3xl font-semibold text-amber-600">
            {lowStock?.length ?? 0}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Items at or below threshold.
          </p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
          <p className="text-xs font-medium uppercase text-zinc-500">
            Active checkouts
          </p>
          <p className="mt-3 text-3xl font-semibold text-zinc-900">
            {activeCheckouts?.length ?? 0}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Bins and item groups out with clubs.
          </p>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-700 p-4 text-white shadow-sm">
          <p className="text-xs font-medium uppercase text-zinc-300">
            Quick actions
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <a
              href="/inventory"
              className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20"
            >
              View inventory
            </a>
            <a
              href="/checkout/new"
              className="rounded-full bg-white px-3 py-1 text-zinc-900 hover:bg-zinc-100"
            >
              New checkout
            </a>
            <a
              href="/scan"
              className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20"
            >
              Scan QR
            </a>
            <a
              href="/lost-report"
              className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20"
            >
              Report loss
            </a>
          </div>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Low stock items
            </h2>
            <a
              href="/inventory?filter=low-stock"
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              View all
            </a>
          </div>
          <div className="mt-3 space-y-2">
            {lowStock && lowStock.length > 0 ? (
              lowStock.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-medium text-amber-900">
                      {item.item_group_name}
                    </p>
                    <p className="text-[11px] text-amber-800">
                      {item.quantity_on_hand} {item.unit} in {item.bin_label} ·{" "}
                      {item.location_name}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                    Refill
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500">
                Everything looks well stocked.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Active checkouts
            </h2>
            <a
              href="/checkouts"
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              View log
            </a>
          </div>
          <div className="mt-3">
            <ActiveCheckoutsList initial={(activeCheckouts as any) ?? []} />
          </div>
        </div>
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            Expiring in next 2 weeks
          </h2>
        </div>
        <div className="mt-3 space-y-2 text-xs">
          {expiringSoon && (expiringSoon as any).length > 0 ? (
            (expiringSoon as any).map((item: any) => {
              const groupName = item.item_groups?.name ?? "Item";
              const binLabel = item.bins?.label ?? null;
              const locFromBin = item.bins?.locations?.name ?? null;
              const locDirect = item.locations?.name ?? null;
              const location = locDirect ?? locFromBin ?? "No location";
              const expiry =
                item.expiry_date &&
                new Date(item.expiry_date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                });
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2"
                >
                  <div>
                    <p className="text-[11px] font-medium text-rose-900">
                      {groupName}
                    </p>
                    <p className="text-[11px] text-rose-800">
                      {item.quantity_on_hand} {item.unit}
                      {binLabel && ` · ${binLabel}`}
                      {" · "}
                      {location}
                    </p>
                  </div>
                  <p className="text-[11px] font-medium text-rose-900">
                    {expiry ?? "Soon"}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-zinc-500">
              No items with expiry dates in the next two weeks.
            </p>
          )}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Lost / broken items
            </h2>
          </div>
          <div className="mt-3">
            <LostBrokenList initial={(issueCheckouts as any) ?? []} />
          </div>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Upcoming reservations
            </h2>
            <a
              href="/schedule"
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              View all
            </a>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            {reservations && (reservations as any).length > 0 ? (
              (reservations as any).map((r: any) => {
                const label =
                  r.items?.item_groups?.name ??
                  r.bins?.label ??
                  "Item or bin";
                const start =
                  r.start_at &&
                  new Date(r.start_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  });
                const end =
                  r.end_at &&
                  new Date(r.end_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  });
                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2"
                  >
                    <p className="text-[11px] font-medium text-zinc-900">
                      {label}
                      {r.quantity != null && ` · ${r.quantity}`}
                    </p>
                    <p className="text-[11px] text-zinc-700">
                      {r.borrower_name}
                      {r.club_name ? ` · ${r.club_name}` : ""}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {start && end
                        ? `${start} → ${end}`
                        : start
                        ? start
                        : "No dates set"}
                      {" · "}
                      {r.status}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-zinc-500">
                No upcoming reservations.
              </p>
            )}
          </div>
        </div>
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            Requested by clubs
          </h2>
          <a
            href="/clubs"
            className="text-xs text-zinc-500 hover:text-zinc-700"
          >
            View all
          </a>
        </div>
        <div className="mt-3 space-y-2 text-xs">
          {clubRequests && (clubRequests as any).length > 0 ? (
            (clubRequests as any).map((r: any) => {
              const pickup =
                r.pickup_at &&
                new Date(r.pickup_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                });
              const label = r.custom_item_name ?? "Requested items";
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2"
                >
                  <div>
                    <p className="text-[11px] font-medium text-zinc-900">
                      {label}
                    </p>
                    <p className="text-[11px] text-zinc-700">
                      {r.requester_name} · {r.club_name}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {r.requested_quantity} requested
                      {pickup ? ` · Pickup ${pickup}` : ""}
                    </p>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Status: {r.status}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-zinc-500">
              No open club requests right now.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

