import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { ActivitiesRepository } from './activities.repository';

@Injectable()
export class ActivitiesService {
  constructor(private readonly repository: ActivitiesRepository) {}
  add(homeId: string, userId: string, message: string, client: PoolClient) {
    return this.repository.add(homeId, userId, message, client);
  }
  list(homeId: string) { return this.repository.list(homeId); }
}
