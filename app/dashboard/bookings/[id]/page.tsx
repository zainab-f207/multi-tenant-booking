
import { redirect } from "next/navigation";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth/current-user";
import { roleHasPermission, Permission } from "@/lib/rbac";
import BookingDetail from "@/components/bookings/BookingDetail";
import BookingNotesPanel from "@/components/bookings/BookingNotesPanel";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let user;

  try {
    user = await getCurrentUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  const { id } = await params;

  const canManage = roleHasPermission(
    user.roleName,
    Permission.MANAGE_BOOKINGS
  );

  const canEditNotes = roleHasPermission(
    user.roleName,
    Permission.EDIT_BOOKING_NOTES
  );

  return (
    <div className="space-y-6">
      <BookingDetail bookingId={id} canManage={canManage} />
      <BookingNotesPanel bookingId={id} canEdit={canEditNotes} />
    </div>
  );
}
