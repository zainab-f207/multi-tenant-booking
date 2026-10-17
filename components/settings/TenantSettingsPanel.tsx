
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  timezone: string;
  defaultBookingDurationMinutes: number;
};

type CacheStatus = "hit" | "miss" | "database-fallback";

type SettingsResponse = {
  success: boolean;
  data?: {
    settings: Settings;
    cacheStatus: CacheStatus;
  };
  error?: {
    message?: string;
  };
};

const timezones = [
  "Asia/Karachi",
  "UTC",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
];

export default function TenantSettingsPanel() {
  const router = useRouter();

  const [settings, setSettings] = useState<Settings>({
    timezone: "Asia/Karachi",
    defaultBookingDurationMinutes: 60,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>();

  async function loadSettings() {
    try {
      const response = await fetch("/api/settings", {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (response.status === 403) {
        setError("You do not have permission to manage organization settings.");
        return;
      }

      const body = (await response.json()) as SettingsResponse;

      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error?.message ?? "Could not load settings.");
      }

      setSettings(body.data.settings);
      setCacheStatus(body.data.cacheStatus);
      setError("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function initialLoad() {
      try {
        const response = await fetch("/api/settings", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (response.status === 403) {
          setError("You do not have permission to manage organization settings.");
          return;
        }

        const body = (await response.json()) as SettingsResponse;

        if (!response.ok || !body.success || !body.data) {
          throw new Error(body.error?.message ?? "Could not load settings.");
        }

        setSettings(body.data.settings);
        setCacheStatus(body.data.cacheStatus);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        setError(err instanceof Error ? err.message : "Could not load settings.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void initialLoad();

    return () => controller.abort();
  }, [router]);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (response.status === 403) {
        setError("You do not have permission to change organization settings.");
        return;
      }

      const body = (await response.json()) as SettingsResponse;

      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error?.message ?? "Could not save settings.");
      }

      setSettings(body.data.settings);
      setCacheStatus(body.data.cacheStatus);
      setMessage(
        body.data.cacheStatus === "database-fallback"
          ? "Settings saved to the database. Redis is unavailable or cache invalidation could not be confirmed."
          : "Settings saved successfully."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-slate-300">
        Loading organization settings...
      </p>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white">Booking defaults</h2>
      <p className="mt-1 text-sm text-slate-400">
        These settings apply to your organization.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"
        >
          {error}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              void loadSettings();
            }}
            className="ml-2 underline"
          >
            Retry
          </button>
        </div>
      )}

      {message && (
        <p role="status" className="mt-4 text-sm text-emerald-300">
          {message}
        </p>
      )}

      <form onSubmit={saveSettings} className="mt-6 space-y-5">
        <div>
          <label htmlFor="timezone" className="mb-2 block text-sm text-slate-200">
            Time zone
          </label>
          <select
            id="timezone"
            value={settings.timezone}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                timezone: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"
          >
            {!timezones.includes(settings.timezone) && (
              <option value={settings.timezone}>{settings.timezone}</option>
            )}
            {timezones.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="duration" className="mb-2 block text-sm text-slate-200">
            Default booking duration
          </label>
          <select
            id="duration"
            value={settings.defaultBookingDurationMinutes}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                defaultBookingDurationMinutes: Number(event.target.value),
              }))
            }
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"
          >
            {[15, 30, 45, 60, 90, 120, 180, 240, 480].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
      </form>

      <div className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-400">
        Cache status:{" "}
        {cacheStatus === "hit"
          ? "Redis cache hit"
          : cacheStatus === "miss"
            ? "Loaded from database and cached"
            : "Database fallback"}
      </div>
    </section>
  );
}
