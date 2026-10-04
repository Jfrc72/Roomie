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
export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high";
export interface Task {
  id: string;
  home_id: string;
  title: string;
  description: string;
  assigned_membership_id: string | null;
  assignee_user_id: string | null;
  assignee: string | null;
  assignee_active: boolean;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_by: string;
  creator: string;
  created_at: string;
  completed_at: string | null;
  can_edit: boolean;
}
export interface TaskHistoryEntry {
  id: string;
  actor: string | null;
  previous_status: TaskStatus | null;
  new_status: TaskStatus;
  created_at: string;
}
export interface Resource {
  id: string;
  name: string;
  description: string;
}
export interface Reservation {
  id: string;
  resource_id: string;
  resource: string;
  user_id: string;
  member: string;
  member_active: boolean;
  starts_at: string;
  ends_at: string;
  can_cancel: boolean;
}
export interface PollOption {
  id: string;
  label: string;
  // null mientras la votación está abierta; voters es null también si es anónima.
  votes: number | null;
  voters: string[] | null;
}
export interface Poll {
  id: string;
  title: string;
  description: string;
  anonymous: boolean;
  closes_at: string | null;
  status: "open" | "closed";
  creator: string;
  created_at: string;
  closed_at: string | null;
  options: PollOption[];
  my_option_id: string | null;
  voters: number;
  eligible: number;
  can_close: boolean;
}
export interface RuleVersion {
  id: string;
  version: number;
  content: string;
  notes: string;
  author: string;
  created_at: string;
}
export interface RuleAcceptance {
  membership_id: string;
  user_id: string;
  name: string;
  accepted_at: string | null;
}
export interface Rules {
  current: RuleVersion | null;
  accepted_by_me: boolean;
  acceptances: RuleAcceptance[];
  history: RuleVersion[];
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
