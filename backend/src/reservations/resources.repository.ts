import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { ResourceDto } from './reservations.dto';
import { Resource } from './reservations.entity';

@Injectable()
export class ResourcesRepository {
  constructor(private readonly db: DatabaseService) {}

  list(homeId: string) {
    return this.db.query<Pick<Resource, 'id' | 'name' | 'description'>>('SELECT id,name,description FROM resources WHERE home_id=$1 AND active ORDER BY lower(name)', [homeId]);
  }
  async create(homeId: string, data: ResourceDto, client: PoolClient) {
    const [row] = await this.db.query<Pick<Resource, 'id' | 'name' | 'description'>>('INSERT INTO resources(home_id,name,description) VALUES($1,$2,$3) RETURNING id,name,description',
      [homeId, data.name, data.description], client);
    return row;
  }
  // Bloquear el recurso serializa su retiro con las reservas que se están creando.
  async lock(resourceId: string, client: PoolClient) {
    const [row] = await this.db.query<Resource>('SELECT * FROM resources WHERE id=$1 AND active FOR UPDATE', [resourceId], client);
    return row ?? null;
  }
  // FOR UPDATE procesa de una en una las reservas del mismo recurso: sin él, dos inserciones simultáneas
  // que se cruzan se esperan en la restricción EXCLUDE y PostgreSQL aborta una por deadlock.
  async lockForReservation(resourceId: string, homeId: string, client: PoolClient) {
    const [row] = await this.db.query<Pick<Resource, 'name'>>('SELECT name FROM resources WHERE id=$1 AND home_id=$2 AND active FOR UPDATE', [resourceId, homeId], client);
    return row ?? null;
  }
  async update(resourceId: string, data: ResourceDto, client: PoolClient) {
    await this.db.query('UPDATE resources SET name=$1,description=$2 WHERE id=$3', [data.name, data.description, resourceId], client);
  }
  async upcomingReservations(resourceId: string, client: PoolClient) {
    const [row] = await this.db.query<{ total: number }>("SELECT count(*)::int AS total FROM reservations WHERE resource_id=$1 AND status='active' AND ends_at>now()", [resourceId], client);
    return row.total;
  }
  // Baja lógica: las reservas pasadas conservan su recurso.
  async retire(resourceId: string, client: PoolClient) {
    await this.db.query('UPDATE resources SET active=false WHERE id=$1', [resourceId], client);
  }
}
