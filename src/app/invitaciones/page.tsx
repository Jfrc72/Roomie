import { redirect } from "next/navigation";
import { currentUser } from "@/server/security";
import { RoomieProvider } from "@/context/RoomieContext";
import AppShell from "@/components/AppShell";
import AcceptInvitation from "@/components/AcceptInvitation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  if (!(await currentUser()))
    redirect(
      `/login?next=${encodeURIComponent(`/invitaciones?token=${token}`)}`,
    );
  return (
    <RoomieProvider>
      <AppShell>
        <AcceptInvitation token={token} />
      </AppShell>
    </RoomieProvider>
  );
}
