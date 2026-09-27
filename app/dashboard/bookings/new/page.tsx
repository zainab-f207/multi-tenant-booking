import { redirect } from "next/navigation";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth/current-user";
import { roleHasPermission, Permission } from "@/lib/rbac";
import BookingForm from "@/components/bookings/BookingForm";

export default async function NewBookingPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  if (!roleHasPermission(user.roleName, Permission.CREATE_BOOKINGS)) {
    redirect("/dashboard/bookings");
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-6">New Booking</h1>
      <BookingForm mode="create" />
    </div>
  );
}