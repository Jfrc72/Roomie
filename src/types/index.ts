export interface User {
  id: string;
  name: string;
  email: string;
}
export interface Home {
  id: string;
  name: string;
  address: string;
  description: string;
  role: "admin" | "member";
  member_count: number;
}
export interface Member extends User {
  membership_id: string;
  role: "admin" | "member";
}
export interface Session {
  user: User;
  homes: Home[];
  activeHomeId: string | null;
}
export interface Notice {
  id: string;
  title: string;
  message: string;
  href: string;
  read_at: string | null;
  created_at: string;
}
export interface Activity {
  id: string;
  message: string;
  actor: string;
  created_at: string;
}
export interface DashboardSummary {
  // null significa módulo aún no conectado; 0 significa dato real igual a cero.
  balance: number | null;
  pendingTasks: number | null;
  shoppingItems: number | null;
  nextReservation: string | null;
  tasks: { id: string; title: string; due: string; href: string }[];
  expenses: { id: string; title: string; amount: number; href: string }[];
}
