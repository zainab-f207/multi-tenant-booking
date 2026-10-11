
import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server, type Socket } from "socket.io";
import {
  lookupSession,
  SESSION_COOKIE_NAME,
  type SessionLookupResult,
} from "./lib/session";
import { withTenantContext } from "./lib/tenant-context";
import { Permission, roleHasPermission } from "./lib/rbac";

interface ClientToServerEvents {
  "booking:join": (bookingId: string) => void;
  "booking:leave": () => void;
  "note:typing": (isTyping: boolean) => void;
  "note:saved": () => void;
}

interface ServerToClientEvents {
  "presence:update": (
    users: { userId: string; email: string; roleName: string }[]
  ) => void;
  "note:typing": (user: {
    userId: string;
    email: string;
    isTyping: boolean;
  }) => void;
  "note:changed": () => void;
  "realtime:error": (message: string) => void;
}

type InterServerEvents = Record<string, never>;

interface SocketData {
  session: SessionLookupResult;
  bookingRoom?: string;
  activeBookingId?: string;
}

type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const nextHandler = app.getRequestHandler();

function readCookie(
  cookieHeader: string | undefined,
  cookieName: string
): string | undefined {
  const cookies = (cookieHeader ?? "").split(";");

  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");

    if (separator < 0) continue;

    const name = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();

    if (name === cookieName) return value;
  }

  return undefined;
}

const bookingIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function startServer() {
  await app.prepare();

  const httpServer = createServer((req, res) => {
    void nextHandler(req, res);
  });

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, { path: "/socket.io" });

  io.use(async (socket, next) => {
    try {
      const token = readCookie(
        socket.handshake.headers.cookie,
        SESSION_COOKIE_NAME
      );

      if (!token) {
        next(new Error("UNAUTHENTICATED"));
        return;
      }

      const session = await lookupSession(token);

      if (!session) {
        next(new Error("UNAUTHENTICATED"));
        return;
      }

      socket.data.session = session;
      next();
    } catch {
      next(new Error("AUTHENTICATION_FAILED"));
    }
  });

  async function broadcastPresence(
    room: string,
    excludedSocketId?: string
  ) {
    const sockets = await io.in(room).fetchSockets();
    const uniqueUsers = new Map<
      string,
      { userId: string; email: string; roleName: string }
    >();

    for (const connected of sockets) {
      if (connected.id === excludedSocketId) continue;

      const session = connected.data.session;

      uniqueUsers.set(session.userId, {
        userId: session.userId,
        email: session.email,
        roleName: session.roleName,
      });
    }

    io.to(room).emit("presence:update", [...uniqueUsers.values()]);
  }

  io.on("connection", (socket: AppSocket) => {
    socket.on("booking:join", async (bookingId) => {
      try {
        const session = socket.data.session;

        if (
          typeof bookingId !== "string" ||
          !bookingIdPattern.test(bookingId)
        ) {
          socket.emit("realtime:error", "Invalid booking ID.");
          return;
        }

        if (
          !roleHasPermission(session.roleName, Permission.VIEW_BOOKINGS)
        ) {
          socket.emit("realtime:error", "You cannot view this booking.");
          return;
        }

        const booking = await withTenantContext(
          session.tenantId,
          (tx) =>
            tx.booking.findFirst({
              where: {
                id: bookingId,
                tenantId: session.tenantId,
              },
              select: { id: true },
            })
        );

        if (!booking) {
          socket.emit("realtime:error", "Booking not found or inaccessible.");
          return;
        }

        const previousRoom = socket.data.bookingRoom;

        if (previousRoom) {
          await socket.leave(previousRoom);
          socket.data.bookingRoom = undefined;
          socket.data.activeBookingId = undefined;
          await broadcastPresence(previousRoom);
        }

        const room = `booking:${session.tenantId}:${bookingId}`;

        await socket.join(room);
        socket.data.bookingRoom = room;
        socket.data.activeBookingId = bookingId;

        await broadcastPresence(room);
      } catch {
        socket.emit("realtime:error", "Could not join the booking room.");
      }
    });

    socket.on("booking:leave", async () => {
      const room = socket.data.bookingRoom;

      if (!room) return;

      await socket.leave(room);
      socket.data.bookingRoom = undefined;
      socket.data.activeBookingId = undefined;

      await broadcastPresence(room);
    });

    socket.on("note:typing", (isTyping) => {
      const session = socket.data.session;
      const room = socket.data.bookingRoom;

      if (!room || typeof isTyping !== "boolean") return;

      if (
        !roleHasPermission(
          session.roleName,
          Permission.EDIT_BOOKING_NOTES
        )
      ) {
        return;
      }

      socket.to(room).emit("note:typing", {
        userId: session.userId,
        email: session.email,
        isTyping,
      });
    });

    socket.on("note:saved", () => {
      const session = socket.data.session;
      const room = socket.data.bookingRoom;

      if (!room) return;

      if (
        !roleHasPermission(
          session.roleName,
          Permission.EDIT_BOOKING_NOTES
        )
      ) {
        return;
      }

      socket.to(room).emit("note:changed");
    });

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room.startsWith("booking:")) {
          void broadcastPresence(room, socket.id);
        }
      }
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}

startServer().catch((error: unknown) => {
  console.error("Failed to start the application server:", error);
  process.exit(1);
});
