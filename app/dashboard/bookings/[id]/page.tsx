import { redirect } from "next/navigation";
import { getCurrentUser, UnauthenticatedError } from "@/lib/auth/current-user";
import { roleHasPermission, Permission } from "@/lib/rbac";
import BookingDetail from "@/components/bookings/BookingDetail";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  const { id } = await params;
  const canManage = roleHasPermission(user.roleName, Permission.MANAGE_BOOKINGS);

  return <BookingDetail bookingId={id} canManage={canManage} />;
}