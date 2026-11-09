import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PoolClient } from 'pg';
import { HomeAccessRepository } from './home-access.repository';

@Injectable()
export class HomeAccessService {
  constructor(private readonly repository: HomeAccessRepository) {}

  async requireHome(userId: string, homeId: string, admin = false, client?: PoolClient) {
    if (!isUUID(homeId)) throw new BadRequestException('Identificador inválido.');
    const role = await this.repository.role(userId, homeId, client);
    if (!role) throw new ForbiddenException('No tienes acceso a este apartamento.');
    if (admin && role !== 'admin') throw new ForbiddenException('Esta acción requiere el rol de administrador.');
    return role;
  }

  async lockHome(userId: string, homeId: string, client: PoolClient, admin = true) {
    if (!isUUID(homeId)) throw new BadRequestException('Identificador inválido.');
    await this.repository.lockHome(homeId, client);
    return this.requireHome(userId, homeId, admin, client);
  }

  async requireAccountCanClose(userId: string, client: PoolClient) {
    if (!await this.repository.canCloseAccount(userId, client)) {
      throw new ConflictException('Asigna otro administrador o archiva tus apartamentos antes de cerrar la cuenta.');
    }
  }
}
