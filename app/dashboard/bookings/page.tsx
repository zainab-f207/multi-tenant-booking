
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth/current-user";
import { roleHasPermission, Permission } from "@/lib/rbac";
import BookingsBrowser from "@/components/bookings/BookingsBrowser";

export default async function BookingsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  const canCreate = roleHasPermission(user.roleName, Permission.CREATE_BOOKINGS);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Bookings</h1>
        {canCreate && (
          <Link
            href="/dashboard/bookings/new"
            className="rounded-lg bg-linear-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white text-sm font-medium py-2 px-4 shadow-lg shadow-indigo-900/30 transition-all"
          >
            + New Booking
          </Link>
        )}
      </div>
      <BookingsBrowser />
    </div>
  );
}