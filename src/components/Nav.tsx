"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWallet } from "@/components/ConnectWallet";

const links = [
  { href: "/world", label: "World" },
  { href: "/market", label: "Market" },
  { href: "/governance", label: "Vote" },
];

export function Nav() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-40 border-b border-cyan-400/15 bg-[#050b12]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/civilization" className="font-[family-name:var(--font-display)] text-xl tracking-[0.2em] text-cyan-300">
          MONADIA
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  active ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400 hover:text-cyan-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <ConnectWallet />
      </div>
    </header>
  );
}
