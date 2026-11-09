export class Notification {
  id: string;
  home_id: string;
  user_id: string;
  title: string;
  message: string;
  href: string;
  read_at: Date | null;
  dismissed_at: Date | null;
  source_key: string | null;
  created_at: Date;
}

export class NotificationPreference {
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  reminder_hours: number;
}

export class Reminder {
  id: string;
  home_id: string;
  user_id: string;
  source_key: string;
  title: string;
  message: string;
  href: string;
  due_at: Date;
  processed_at: Date | null;
}

export class Delivery {
  id: string;
  notification_id: string;
  channel: 'email' | 'push';
  attempts: number;
  sent_at: Date | null;
  next_attempt_at: Date;
}

export class PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface NotificationInput {
  homeId: string;
  userId: string;
  title: string;
  message: string;
  href: string;
  sourceKey?: string;
}
