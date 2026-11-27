import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SessionUser } from '../auth/auth.entity';
import { isOffsetDateTime } from '../common/validators';
import { ReservationDto } from './reservations.dto';
import { ReservationsRepository } from './reservations.repository';
import { ResourcesRepository } from './resources.repository';
import { rangeProblem, reservationProblem } from './reservations.rules';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly repository: ReservationsRepository,
    private readonly resources: ResourcesRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string, homeId: string, from?: string, to?: string) {
    const role = await this.access.requireHome(userId, homeId);
    let range: { from: string; to: string } | undefined;
    if (from !== undefined || to !== undefined) {
      if (!from || !to || !isOffsetDateTime(from) || !isOffsetDateTime(to)) throw new BadRequestException('Revisa los campos: los datos no son válidos.');
      const problem = rangeProblem(new Date(from), new Date(to));
      if (problem) throw new BadRequestException(problem);
      range = { from, to };
    }
    const reservations = await this.repository.list(homeId, range);
    return reservations.map(reservation => ({ ...reservation, can_cancel: role === 'admin' || reservation.user_id === userId }));
  }

  async create(userId: string, homeId: string, data: ReservationDto) {
    await this.access.requireHome(userId, homeId);
    const start = new Date(data.starts_at);
    const end = new Date(data.ends_at);
    const problem = reservationProblem(start, end);
    if (problem) throw new BadRequestException(problem);
    return this.db.transaction(async client => {
      const resource = await this.resources.lockForReservation(data.resource_id, homeId, client);
      if (!resource) throw new BadRequestException('Elige un recurso disponible del apartamento.');
      const membershipId = await this.repository.membership(homeId, userId, client);
      if (!membershipId) throw new ForbiddenException('No tienes acceso a este apartamento.');
      let id: string;
      try {
        id = await this.repository.create({ homeId, resourceId: data.resource_id, membershipId, start, end }, client);
      } catch (error) {
        // 23P01: la restricción EXCLUDE encontró un cruce con otra reserva activa.
        if ((error as { code?: string }).code === '23P01') throw new ConflictException(`${resource.name} ya está reservado en ese horario. Elige otro.`);
        throw error;
      }
      await this.activities.add(homeId, userId, `reservó "${resource.name}"`, client);
      await this.notifications.scheduleReminder(client, {
        homeId, userId, sourceKey: `reservation:${id}`, title: 'Recordatorio de reserva',
        message: `Recuerda tu reserva de "${resource.name}".`, href: '/reservas', dueAt: start,
      });
      return { id, message: 'Reserva creada.' };
    });
  }

  cancel(user: SessionUser, reservationId: string) {
    return this.db.transaction(async client => {
      const reservation = await this.repository.lock(reservationId, client);
      if (!reservation) throw new NotFoundException('Reserva no encontrada.');
      const role = await this.access.requireHome(user.id, reservation.home_id, false, client);
      if (role !== 'admin' && reservation.user_id !== user.id) throw new ForbiddenException('Solo quien hizo la reserva o un administrador pueden cancelarla.');
      if (reservation.status !== 'active') throw new ConflictException('Esta reserva ya fue cancelada.');
      if (new Date(reservation.ends_at) <= new Date()) throw new ConflictException('Esta reserva ya terminó.');
      await this.repository.cancel(reservationId, client);
      await this.notifications.cancelReminder(client, `reservation:${reservationId}`);
      await this.activities.add(reservation.home_id, user.id, `canceló una reserva de "${reservation.resource}"`, client);
      if (reservation.user_id !== user.id) await this.notifications.notify(client, {
        homeId: reservation.home_id, userId: reservation.user_id, title: 'Reserva cancelada',
        message: `${user.name} canceló tu reserva de "${reservation.resource}".`, href: '/reservas',
        sourceKey: `reservation:${reservationId}:cancelled:${reservation.user_id}`,
      });
      return { message: 'Reserva cancelada.' };
    });
  }

  // Resumen de Inicio. Quien lo llama ya comprobó el acceso al hogar.
  next(homeId: string) { return this.repository.next(homeId); }
}
