import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { CreateTaskDto } from './tasks.dto';
import { Task, TaskHistoryRow, TaskRow } from './tasks.entity';
import { TaskStatus } from './tasks.rules';

const columns = `SELECT t.id,t.home_id,t.title,t.description,t.assigned_membership_id,t.due_at,t.priority,
  t.status,t.created_by,t.created_at,t.completed_at,m.user_id AS assignee_user_id,u.name AS assignee,
  COALESCE(m.active,false) AS assignee_active,c.name AS creator
  FROM tasks t LEFT JOIN memberships m ON m.id=t.assigned_membership_id
  LEFT JOIN users u ON u.id=m.user_id JOIN users c ON c.id=t.created_by`;

@Injectable()
export class TasksRepository {
  constructor(private readonly db: DatabaseService) {}

  // Abiertas y completadas en los últimos 30 días; las anteriores siguen disponibles por id.
  list(homeId: string) {
    return this.db.query<TaskRow>(`${columns} WHERE t.home_id=$1 AND (t.status<>'completed' OR t.completed_at>now()-interval '30 days')
      ORDER BY t.due_at ASC NULLS LAST, t.created_at DESC`, [homeId]);
  }
  async find(taskId: string) {
    const [row] = await this.db.query<TaskRow>(`${columns} WHERE t.id=$1`, [taskId]);
    return row ?? null;
  }
  async lock(taskId: string, client: PoolClient) {
    const [row] = await this.db.query<TaskRow>(`${columns} WHERE t.id=$1 FOR UPDATE OF t`, [taskId], client);
    return row ?? null;
  }
  history(taskId: string) {
    return this.db.query<TaskHistoryRow>(`SELECT h.id,h.previous_status,h.new_status,h.created_at,u.name AS actor FROM task_history h
      LEFT JOIN users u ON u.id=h.actor_id WHERE h.task_id=$1 ORDER BY h.created_at DESC`, [taskId]);
  }
  // FOR SHARE impide que retiren a la persona antes de confirmar la asignación.
  async activeMember(homeId: string, membershipId: string, client: PoolClient) {
    const [row] = await this.db.query<{ user_id: string }>('SELECT user_id FROM memberships WHERE id=$1 AND home_id=$2 AND active FOR SHARE', [membershipId, homeId], client);
    return row?.user_id ?? null;
  }
  async create(homeId: string, data: CreateTaskDto, userId: string, client: PoolClient) {
    const [row] = await this.db.query<Pick<Task, 'id' | 'home_id' | 'title' | 'status' | 'due_at'>>(
      `INSERT INTO tasks(home_id,title,description,assigned_membership_id,due_at,priority,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,home_id,title,status,due_at`,
      [homeId, data.title, data.description, data.assigned_membership_id, data.due_at, data.priority, userId], client,
    );
    return row;
  }
  async addHistory(taskId: string, actorId: string, previous: TaskStatus | null, next: TaskStatus, client: PoolClient) {
    const [row] = await this.db.query<{ id: string }>('INSERT INTO task_history(task_id,actor_id,previous_status,new_status) VALUES($1,$2,$3,$4) RETURNING id',
      [taskId, actorId, previous, next], client);
    return row.id;
  }
  // La fecha de cumplimiento se conserva mientras siga completada y se borra al reabrirla.
  async update(task: Pick<TaskRow, 'id' | 'title' | 'description' | 'assigned_membership_id' | 'due_at' | 'priority' | 'status'>, client: PoolClient) {
    await this.db.query(`UPDATE tasks SET title=$1,description=$2,assigned_membership_id=$3,due_at=$4,priority=$5,status=$6,
      completed_at=CASE WHEN $6='completed' THEN COALESCE(completed_at,now()) END WHERE id=$7`,
    [task.title, task.description, task.assigned_membership_id, task.due_at, task.priority, task.status, task.id], client);
  }
  // El historial se elimina en cascada; la actividad del hogar conserva el registro.
  async remove(taskId: string, client: PoolClient) {
    await this.db.query('DELETE FROM tasks WHERE id=$1', [taskId], client);
  }

  openAssigned(homeId: string, userId: string) {
    return this.db.query<{ id: string; title: string; due_at: Date | null }>(`SELECT t.id,t.title,t.due_at FROM tasks t JOIN memberships m ON m.id=t.assigned_membership_id
      WHERE t.home_id=$1 AND m.user_id=$2 AND t.status<>'completed' ORDER BY t.due_at ASC NULLS LAST,t.created_at LIMIT 5`, [homeId, userId]);
  }
  async countOpenAssigned(homeId: string, userId: string) {
    const [row] = await this.db.query<{ total: number }>(`SELECT count(*)::int AS total FROM tasks t JOIN memberships m ON m.id=t.assigned_membership_id
      WHERE t.home_id=$1 AND m.user_id=$2 AND t.status<>'completed'`, [homeId, userId]);
    return row.total;
  }
}
