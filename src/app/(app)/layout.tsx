import { redirect } from "next/navigation";
import { currentUser } from "@/server/security";
import { RoomieProvider } from "@/context/RoomieContext";
import AppShell from "@/components/AppShell";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await currentUser())) redirect("/login");
  return (
    <RoomieProvider>
      <AppShell>{children}</AppShell>
    </RoomieProvider>
  );
}
