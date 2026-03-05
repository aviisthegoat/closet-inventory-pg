import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/getUserProfile";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/bins", label: "Bins" },
  { href: "/locations", label: "Closet map" },
  { href: "/checkouts", label: "Checkouts" },
  { href: "/schedule", label: "Schedule" },
  { href: "/lost-report", label: "Report loss" },
  { href: "/logs", label: "Activity" },
];

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, profile } = await getCurrentUserProfile();

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase() || (user?.email?.[0]?.toUpperCase() ?? "T");

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      <aside className="hidden w-64 flex-col border-r border-zinc-200 bg-white/80 px-5 py-6 backdrop-blur md:flex">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-900 text-xs font-semibold uppercase text-white">
            CI
          </div>
          <div>
            <p className="text-sm font-semibold">Closet Inventory Management</p>
            <p className="text-xs text-zinc-500">Storage room dashboard</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-2xl px-3 py-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-zinc-50 px-3 py-2 text-xs">
          <div>
            <p className="font-medium truncate max-w-[7rem]">
              {profile?.full_name ?? user?.email ?? "Team"}
            </p>
            <p className="text-zinc-500">
              {profile?.role ? profile.role.toUpperCase() : "PUBLIC ACCESS"}
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-[0.7rem] font-semibold text-white">
            {initials}
          </div>
        </div>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white/70 px-4 py-3 backdrop-blur">
          <p className="text-sm font-semibold md:hidden">
            Closet Inventory Management
          </p>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

