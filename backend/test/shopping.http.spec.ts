import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ForbiddenException } from '@nestjs/common';
import { ShoppingController } from '../src/shopping/shopping.controller';
import { ShoppingItemDto, UpdateShoppingItemDto } from '../src/shopping/shopping.dto';
import { ShoppingService } from '../src/shopping/shopping.service';
import { homeId, user } from './helpers';
import { startApi, TestApi } from './http-app';

const membership = '00000000-0000-4000-8000-000000000030';
const itemId = '00000000-0000-4000-8000-000000000040';
const validation = (type: new () => object, value: object) => validateSync(plainToInstance(type, value), { whitelist: true, forbidNonWhitelisted: true });
const item = (over: object = {}) => ({ title: 'Jabón de loza', category: 'Limpieza', quantity: 2, estimated_price: 8500, assigned_membership_id: membership, ...over });

describe('Validación de productos', () => {
  it('acepta un producto completo y uno con solo lo obligatorio', () => {
    expect(validation(ShoppingItemDto, item())).toHaveLength(0);
    expect(validation(ShoppingItemDto, { title: 'Esponjas', category: 'Limpieza', quantity: 1 })).toHaveLength(0);
    expect(validation(ShoppingItemDto, item({ assigned_membership_id: null, estimated_price: 0 }))).toHaveLength(0);
  });
  it('quita los espacios del nombre', () => {
    expect(plainToInstance(ShoppingItemDto, item({ title: '  Jabón  ' })).title).toBe('Jabón');
  });
  it.each([0, -1, 1.5, 10000, '2', null])('rechaza la cantidad %s', quantity => {
    expect(validation(ShoppingItemDto, item({ quantity })).length).toBeGreaterThan(0);
  });
  it.each([-1, 1.005, 10000000000, '100', null])('rechaza el precio %s', estimated_price => {
    expect(validation(ShoppingItemDto, item({ estimated_price })).length).toBeGreaterThan(0);
  });
  it.each([[{ title: 'a' }], [{ title: '' }], [{ category: '' }], [{ category: 'x'.repeat(51) }], [{ assigned_membership_id: 'no-es-uuid' }], [{ owner: 'x' }]])('rechaza %j', over => {
    expect(validation(ShoppingItemDto, item(over)).length).toBeGreaterThan(0);
  });
  it('la actualización acepta cambios parciales, rechaza null donde no corresponde y permite quitar el comprador', () => {
    expect(validation(UpdateShoppingItemDto, { quantity: 3 })).toHaveLength(0);
    expect(validation(UpdateShoppingItemDto, { assigned_membership_id: null })).toHaveLength(0);
    expect(validation(UpdateShoppingItemDto, { status: 'COMPRADO' })).toHaveLength(0);
    expect(validation(UpdateShoppingItemDto, {})).toHaveLength(0);
    for (const bad of [{ title: null }, { quantity: null }, { status: 'PERDIDO' }, { status: null }, { estimated_price: null }, { x: 1 }]) {
      expect(validation(UpdateShoppingItemDto, bad).length).toBeGreaterThan(0);
    }
  });
});

describe('Rutas HTTP de la lista de compras', () => {
  const shopping = { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), restore: jest.fn() };
  let api: TestApi;
  beforeEach(() => { jest.resetAllMocks(); });
  beforeAll(async () => { api = await startApi([ShoppingController], [{ provide: ShoppingService, useValue: shopping }]); });
  afterAll(() => api.close());

  it('GET /shopping entrega la lista dentro de {data}', async () => {
    shopping.list.mockResolvedValue([{ id: itemId }]);
    expect(await api.call(`/shopping?homeId=${homeId}`)).toEqual({ status: 200, body: { data: [{ id: itemId }] } });
    expect(shopping.list).toHaveBeenCalledWith(user.id, homeId);
  });
  it('POST /shopping responde 200 y entrega al servicio los datos limpios', async () => {
    shopping.create.mockResolvedValue({ id: itemId, message: 'Producto agregado.' });
    const reply = await api.call(`/shopping?homeId=${homeId}`, 'POST', item({ title: '  Jabón de loza ' }));
    expect(reply).toEqual({ status: 200, body: { data: { id: itemId, message: 'Producto agregado.' } } });
    expect(shopping.create).toHaveBeenCalledWith(user, homeId, expect.objectContaining({ title: 'Jabón de loza', quantity: 2 }));
  });
  it.each([['cantidad cero', { quantity: 0 }], ['precio con fracciones de centavo', { estimated_price: 1.005 }], ['un comprador que no es UUID', { assigned_membership_id: 'x' }], ['un campo inexistente', { status: 'COMPRADO' }]])('POST /shopping rechaza %s con 400', async (_name, over) => {
    expect((await api.call(`/shopping?homeId=${homeId}`, 'POST', item(over))).status).toBe(400);
    expect(shopping.create).not.toHaveBeenCalled();
  });
  it('PATCH /shopping/:id acepta cambios parciales y rechaza identificadores inválidos', async () => {
    shopping.update.mockResolvedValue({ message: 'Producto actualizado.' });
    expect((await api.call(`/shopping/${itemId}`, 'PATCH', { status: 'COMPRADO' })).body).toEqual({ data: { message: 'Producto actualizado.' } });
    expect(shopping.update).toHaveBeenCalledWith(user, itemId, expect.objectContaining({ status: 'COMPRADO' }));
    expect(await api.call('/shopping/no-es-un-uuid', 'PATCH', { status: 'COMPRADO' })).toEqual({ status: 400, body: { error: 'Identificador inválido.' } });
    expect((await api.call(`/shopping/${itemId}`, 'PATCH', { status: 'PERDIDO' })).status).toBe(400);
  });
  it('DELETE y restore responden 200, y los errores del servicio llegan como {error}', async () => {
    shopping.remove.mockResolvedValue({ message: 'Producto eliminado.' });
    shopping.restore.mockRejectedValue(new ForbiddenException('Solo quien agregó el producto o un administrador puede restaurarlo.'));
    expect((await api.call(`/shopping/${itemId}`, 'DELETE')).status).toBe(200);
    expect(await api.call(`/shopping/${itemId}/restore`, 'POST', {})).toEqual({ status: 403, body: { error: 'Solo quien agregó el producto o un administrador puede restaurarlo.' } });
  });
  it('sin sesión todas las rutas responden 401 sin llegar al servicio', async () => {
    const anonymous = await startApi([ShoppingController], [{ provide: ShoppingService, useValue: shopping }], null);
    try {
      expect((await anonymous.call(`/shopping?homeId=${homeId}`)).status).toBe(401);
      expect((await anonymous.call(`/shopping/${itemId}`, 'DELETE')).status).toBe(401);
      expect(shopping.list).not.toHaveBeenCalled();
      expect(shopping.remove).not.toHaveBeenCalled();
    } finally {
      await anonymous.close();
    }
  });
});
