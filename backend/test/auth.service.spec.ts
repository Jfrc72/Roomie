import { AuthService } from '../src/auth/auth.service';
import { AuthRepository } from '../src/auth/auth.repository';
import { DatabaseService } from '../src/database/database.service';
import { HomeAccessService } from '../src/access/home-access.service';
import { hashPassword, hashToken, verifyPassword } from '../src/auth/passwords';
import { client, database, homeId, service, user } from './helpers';

describe('Cuentas y sesiones', () => {
  let auth: AuthService;
  let passwordHash: string;
  let repo: ReturnType<typeof repository>;
  let access: { requireAccountCanClose: jest.Mock };
  function repository() { return {
    create: jest.fn().mockResolvedValue({ id: user.id }), createSession: jest.fn(), countAttempt: jest.fn().mockResolvedValue(1),
    findByEmail: jest.fn().mockImplementation(() => ({ ...user, password_hash: passwordHash })), clearAttempts: jest.fn(),
    currentUser: jest.fn().mockResolvedValue(user), homesFor: jest.fn().mockResolvedValue([]), logout: jest.fn(), rename: jest.fn(),
    passwordFor: jest.fn().mockImplementation(() => passwordHash), changePassword: jest.fn(), closeAccount: jest.fn(),
  }; }
  beforeAll(async () => { passwordHash = await hashPassword('ClaveDePrueba2026!'); });
  beforeEach(async () => {
    repo = repository(); access = { requireAccountCanClose: jest.fn() };
    auth = await service(AuthService, [
      { provide: AuthRepository, useValue: repo }, { provide: DatabaseService, useValue: database() },
      { provide: HomeAccessService, useValue: access },
    ]);
  });

  it('HU10.1 registra una cuenta con hash y crea la sesión dentro de la transacción', async () => {
    const value = await auth.register({ name: 'Juan', email: user.email, password: 'ClaveDePrueba2026!' });
    const stored = repo.create.mock.calls[0][2];
    expect(stored).not.toBe('ClaveDePrueba2026!');
    expect(await verifyPassword('ClaveDePrueba2026!', stored)).toBe(true);
    expect(repo.createSession).toHaveBeenCalledWith(user.id, hashToken(value), client);
  });
  it('HU10.1 no crea sesión si falla el registro', async () => {
    repo.create.mockRejectedValue(new Error('Correo repetido'));
    await expect(auth.register({ ...user, password: 'ClaveDePrueba2026!' })).rejects.toThrow('Correo repetido');
    expect(repo.createSession).not.toHaveBeenCalled();
  });
  it('HU10.1 inicia sesión con credenciales válidas y limpia los intentos anteriores', async () => {
    const value = await auth.login(user.email, 'ClaveDePrueba2026!');
    expect(repo.createSession).toHaveBeenCalledWith(user.id, hashToken(value));
    expect(repo.clearAttempts).toHaveBeenCalledWith(user.email);
  });
  it('HU10.1 rechaza una contraseña incorrecta sin crear sesión', async () => {
    await expect(auth.login(user.email, 'OtraClave')).rejects.toMatchObject({ status: 401 });
    expect(repo.createSession).not.toHaveBeenCalled();
  });
  it('HU10.1 no distingue un correo inexistente de una contraseña incorrecta', async () => {
    repo.findByEmail.mockResolvedValue(null);
    await expect(auth.login('noexiste@roomie.test', 'ClaveDePrueba2026!')).rejects.toThrow('Correo o contraseña incorrectos.');
  });
  it('HU10.1 limita los intentos antes de consultar la contraseña', async () => {
    repo.countAttempt.mockResolvedValue(11);
    await expect(auth.login(user.email, 'ClaveDePrueba2026!')).rejects.toMatchObject({ status: 429 });
    expect(repo.findByEmail).not.toHaveBeenCalled();
  });
  it('HU10.1 rechaza cookies con formato inválido', async () => {
    expect(await auth.currentUser('cookie-inventada')).toBeNull();
    expect(repo.currentUser).not.toHaveBeenCalled();
  });
  it('HU10.1 consulta la sesión mediante hash y nunca con el token sin procesar', async () => {
    const value = 'a'.repeat(64);
    await auth.currentUser(value);
    expect(repo.currentUser).toHaveBeenCalledWith(hashToken(value));
  });
  it('HU10.1 solo devuelve el perfil público y el hogar autorizado', async () => {
    repo.homesFor.mockResolvedValue([{ id: homeId }]);
    const result = await auth.session({ ...user, active_home_id: homeId });
    expect(result).toMatchObject({ user: { id: user.id, name: 'Juan', email: user.email }, activeHomeId: homeId });
    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.user).not.toHaveProperty('sessionHash');
  });
  it('la sesión cambia a un hogar permitido si el anterior ya no está disponible', async () => {
    repo.homesFor.mockResolvedValue([{ id: homeId }]);
    expect((await auth.session(user)).activeHomeId).toBe(homeId);
  });
  it('una cuenta sin hogares recibe hogar activo nulo', async () => {
    expect((await auth.session(user)).activeHomeId).toBeNull();
  });
  it('HU10.2 cerrar sesión invalida solo la sesión actual', async () => {
    await auth.logout(user);
    expect(repo.logout).toHaveBeenCalledWith(user.sessionHash);
  });
  it('HU10.2 no informa cierre exitoso si falla la persistencia', async () => {
    repo.logout.mockRejectedValue(new Error('Sin conexión'));
    await expect(auth.logout(user)).rejects.toThrow('Sin conexión');
  });
  it('HU10.3 actualiza únicamente el perfil del usuario conectado', async () => {
    await auth.profile(user, 'Nombre actualizado');
    expect(repo.rename).toHaveBeenCalledWith(user.id, 'Nombre actualizado');
  });
  it('HU10.3 cambiar contraseña invalida las anteriores y crea otra sesión', async () => {
    const value = await auth.changePassword(user, 'ClaveDePrueba2026!', 'NuevaClave2026!');
    expect(await verifyPassword('NuevaClave2026!', repo.changePassword.mock.calls[0][1])).toBe(true);
    expect(repo.createSession).toHaveBeenCalledWith(user.id, hashToken(value), client);
  });
  it('HU10.3 exige la contraseña actual antes de cambiarla', async () => {
    await expect(auth.changePassword(user, 'Incorrecta', 'NuevaClave2026!')).rejects.toMatchObject({ status: 400 });
    expect(repo.changePassword).not.toHaveBeenCalled();
  });
  it('HU10.3 no cambia una cuenta que dejó de estar activa', async () => {
    repo.passwordFor.mockResolvedValue(undefined);
    await expect(auth.changePassword(user, 'ClaveDePrueba2026!', 'NuevaClave2026!')).rejects.toMatchObject({ status: 400 });
  });
  it('HU10.3 cierra la cuenta después de comprobar que no deja un hogar sin administrador', async () => {
    await auth.closeAccount(user, 'ClaveDePrueba2026!');
    expect(access.requireAccountCanClose).toHaveBeenCalledWith(user.id, client);
    expect(repo.closeAccount).toHaveBeenCalledWith(user.id, client);
  });
  it('HU10.3 impide cerrar la cuenta del último administrador', async () => {
    access.requireAccountCanClose.mockRejectedValue(new Error('Último administrador'));
    await expect(auth.closeAccount(user, 'ClaveDePrueba2026!')).rejects.toThrow('Último administrador');
    expect(repo.closeAccount).not.toHaveBeenCalled();
  });
  it('HU10.3 exige contraseña actual al cerrar la cuenta', async () => {
    await expect(auth.closeAccount(user, 'Incorrecta')).rejects.toMatchObject({ status: 400 });
    expect(repo.closeAccount).not.toHaveBeenCalled();
  });
});
