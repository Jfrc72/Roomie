import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { HomeAccessService } from '../access/home-access.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationInput } from './notifications.entity';
import { PreferencesDto, SubscriptionDto } from './notifications.dto';

function requireInternalPath(path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f]/.test(path)) {
    throw new BadRequestException('La notificación debe apuntar a una ruta interna.');
  }
}

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository, private readonly db: DatabaseService, private readonly access: HomeAccessService) {}

  async preferences(userId: string) {
    return { ...await this.repository.preferences(userId), emailAvailable: Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM), pushAvailable: Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_SUBJECT) };
  }

  async savePreferences(userId: string, data: PreferencesDto) {
    const availability = await this.preferences(userId);
    if (data.email_enabled && !availability.emailAvailable) throw new BadRequestException('El correo aún no está configurado en el servidor.');
    if (data.push_enabled && !availability.pushAvailable) throw new BadRequestException('Las notificaciones push aún no están configuradas.');
    await this.repository.savePreferences(userId, data);
    return { message: 'Preferencias guardadas.' };
  }

  async list(userId: string, homeId?: string) {
    if (!homeId) return [];
    await this.access.requireHome(userId, homeId);
    return this.repository.list(userId, homeId);
  }

  change(userId: string, id: string, read: boolean | null) {
    return this.db.transaction(async client => {
      const notice = await this.repository.find(userId, id, client);
      if (!notice) throw new NotFoundException('Notificación no encontrada.');
      await this.access.requireHome(userId, notice.home_id, false, client);
      if (read === null) await this.repository.dismiss(userId, id, client);
      else await this.repository.read(userId, id, read, client);
      return { message: read === null ? 'Notificación eliminada.' : 'Notificación actualizada.' };
    });
  }

  async subscribe(userId: string, data: SubscriptionDto) {
    const url = new URL(data.endpoint);
    const hosts = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
    if (url.protocol !== 'https:' || !hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new BadRequestException('Proveedor push no admitido.');
    await this.repository.subscribe(userId, data);
    return { message: 'Dispositivo registrado.' };
  }

  async notify(client: PoolClient, data: NotificationInput) {
    requireInternalPath(data.href);
    if (!await this.repository.activeMember(data.homeId, data.userId, client)) return;
    const id = await this.repository.insert(data, client);
    if (!id) return;
    const prefs = await this.repository.preferences(data.userId, client);
    if (prefs.email_enabled) await this.repository.delivery(id, 'email', client);
    if (prefs.push_enabled) await this.repository.delivery(id, 'push', client);
  }

  scheduleReminder(client: PoolClient, data: NotificationInput & { sourceKey: string; dueAt: Date }) {
    requireInternalPath(data.href);
    return this.repository.schedule(data, client);
  }
  cancelReminder(client: PoolClient, sourceKey: string) { return this.repository.cancel(sourceKey, client); }
  cancelHome(homeId: string, client: PoolClient) { return this.repository.cancelHome(homeId, client); }
}
