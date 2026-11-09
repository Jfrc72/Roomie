export class User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  active: boolean;
}

export class Session {
  token_hash: string;
  user_id: string;
  active_home_id: string | null;
  expires_at: Date;
}

export class LoginAttempt {
  email: string;
  attempts: number;
  window_start: Date;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  sessionHash: string;
  active_home_id: string | null;
}
