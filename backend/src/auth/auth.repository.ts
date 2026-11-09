import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { SessionUser, User } from './auth.entity';

@Injectable()
export class AuthRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(name: string, email: string, passwordHash: string, client: PoolClient) {
    const [row] = await this.db.query<User>(
      'INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING *', [name, email, passwordHash], client,
    );
    await this.db.query('INSERT INTO notification_preferences(user_id) VALUES($1)', [row.id], client);
    return Object.assign(new User(), row);
  }

  async findByEmail(email: string) {
    const [row] = await this.db.query<User>('SELECT * FROM users WHERE email=$1 AND active', [email]);
    return row ? Object.assign(new User(), row) : null;
  }

  async passwordFor(userId: string, client: PoolClient) {
    const [row] = await this.db.query<User>('SELECT password_hash FROM users WHERE id=$1 AND active FOR UPDATE', [userId], client);
    return row?.password_hash;
  }

  async countAttempt(email: string) {
    const [row] = await this.db.query<{ attempts: number }>(
      `INSERT INTO login_attempts(email,attempts) VALUES($1,1)
       ON CONFLICT(email) DO UPDATE SET attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
       window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts`, [email],
    );
    return row.attempts;
  }

  async clearAttempts(email: string) {
    await this.db.query('DELETE FROM login_attempts WHERE email=$1', [email]);
  }

  async createSession(userId: string, tokenHash: string, client?: PoolClient) {
    await this.db.query(`INSERT INTO sessions(token_hash,user_id,expires_at,active_home_id)
      VALUES($1,$2,now()+interval '7 days',(SELECT m.home_id FROM memberships m JOIN homes h ON h.id=m.home_id
      WHERE m.user_id=$2 AND m.active AND h.archived_at IS NULL ORDER BY h.created_at LIMIT 1))`, [tokenHash, userId], client);
  }

  async currentUser(tokenHash: string) {
    const [row] = await this.db.query<Omit<SessionUser, 'sessionHash'>>(
      `SELECT u.id,u.name,u.email,s.active_home_id FROM users u JOIN sessions s ON s.user_id=u.id
       WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`, [tokenHash],
    );
    return row ? { ...row, sessionHash: tokenHash } : null;
  }

  homesFor(userId: string) {
    return this.db.query<{ id: string; name: string; address: string; description: string; role: string; member_count: number }>(
      `SELECT h.*,m.role,(SELECT count(*)::int FROM memberships WHERE home_id=h.id AND active) AS member_count
       FROM homes h JOIN memberships m ON m.home_id=h.id WHERE m.user_id=$1 AND m.active AND h.archived_at IS NULL ORDER BY h.created_at`, [userId],
    );
  }

  async logout(sessionHash: string) {
    await this.db.query('DELETE FROM sessions WHERE token_hash=$1', [sessionHash]);
  }

  async rename(userId: string, name: string) {
    await this.db.query('UPDATE users SET name=$1 WHERE id=$2', [name, userId]);
  }

  async changePassword(userId: string, passwordHash: string, client: PoolClient) {
    await this.db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, userId], client);
    await this.db.query('DELETE FROM sessions WHERE user_id=$1', [userId], client);
  }

  async closeAccount(userId: string, client: PoolClient) {
    await this.db.query('UPDATE memberships SET active=false WHERE user_id=$1', [userId], client);
    await this.db.query('DELETE FROM sessions WHERE user_id=$1', [userId], client);
    await this.db.query('DELETE FROM push_subscriptions WHERE user_id=$1', [userId], client);
    await this.db.query('DELETE FROM reminders WHERE user_id=$1', [userId], client);
    await this.db.query('DELETE FROM deliveries WHERE notification_id IN (SELECT id FROM notifications WHERE user_id=$1)', [userId], client);
    await this.db.query("UPDATE invitations SET status='revoked' WHERE created_by=$1 AND status='pending'", [userId], client);
    await this.db.query('UPDATE notification_preferences SET email_enabled=false,push_enabled=false WHERE user_id=$1', [userId], client);
    await this.db.query("UPDATE users SET active=false,name='Cuenta cerrada',email=$2,password_hash='' WHERE id=$1", [userId, `${userId}@closed.roomie.invalid`], client);
  }
}
