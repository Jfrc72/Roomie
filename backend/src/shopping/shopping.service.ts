import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { SessionUser } from '../auth/auth.entity';
import { DatabaseService } from '../database/database.service';
import { hasChanges, requireHomeId } from '../common/params';
import { canManageRecord } from '../common/permissions.rules';
import { ShoppingItemDto, UpdateShoppingItemDto } from './shopping.dto';
import { ShoppingItem } from './shopping.entity';
import { ShoppingRepository } from './shopping.repository';
import { ShoppingDigest, ShoppingItemView } from './shopping.responses';
import { applyChanges, editsDetails, toItemView } from './shopping.rules';

type Action = 'editarlo' | 'eliminarlo' | 'restaurarlo';

@Injectable()
export class ShoppingService {
  constructor(
    private readonly repository: ShoppingRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
    private readonly activities: ActivitiesService,
  ) {}

  async list(userId: string, homeIdParam?: string): Promise<ShoppingItemView[]> {
    const homeId = requireHomeId(homeIdParam);
    const role = await this.access.requireHome(userId, homeId);
    return (await this.repository.list(homeId)).map(row => toItemView(row, role, userId));
  }

  /** Resumen para el inicio. No revisa el acceso: DashboardService ya comprobó la pertenencia al apartamento. */
  async summary(homeId: string): Promise<ShoppingDigest> {
    return { pending: await this.repository.pendingCount(homeId) };
  }

  async create(user: SessionUser, homeIdParam: string | undefined, data: ShoppingItemDto) {
    const homeId = requireHomeId(homeIdParam);
    await this.access.requireHome(user.id, homeId);
    return this.db.transaction(async client => {
      await this.access.lockHome(user.id, homeId, client, false);
      await this.requireBuyer(homeId, data.assigned_membership_id, client);
      const id = await this.repository.insert(homeId, user.id, data, client);
      await this.activities.add(homeId, user.id, `agregó "${data.title}" a la lista de compras`, client);
      return { id, message: 'Producto agregado.' };
    });
  }

  /**
   * Cualquier integrante puede marcar un producto como comprado o reactivarlo;
   * el resto de los datos solo los cambia quien lo agregó o un administrador.
   */
  async update(user: SessionUser, id: string, patch: UpdateShoppingItemDto) {
    if (!hasChanges(patch)) throw new BadRequestException('Indica qué deseas actualizar.');
    return this.db.transaction(async client => {
      const item = await this.repository.lock(id, false, client);
      if (!item) throw new NotFoundException('Producto no encontrado.');
      const role = await this.access.lockHome(user.id, item.home_id, client, false);
      if (editsDetails(patch) && !canManageRecord(role, item.added_by, user.id)) {
        throw new ForbiddenException('Solo quien agregó el producto o un administrador puede editarlo.');
      }
      await this.requireBuyer(item.home_id, patch.assigned_membership_id, client);
      const changes = applyChanges(item, patch, user.id);
      await this.repository.update(id, changes, client);
      if (patch.status) {
        await this.activities.add(item.home_id, user.id, `${changes.status === 'COMPRADO' ? 'marcó como comprado' : 'reactivó'} "${changes.title}"`, client);
      }
      return { message: 'Producto actualizado.' };
    });
  }

  remove(user: SessionUser, id: string) {
    return this.db.transaction(async client => {
      const item = await this.lockRecord(user, id, false, 'eliminarlo', client);
      await this.repository.setDeleted(id, true, client);
      await this.activities.add(item.home_id, user.id, `eliminó "${item.title}" de la lista de compras`, client);
      return { message: 'Producto eliminado.' };
    });
  }

  restore(user: SessionUser, id: string) {
    return this.db.transaction(async client => {
      const item = await this.lockRecord(user, id, true, 'restaurarlo', client);
      await this.repository.setDeleted(id, false, client);
      await this.activities.add(item.home_id, user.id, `restauró "${item.title}" en la lista de compras`, client);
      return { message: 'Producto restaurado.' };
    });
  }

  /** Bloquea el producto y luego su apartamento, siempre en ese orden, y comprueba permisos. */
  private async lockRecord(user: SessionUser, id: string, deleted: boolean, action: Action, client: PoolClient): Promise<ShoppingItem> {
    const item = await this.repository.lock(id, deleted, client);
    if (!item) throw new NotFoundException(deleted ? 'Producto eliminado no encontrado.' : 'Producto no encontrado.');
    const role = await this.access.lockHome(user.id, item.home_id, client, false);
    if (!canManageRecord(role, item.added_by, user.id)) {
      throw new ForbiddenException(`Solo quien agregó el producto o un administrador puede ${action}.`);
    }
    return item;
  }

  /** El comprador asignado es opcional, pero si se indica debe ser un integrante activo del apartamento. */
  private async requireBuyer(homeId: string, membershipId: string | null | undefined, client: PoolClient) {
    if (!membershipId) return;
    if (!await this.repository.isActiveMembership(homeId, membershipId, client)) {
      throw new BadRequestException('El comprador asignado debe pertenecer al apartamento.');
    }
  }
}
