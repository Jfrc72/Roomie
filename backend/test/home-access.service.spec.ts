import { HomeAccessRepository } from '../src/access/home-access.repository';
import { HomeAccessService } from '../src/access/home-access.service';
import { client, homeId, service, user } from './helpers';

describe('Permisos compartidos', () => {
  let access: HomeAccessService;
  const repo = { role: jest.fn(), lockHome: jest.fn(), canCloseAccount: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks(); repo.role.mockResolvedValue('member'); repo.canCloseAccount.mockResolvedValue(true);
    access = await service(HomeAccessService, [{ provide: HomeAccessRepository, useValue: repo }]);
  });
  it('HU1.1 rechaza un identificador inválido antes de consultar', async () => {
    await expect(access.requireHome(user.id, 'otro')).rejects.toMatchObject({ status: 400 });
    expect(repo.role).not.toHaveBeenCalled();
  });
  it('HU1.1 permite a un integrante consultar su hogar', async () => {
    expect(await access.requireHome(user.id, homeId)).toBe('member');
  });
  it('HU1.1 una persona ajena no accede al hogar', async () => {
    repo.role.mockResolvedValue(undefined);
    await expect(access.requireHome(user.id, homeId)).rejects.toMatchObject({ status: 403 });
  });
  it('HU1.4 un integrante no obtiene permisos de administrador', async () => {
    await expect(access.requireHome(user.id, homeId, true)).rejects.toMatchObject({ status: 403 });
  });
  it('HU1.4 reconoce el rol administrador', async () => {
    repo.role.mockResolvedValue('admin');
    expect(await access.requireHome(user.id, homeId, true)).toBe('admin');
  });
  it('HU1.4 bloquea el hogar y vuelve a revisar permisos dentro de la transacción', async () => {
    repo.role.mockResolvedValue('admin');
    await access.lockHome(user.id, homeId, client);
    expect(repo.lockHome).toHaveBeenCalledWith(homeId, client);
    expect(repo.role).toHaveBeenCalledWith(user.id, homeId, client);
  });
  it('HU1.4 no bloquea una fila si el identificador es inválido', async () => {
    await expect(access.lockHome(user.id, 'otro', client)).rejects.toMatchObject({ status: 400 });
    expect(repo.lockHome).not.toHaveBeenCalled();
  });
  it('HU10.3 permite cerrar una cuenta que no deja hogares sin administrador', async () => {
    await expect(access.requireAccountCanClose(user.id, client)).resolves.toBeUndefined();
  });
  it('HU10.3 rechaza cerrar la cuenta si deja un hogar sin administrador', async () => {
    repo.canCloseAccount.mockResolvedValue(false);
    await expect(access.requireAccountCanClose(user.id, client)).rejects.toMatchObject({ status: 409 });
  });
});
