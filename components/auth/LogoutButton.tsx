

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full rounded-lg border border-white/15 hover:bg-white/6 text-white text-sm font-medium py-2.5 px-4 transition-all disabled:opacity-60"
    >
      {loading ? "Logging out…" : "Logout"}
    </button>
  );
}