"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";
import {
  ApiClientError,
  fetchBookingNote,
  saveBookingNote,
  type BookingNoteDTO,
} from "@/lib/api/booking-client";
import { useToast } from "@/components/ui/Toast";

type ActiveUser = {
  userId: string;
  email: string;
  roleName: string;
};

export default function BookingNotesPanel({
  bookingId,
  canEdit,
}: {
  bookingId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const [note, setNote] = useState<BookingNoteDTO | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [connected, setConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const noteRef = useRef<BookingNoteDTO | null>(null);
  const contentRef = useRef(content);

  // Keep refs synchronized with the latest state.
  useEffect(() => {
    noteRef.current = note;
    contentRef.current = content;
  }, [note, content]);

  // Refresh the note without overwriting an unsaved draft.
  const refreshLatestNote = useCallback(async () => {
    try {
      const latest = await fetchBookingNote(bookingId);

      const currentNote = noteRef.current;
      const currentContent = contentRef.current;

      if (!currentNote) {
        setNote(latest);
        setContent(latest.content);
        setConflict(false);
        setError("");
        return;
      }

      // Update the note if the editor has no unsaved changes.
      if (currentContent === currentNote.content) {
        setNote(latest);
        setContent(latest.content);
        setConflict(false);
        setError("");
        return;
      }

      // Preserve the draft if someone else saved a newer version.
      if (latest.version !== currentNote.version) {
        setConflict(true);
        setError(
          "This note changed elsewhere. Load the latest version before saving."
        );
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "UNAUTHENTICATED") {
          router.push("/login");
          return;
        }
      }

      setError("Could not refresh the shared note. Please try again.");
    }
  }, [bookingId, router]);

  // Initial loading and the manual reload action.
  useEffect(() => {
    let ignore = false;

    async function loadNote() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchBookingNote(bookingId);

        if (ignore) return;

        setNote(result);
        setContent(result.content);
        setConflict(false);
      } catch (err) {
        if (ignore) return;

        if (err instanceof ApiClientError) {
          if (err.code === "UNAUTHENTICATED") {
            router.push("/login");
            return;
          }

          setError(err.message);
        } else {
          setError("Could not load the note. Please try again.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadNote();

    return () => {
      ignore = true;
    };
  }, [bookingId, router, reloadToken]);

  // Socket.IO connection, presence, shared updates, and reconnection.
  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected:", socket.id);

      setConnected(true);

      // Rejoin the booking room after every successful connection.
      socket.emit("booking:join", bookingId);

      // Retrieve updates missed while the browser was offline.
      void refreshLatestNote();
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket.IO] Disconnected:", reason);

      setConnected(false);
      setActiveUsers([]);
      setTypingUsers([]);
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket.IO] Connection error:", error.message);
      setConnected(false);
    });

    socket.io.on("reconnect_attempt", (attempt) => {
      console.log("[Socket.IO] Reconnect attempt:", attempt);
    });

    socket.io.on("reconnect", (attempt) => {
      console.log("[Socket.IO] Reconnected after attempts:", attempt);
    });

    socket.io.on("reconnect_error", (error) => {
      console.error("[Socket.IO] Reconnection error:", error.message);
    });

    socket.io.on("reconnect_failed", () => {
      console.error("[Socket.IO] Reconnection failed");
    });

    socket.on("presence:update", (users: ActiveUser[]) => {
      setActiveUsers(users);
    });

    socket.on(
      "note:typing",
      (user: { userId: string; email: string; isTyping: boolean }) => {
        setTypingUsers((current) => {
          if (user.isTyping) {
            return current.includes(user.email)
              ? current
              : [...current, user.email];
          }

          return current.filter((email) => email !== user.email);
        });
      }
    );

    socket.on("note:changed", () => {
      void refreshLatestNote();
    });

    // Explicitly disconnect when the browser reports that it is offline.
    const handleOffline = () => {
      console.log("[Browser] Offline event received");

      setConnected(false);
      setActiveUsers([]);
      setTypingUsers([]);

      if (socket.connected) {
        socket.disconnect();
      }
    };

    // Explicitly reconnect when the browser reports that it is online.
    const handleOnline = () => {
      console.log("[Browser] Online event received");

      if (!navigator.onLine) return;

      if (!socket.connected) {
        console.log("[Socket.IO] Reconnecting after browser came online");
        socket.connect();
      } else {
        // The socket is already connected; make the UI reflect that state.
        setConnected(true);
        void refreshLatestNote();
      }
    };

    // Recover if the user returns to the tab after a connection interruption.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!navigator.onLine) return;

      console.log("[Browser] Tab became visible");

      if (!socket.connected) {
        console.log("[Socket.IO] Reconnecting after tab became visible");
        socket.connect();
      } else {
        setConnected(true);
        void refreshLatestNote();
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    console.log("[Socket.IO] Starting initial connection");
    socket.connect();

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      socket.emit("booking:leave");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [bookingId, refreshLatestNote]);

  const handleSave = useCallback(async () => {
    if (!note || !canEdit || saving || conflict) return;
    if (content === note.content) return;

    setSaving(true);
    setError("");

    try {
      const result = await saveBookingNote(
        bookingId,
        content,
        note.version
      );

      setNote(result);
      setContent(result.content);
      setConflict(false);

      socketRef.current?.emit("note:saved");
      showToast("success", "Note saved successfully.");
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "UNAUTHENTICATED") {
          router.push("/login");
          return;
        }

        if (err.code === "VERSION_CONFLICT") {
          setConflict(true);
          setError(
            "This note changed elsewhere. Load the latest version before saving."
          );
          return;
        }

        setError(err.message);
      } else {
        setError("Could not save the note. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }, [
    note,
    canEdit,
    saving,
    conflict,
    content,
    bookingId,
    router,
    showToast,
  ]);

  const hasChanges = note !== null && content !== note.content;

  // Automatically save after the user stops editing for 1.2 seconds.
  useEffect(() => {
    if (
      !canEdit ||
      !hasChanges ||
      saving ||
      conflict ||
      loading ||
      !note
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void handleSave();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    canEdit,
    hasChanges,
    saving,
    conflict,
    loading,
    note,
    content,
    handleSave,
  ]);

  return (
    <section className="mt-6 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.07] p-4 sm:p-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">
            Shared booking notes
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Keep important information and next steps for this booking.
          </p>
        </div>

        {note && (
          <span className="w-fit shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
            Version {note.version}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={
            connected
              ? "max-w-full rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-300"
              : "max-w-full rounded-full bg-amber-400/10 px-3 py-1 text-amber-200"
          }
        >
          {connected ? "Live connection" : "Offline — reconnecting..."}
        </span>

        {connected && (
          <span className="max-w-full rounded-full bg-white/10 px-3 py-1 text-slate-300">
            {activeUsers.length} active connection
            {activeUsers.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {typingUsers.length > 0 && (
        <p className="mt-3 wrap-break-word text-sm text-indigo-300">
          {typingUsers.join(", ")}{" "}
          {typingUsers.length === 1 ? "is" : "are"} typing...
        </p>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-slate-400">Loading note...</p>
      ) : error && !note ? (
        <div className="mt-5 rounded-lg border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="mt-3 rounded-md border border-rose-300/40 px-3 py-2 hover:bg-rose-400/10"
          >
            Retry
          </button>
        </div>
      ) : note ? (
        <>
          {!canEdit && (
            <p className="mt-5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
              View-only: you can read this note but cannot edit it.
            </p>
          )}

          {conflict && (
            <div className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              <p className="font-medium">
                This note was changed by someone else.
              </p>
              <p className="mt-1">
                Your draft has been preserved. Load the latest version before
                deciding how to continue.
              </p>
              <button
                type="button"
                onClick={() => setReloadToken((value) => value + 1)}
                className="mt-3 rounded-md border border-amber-300/40 px-3 py-2 hover:bg-amber-400/10"
              >
                Load latest version
              </button>
            </div>
          )}

          <div className="mt-5 min-w-0">
            <label
              htmlFor="booking-note"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Note content
            </label>

            <textarea
              id="booking-note"
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                socketRef.current?.emit("note:typing", true);
              }}
              onBlur={() => {
                socketRef.current?.emit("note:typing", false);
              }}
              readOnly={!canEdit}
              maxLength={10000}
              rows={7}
              placeholder="Write important booking notes here..."
              className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/15 bg-white/6 px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 read-only:cursor-default read-only:opacity-80 sm:px-4"
            />

            <div className="mt-2 flex min-w-0 flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {content.length.toLocaleString()} / 10,000 characters
              </span>

              {note.updatedAt && (
                <span className="wrap-break-word">
                  Last updated: {new Date(note.updatedAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-3 wrap-break-word rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200"
            >
              {error}
            </p>
          )}

          {canEdit && (
            <div className="mt-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 wrap-break-word text-xs text-slate-400">
                {saving
                  ? "Saving..."
                  : conflict
                    ? "Resolve the conflict before saving."
                    : hasChanges
                      ? "Unsaved changes"
                      : "All changes saved"}
              </p>

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!hasChanges || saving || conflict}
                className="w-full rounded-lg bg-linear-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:shrink-0"
              >
                {saving ? "Saving..." : "Save note"}
              </button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}