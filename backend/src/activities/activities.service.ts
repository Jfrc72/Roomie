import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { ActivitiesRepository } from './activities.repository';

@Injectable()
export class ActivitiesService {
  constructor(private readonly repository: ActivitiesRepository) {}
  /** `userId` es null cuando la acción la hace el sistema (por ejemplo, el cierre automático de una votación). */
  add(homeId: string, userId: string | null, message: string, client: PoolClient) {
    return this.repository.add(homeId, userId, message, client);
  }
  list(homeId: string) { return this.repository.list(homeId); }
}
