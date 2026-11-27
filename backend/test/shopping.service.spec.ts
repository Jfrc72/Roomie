import { ForbiddenException } from '@nestjs/common';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { DatabaseService } from '../src/database/database.service';
import { ShoppingRepository } from '../src/shopping/shopping.repository';
import { ShoppingService } from '../src/shopping/shopping.service';
import { client, database, homeId, memberId, service, user } from './helpers';

const other = '00000000-0000-4000-8000-000000000002';
const itemId = '00000000-0000-4000-8000-000000000040';
const dto = (over: object = {}) => ({ title: 'Arroz', category: 'Alimentos', quantity: 2, estimated_price: 3.5, assigned_membership_id: null, ...over });
const stored = (over: object = {}) => ({
  id: itemId, home_id: homeId, title: 'Arroz', category: 'Alimentos', quantity: 2, estimated_price: '3.50', status: 'PENDIENTE',
  added_by: other, assigned_membership_id: null, bought_by: null, ...over,
});

describe('Lista de compras', () => {
  let shopping: ShoppingService;
  const repo = { list: jest.fn(), pendingCount: jest.fn(), lock: jest.fn(), isActiveMembership: jest.fn(), insert: jest.fn(), update: jest.fn(), setDeleted: jest.fn() };
  const access = { requireHome: jest.fn(), lockHome: jest.fn() };
  const activities = { add: jest.fn() };
  let db: ReturnType<typeof database>;

  beforeEach(async () => {
    jest.resetAllMocks();
    access.requireHome.mockResolvedValue('member');
    access.lockHome.mockResolvedValue('member');
    repo.insert.mockResolvedValue(itemId);
    repo.isActiveMembership.mockResolvedValue(true);
    repo.list.mockResolvedValue([]);
    db = database();
    shopping = await service(ShoppingService, [
      { provide: ShoppingRepository, useValue: repo }, { provide: DatabaseService, useValue: db },
      { provide: HomeAccessService, useValue: access }, { provide: ActivitiesService, useValue: activities },
    ]);
  });

  describe('HU4.1 agregar productos', () => {
    it('HU4.1 guarda cantidad, precio y comprador válidos y devuelve el id', async () => {
      const data = dto({ assigned_membership_id: memberId });
      await expect(shopping.create(user, homeId, data as never)).resolves.toEqual({ id: itemId, message: 'Producto agregado.' });
      expect(repo.isActiveMembership).toHaveBeenCalledWith(homeId, memberId, client);
      expect(repo.insert).toHaveBeenCalledWith(homeId, user.id, data, client);
      expect(access.lockHome).toHaveBeenCalledWith(user.id, homeId, client, false);
    });
    it('HU4.1 el comprador es opcional: sin él no se consultan membresías', async () => {
      await shopping.create(user, homeId, dto() as never);
      await shopping.create(user, homeId, dto({ assigned_membership_id: undefined }) as never);
      expect(repo.isActiveMembership).not.toHaveBeenCalled();
      expect(repo.insert).toHaveBeenCalledTimes(2);
    });
    it('HU4.1 rechaza asignar a un comprador ajeno al hogar y no guarda nada', async () => {
      repo.isActiveMembership.mockResolvedValue(false);
      await expect(shopping.create(user, homeId, dto({ assigned_membership_id: memberId }) as never))
        .rejects.toMatchObject({ status: 400, message: 'El comprador asignado debe pertenecer al apartamento.' });
      expect(repo.insert).not.toHaveBeenCalled();
      expect(activities.add).not.toHaveBeenCalled();
    });
    it('HU4.1 registra la actividad con el nombre del producto', async () => {
      await shopping.create(user, homeId, dto() as never);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'agregó "Arroz" a la lista de compras', client);
    });
    it('HU4.1 una persona de fuera no agrega productos ni ve la lista', async () => {
      access.requireHome.mockRejectedValue(new ForbiddenException('No tienes acceso a este apartamento.'));
      await expect(shopping.create(user, homeId, dto() as never)).rejects.toMatchObject({ status: 403 });
      await expect(shopping.list(user.id, homeId)).rejects.toMatchObject({ status: 403 });
      expect(db.transaction).not.toHaveBeenCalled();
      expect(repo.list).not.toHaveBeenCalled();
    });
    it('HU4.1 la lista convierte cantidad y precio a número e indica qué productos puede editar', async () => {
      repo.list.mockResolvedValue([
        { id: 'a', quantity: 2, estimated_price: '8500.00', added_by: user.id },
        { id: 'b', quantity: 1, estimated_price: '0.00', added_by: other },
      ]);
      const items = await shopping.list(user.id, homeId);
      expect(items.map(item => [item.quantity, item.estimated_price, item.can_edit])).toEqual([[2, 8500, true], [1, 0, false]]);
    });
    it('HU4.1 exige indicar el apartamento y el resumen del inicio cuenta los pendientes', async () => {
      await expect(shopping.list(user.id, undefined)).rejects.toMatchObject({ status: 400, message: 'Selecciona un apartamento.' });
      repo.pendingCount.mockResolvedValue(4);
      await expect(shopping.summary(homeId)).resolves.toEqual({ pending: 4 });
    });
  });

  describe('HU4.2 marcar productos comprados', () => {
    it('HU4.2 permite marcar comprado un producto ajeno e identifica al comprador', async () => {
      repo.lock.mockResolvedValue(stored());
      await shopping.update(user, itemId, { status: 'COMPRADO' });
      expect(repo.update).toHaveBeenCalledWith(itemId, expect.objectContaining({ status: 'COMPRADO', bought_by: user.id, title: 'Arroz', quantity: 2, estimated_price: '3.50' }), client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'marcó como comprado "Arroz"', client);
    });
    it('HU4.2 conserva a quien ya lo compró si otra persona vuelve a marcarlo', async () => {
      repo.lock.mockResolvedValue(stored({ status: 'COMPRADO', bought_by: other }));
      await shopping.update(user, itemId, { status: 'COMPRADO' });
      expect(repo.update.mock.calls[0][1].bought_by).toBe(other);
    });
    it('HU4.2 reactivar un producto comprado borra al comprador y queda en la actividad', async () => {
      repo.lock.mockResolvedValue(stored({ status: 'COMPRADO', bought_by: other }));
      await shopping.update(user, itemId, { status: 'PENDIENTE' });
      expect(repo.update).toHaveBeenCalledWith(itemId, expect.objectContaining({ status: 'PENDIENTE', bought_by: null }), client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'reactivó "Arroz"', client);
    });
    it('HU4.2 cambiar solo el estado no exige ser autor ni administrador', async () => {
      repo.lock.mockResolvedValue(stored({ added_by: other }));
      await expect(shopping.update(user, itemId, { status: 'COMPRADO' })).resolves.toEqual({ message: 'Producto actualizado.' });
      expect(access.lockHome).toHaveBeenCalledWith(user.id, homeId, client, false);
    });
    it('HU4.2 rechaza un cuerpo vacío sin abrir la transacción', async () => {
      await expect(shopping.update(user, itemId, {})).rejects.toMatchObject({ status: 400, message: 'Indica qué deseas actualizar.' });
      await expect(shopping.update(user, itemId, { title: undefined })).rejects.toMatchObject({ status: 400 });
      expect(db.transaction).not.toHaveBeenCalled();
    });
  });

  describe('HU4.3 editar, eliminar y restaurar productos', () => {
    it('HU4.3 el autor corrige cantidad y precio conservando el resto', async () => {
      repo.lock.mockResolvedValue(stored({ added_by: user.id }));
      await shopping.update(user, itemId, { quantity: 3, estimated_price: 4.25 });
      expect(repo.update).toHaveBeenCalledWith(itemId, {
        title: 'Arroz', category: 'Alimentos', quantity: 3, estimated_price: '4.25', status: 'PENDIENTE', bought_by: null, assigned_membership_id: null,
      }, client);
      expect(activities.add).not.toHaveBeenCalled();
    });
    it('HU4.3 impide que otro integrante edite los datos de un producto ajeno', async () => {
      repo.lock.mockResolvedValue(stored());
      await expect(shopping.update(user, itemId, { quantity: 4 })).rejects.toMatchObject({ status: 403, message: 'Solo quien agregó el producto o un administrador puede editarlo.' });
      expect(repo.update).not.toHaveBeenCalled();
    });
    it('HU4.3 un administrador edita los datos de un producto ajeno', async () => {
      access.lockHome.mockResolvedValue('admin');
      repo.lock.mockResolvedValue(stored());
      await expect(shopping.update(user, itemId, { title: 'Arroz integral' })).resolves.toEqual({ message: 'Producto actualizado.' });
      expect(repo.update.mock.calls[0][1].title).toBe('Arroz integral');
    });
    it('HU4.3 reasignar valida el comprador y null quita la asignación sin consultar', async () => {
      repo.lock.mockResolvedValue(stored({ added_by: user.id, assigned_membership_id: memberId }));
      await shopping.update(user, itemId, { assigned_membership_id: null });
      expect(repo.isActiveMembership).not.toHaveBeenCalled();
      expect(repo.update.mock.calls[0][1].assigned_membership_id).toBeNull();
      repo.isActiveMembership.mockResolvedValue(false);
      await expect(shopping.update(user, itemId, { assigned_membership_id: other })).rejects.toMatchObject({ status: 400 });
    });
    it('HU4.3 impide que otro integrante elimine el producto', async () => {
      repo.lock.mockResolvedValue(stored());
      await expect(shopping.remove(user, itemId)).rejects.toMatchObject({ status: 403, message: 'Solo quien agregó el producto o un administrador puede eliminarlo.' });
      expect(repo.setDeleted).not.toHaveBeenCalled();
    });
    it('HU4.3 elimina de forma lógica y registra la actividad', async () => {
      repo.lock.mockResolvedValue(stored({ added_by: user.id }));
      await expect(shopping.remove(user, itemId)).resolves.toEqual({ message: 'Producto eliminado.' });
      expect(repo.setDeleted).toHaveBeenCalledWith(itemId, true, client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'eliminó "Arroz" de la lista de compras', client);
    });
    it('HU4.3 un administrador restaura un producto eliminado por otro integrante', async () => {
      access.lockHome.mockResolvedValue('admin');
      repo.lock.mockResolvedValue(stored());
      await expect(shopping.restore(user, itemId)).resolves.toEqual({ message: 'Producto restaurado.' });
      expect(repo.lock).toHaveBeenCalledWith(itemId, true, client);
      expect(repo.setDeleted).toHaveBeenCalledWith(itemId, false, client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'restauró "Arroz" en la lista de compras', client);
    });
    it('HU4.3 un integrante no restaura el producto de otra persona', async () => {
      repo.lock.mockResolvedValue(stored());
      await expect(shopping.restore(user, itemId)).rejects.toMatchObject({ status: 403, message: 'Solo quien agregó el producto o un administrador puede restaurarlo.' });
    });
    it('HU4.3 un producto inexistente da 404 con el mensaje de cada caso', async () => {
      repo.lock.mockResolvedValue(null);
      await expect(shopping.update(user, itemId, { quantity: 1 })).rejects.toMatchObject({ status: 404, message: 'Producto no encontrado.' });
      await expect(shopping.remove(user, itemId)).rejects.toMatchObject({ status: 404, message: 'Producto no encontrado.' });
      await expect(shopping.restore(user, itemId)).rejects.toMatchObject({ status: 404, message: 'Producto eliminado no encontrado.' });
      expect(access.lockHome).not.toHaveBeenCalled();
    });
  });
});
