import { redirect } from "next/navigation";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth/current-user";
import { roleHasPermission, Permission } from "@/lib/rbac";
import EditBookingForm from "@/components/bookings/EditBookingForm";

export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  if (!roleHasPermission(user.roleName, Permission.MANAGE_BOOKINGS)) {
    redirect("/dashboard/bookings");
  }

  const { id } = await params;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-6">Edit Booking</h1>
      <EditBookingForm bookingId={id} />
    </div>
  );
}