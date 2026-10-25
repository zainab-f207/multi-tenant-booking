"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface NavItem {
  href: string;
  label: string;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const linkBase =
  "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70";
const linkActive = "bg-white/10 text-white";
const linkIdle = "text-slate-300 hover:bg-white/5 hover:text-white";

/**
 * Navigation links only. Which links appear is decided on the server (layout.tsx) from
 * the existing RBAC permissions; this component never decides access, it only renders.
 */
export default function DashboardNav({
  items,
  logout,
}: {
  items: NavItem[];
  logout: ReactNode;
}) {
  const pathname = usePathname();
  // The menu is "open for" a specific path, so it closes automatically after navigation
  // without needing an effect that sets state.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenFor(null);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`${linkBase} ${active ? linkActive : linkIdle}`}
            >
              {item.label}
            </Link>
          );
        })}
        <div className="ml-2 min-w-24">{logout}</div>
      </nav>

      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-slate-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 md:hidden"
        aria-expanded={open}
        aria-controls="dashboard-mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpenFor(open ? null : pathname)}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <nav
          id="dashboard-mobile-menu"
          aria-label="Primary"
          className="flex w-full flex-col gap-1 pt-3 md:hidden"
        >
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${linkBase} py-3 ${active ? linkActive : linkIdle}`}
                onClick={() => setOpenFor(null)}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="mt-2 border-t border-white/10 pt-3">{logout}</div>
        </nav>
      )}
    </>
  );
}

