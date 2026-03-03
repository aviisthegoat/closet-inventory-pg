import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

export default async function MapPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: locations } = await supabase
    .from("locations")
    .select(
      "id, name, description, sort_order, photo_url, bins(id, label), items(id, quantity_on_hand, unit, item_groups(name))",
    )
    .order("sort_order", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Closet map
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            A simple visual layout of shelves and bins to mirror the real
            closet.
          </p>
        </div>
      </header>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
        {locations && locations.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {locations.map((loc: any) => (
              <div
                key={loc.id}
                id={loc.id}
                className="flex flex-col rounded-3xl border border-zinc-100 bg-gradient-to-br from-zinc-50 to-zinc-100 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {loc.name}
                    </p>
                    {loc.description && (
                      <p className="text-[11px] text-zinc-500">
                        {loc.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {loc.bins && loc.bins.length > 0 ? (
                    loc.bins.map((bin: any) => (
                      <a
                        key={bin.id}
                        href={`/bins/${bin.id}`}
                        className="inline-flex items-center rounded-2xl bg-white/90 px-3 py-1 text-[11px] font-medium text-zinc-800 shadow-sm ring-1 ring-zinc-200 hover:bg-white"
                      >
                        {bin.label}
                      </a>
                    ))
                  ) : (
                    <p className="text-[11px] text-zinc-400">
                      No bins assigned yet.
                    </p>
                  )}
                </div>
                {loc.items && loc.items.length > 0 && (
                  <div className="mt-3 space-y-1 text-[11px]">
                    <p className="font-medium text-zinc-600">
                      Items stored directly in this location
                    </p>
                    {loc.items.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-2xl bg-white/70 px-3 py-1 text-zinc-800"
                      >
                        <span>
                          {item.item_groups?.name ?? "Item"}
                        </span>
                        <span>
                          {item.quantity_on_hand} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            No locations defined yet. Add locations first from the{" "}
            <a href="/locations" className="underline">
              locations
            </a>{" "}
            page.
          </p>
        )}
      </div>
    </div>
  );
}

