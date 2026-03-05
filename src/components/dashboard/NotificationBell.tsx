"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type RequestRow = {
  id: string;
  requester_name: string;
  club_name: string;
  custom_item_name: string | null;
  status: string;
  pickup_at: string | null;
  seen: boolean;
};

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("club_requests")
        .select(
          "id, requester_name, club_name, custom_item_name, status, pickup_at, seen",
        )
        .in("status", ["open", "approved", "ordered"])
        .order("created_at", { ascending: false })
        .limit(10);
      const rows = (data as RequestRow[] | null) ?? [];
      setRequests(rows);
      setCount(rows.filter((r) => !r.seen).length);
    };
    load();
  }, []);

  const toggleOpen = () => setOpen((prev) => !prev);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
        aria-label="Club requests notifications"
      >
        <span className="text-lg leading-none">🔔</span>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-zinc-200 bg-white p-3 text-xs shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-zinc-900">
              Club requests
            </p>
            <Link
              href="/requests"
              className="text-[11px] text-zinc-500 hover:text-zinc-800"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {requests.length === 0 ? (
              <p className="text-[11px] text-zinc-500">
                No open requests from clubs.
              </p>
            ) : (
              requests.map((r) => {
                const pickup =
                  r.pickup_at &&
                  new Date(r.pickup_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  });
                return (
                  <Link
                    key={r.id}
                  href={`/requests?id=${r.id}`}
                    className="block rounded-2xl bg-zinc-50 px-2 py-1.5 hover:bg-zinc-100"
                  >
                    <p className="text-[11px] font-medium text-zinc-900">
                      {r.custom_item_name ?? "Requested items"}
                    </p>
                    <p className="text-[11px] text-zinc-600">
                      {r.requester_name} · {r.club_name}
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      {pickup ? `Pickup ${pickup}` : "Pickup date TBD"} ·{" "}
                      {r.status}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

