import { DatabaseService } from '../src/database/database.service';

const fakeClient = { query: jest.fn(), release: jest.fn() };
const fakePool = { query: jest.fn(), connect: jest.fn(), end: jest.fn(), on: jest.fn() };
jest.mock('pg', () => ({ Pool: jest.fn(() => fakePool) }));

describe('Conexión y transacciones', () => {
  let db: DatabaseService;
  beforeEach(() => {
    jest.clearAllMocks(); fakePool.connect.mockResolvedValue(fakeClient); fakeClient.query.mockResolvedValue({ rows: [] });
    fakePool.query.mockResolvedValue({ rows: [{ value: 1 }] }); db = new DatabaseService();
  });
  it('consulta con parámetros y devuelve las filas', async () => {
    expect(await db.query('SELECT $1 AS value', [1])).toEqual([{ value: 1 }]);
    expect(fakePool.query).toHaveBeenCalledWith('SELECT $1 AS value', [1]);
  });
  it('una consulta dentro de la transacción utiliza el cliente recibido', async () => {
    await db.transaction(client => db.query('SELECT 1', [], client));
    expect(fakeClient.query).toHaveBeenCalledWith('SELECT 1', []);
  });
  it('confirma los cambios y libera el cliente cuando la operación sale bien', async () => {
    expect(await db.transaction(async () => 'guardado')).toBe('guardado');
    expect(fakeClient.query.mock.calls).toEqual([['BEGIN'], ['COMMIT']]);
    expect(fakeClient.release).toHaveBeenCalledTimes(1);
  });
  it('revierte todos los cambios y libera el cliente si falla la operación', async () => {
    await expect(db.transaction(async () => { throw new Error('No se pudo guardar'); })).rejects.toThrow('No se pudo guardar');
    expect(fakeClient.query.mock.calls).toEqual([['BEGIN'], ['ROLLBACK']]);
    expect(fakeClient.release).toHaveBeenCalledTimes(1);
  });
  it('libera el cliente aunque falle la confirmación', async () => {
    fakeClient.query.mockImplementation(async sql => { if (sql === 'COMMIT') throw new Error('Conexión perdida'); return { rows: [] }; });
    await expect(db.transaction(async () => 'guardado')).rejects.toThrow('Conexión perdida');
    expect(fakeClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(fakeClient.release).toHaveBeenCalledTimes(1);
  });
  it('cierra el pool al apagar la aplicación', async () => {
    await db.onModuleDestroy();
    expect(fakePool.end).toHaveBeenCalledTimes(1);
  });
});
