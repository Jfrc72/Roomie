import { ExecutionContext } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { OriginGuard } from '../src/common/origin.guard';
import { SessionGuard } from '../src/auth/session.guard';
import { AuthService } from '../src/auth/auth.service';
import { HomeGuard } from '../src/access/home.guard';
import { HomeAccessService } from '../src/access/home-access.service';
import { RegisterDto } from '../src/auth/auth.dto';
import { HomeDto, RoleDto } from '../src/homes/homes.dto';
import { PreferencesDto, SubscriptionDto } from '../src/notifications/notifications.dto';
import { hashPassword, hashToken, verifyPassword } from '../src/auth/passwords';
import { homeId, service, user } from './helpers';

const context = (request: object) => ({ switchToHttp: () => ({ getRequest: () => request }) }) as ExecutionContext;
const validation = (value: object) => validateSync(value, { whitelist: true, forbidNonWhitelisted: true });

describe('Validación de entradas', () => {
  const valid = { name: 'Juan', email: 'juan@roomie.test', password: 'ClaveDePrueba2026!' };
  it('normaliza el correo y el nombre sin cambiar la contraseña', () => {
    const dto = plainToInstance(RegisterDto, { ...valid, name: ' Juan ', email: ' JUAN@ROOMIE.TEST ' });
    expect(validation(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ name: 'Juan', email: 'juan@roomie.test', password: valid.password });
  });
  it.each(['corta', 'a'.repeat(129)])('rechaza una contraseña fuera de los límites', password => {
    expect(validation(plainToInstance(RegisterDto, { ...valid, password })).length).toBeGreaterThan(0);
  });
  it('rechaza correos inválidos', () => {
    expect(validation(plainToInstance(RegisterDto, { ...valid, email: 'incorrecto' })).length).toBeGreaterThan(0);
  });
  it('no permite introducir un rol por el formulario de registro', () => {
    expect(validation(plainToInstance(RegisterDto, { ...valid, role: 'admin' })).length).toBeGreaterThan(0);
  });
  it('permite omitir dirección y descripción al crear un hogar', () => {
    const dto = plainToInstance(HomeDto, { name: 'Apartamento 301' });
    expect(validation(dto)).toHaveLength(0); expect(dto.address).toBe(''); expect(dto.description).toBe('');
  });
  it('una dirección nula se rechaza antes de llegar a PostgreSQL', () => {
    expect(validation(plainToInstance(HomeDto, { name: 'Apartamento 301', address: null })).length).toBeGreaterThan(0);
  });
  it('no permite roles inventados', () => {
    expect(validation(plainToInstance(RoleDto, { role: 'superadmin' })).length).toBeGreaterThan(0);
  });
  it.each([-1, 169, 1.5])('rechaza anticipación inválida %s', reminder_hours => {
    expect(validation(plainToInstance(PreferencesDto, { email_enabled: false, push_enabled: false, reminder_hours })).length).toBeGreaterThan(0);
  });
  it('los canales necesitan booleanos, no cadenas como false', () => {
    expect(validation(plainToInstance(PreferencesDto, { email_enabled: 'false', push_enabled: false, reminder_hours: 24 })).length).toBeGreaterThan(0);
  });
  it('una suscripción push necesita sus claves', () => {
    expect(validation(plainToInstance(SubscriptionDto, { endpoint: 'https://fcm.googleapis.com/a' })).length).toBeGreaterThan(0);
  });
  it('acepta expirationTime null como lo envía PushSubscription.toJSON', () => {
    const dto = plainToInstance(SubscriptionDto, { endpoint: 'https://fcm.googleapis.com/a', expirationTime: null, keys: { auth: 'clave', p256dh: 'clave-publica' } });
    expect(validation(dto)).toHaveLength(0);
  });
});

describe('Cookies y permisos de las rutas', () => {
  const originalEnv = process.env;
  beforeEach(() => { process.env = { ...originalEnv, APP_URL: 'http://localhost:3000' }; });
  afterEach(() => { process.env = originalEnv; });
  it('permite lecturas sin exigir Origin', () => {
    expect(new OriginGuard().canActivate(context({ method: 'GET', headers: {} }))).toBe(true);
  });
  it('permite JSON desde el origen de la aplicación', () => {
    expect(new OriginGuard().canActivate(context({ method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' } }))).toBe(true);
  });
  it('rechaza escrituras desde otro origen aunque tengan una cookie', () => {
    expect(() => new OriginGuard().canActivate(context({ method: 'POST', headers: { origin: 'https://otro.example', cookie: 'roomie_session=algo' } }))).toThrow('Origen');
  });
  it('no trata un formulario de otro tipo como si fuera JSON', () => {
    expect(() => new OriginGuard().canActivate(context({ method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'text/plain' } }))).toThrow('JSON');
  });
  it('DELETE sin cuerpo sigue comprobando el origen', () => {
    expect(new OriginGuard().canActivate(context({ method: 'DELETE', headers: { origin: 'http://localhost:3000' } }))).toBe(true);
  });
  it('sin cookie no se consultan ni se entregan datos privados', async () => {
    const auth = { currentUser: jest.fn() };
    const guard = await service(SessionGuard, [{ provide: AuthService, useValue: auth }]);
    await expect(guard.canActivate(context({ headers: {} }))).rejects.toMatchObject({ status: 401 });
    expect(auth.currentUser).not.toHaveBeenCalled();
  });
  it('una cookie vencida no se convierte en una sesión válida', async () => {
    const guard = await service(SessionGuard, [{ provide: AuthService, useValue: { currentUser: jest.fn().mockResolvedValue(null) } }]);
    await expect(guard.canActivate(context({ headers: { cookie: 'roomie_session=vencida' } }))).rejects.toMatchObject({ status: 401 });
  });
  it('resuelve el usuario de la cookie aunque haya otras cookies', async () => {
    const auth = { currentUser: jest.fn().mockResolvedValue(user) };
    const guard = await service(SessionGuard, [{ provide: AuthService, useValue: auth }]);
    const request = { headers: { cookie: 'roomie_language=en; roomie_session=sesion' }, user: undefined as unknown };
    await guard.canActivate(context(request));
    expect(auth.currentUser).toHaveBeenCalledWith('sesion'); expect(request.user).toEqual(user);
  });
  it('el guard del hogar usa el usuario de sesión y el id de la ruta', async () => {
    const access = { requireHome: jest.fn() };
    const guard = await service(HomeGuard, [{ provide: HomeAccessService, useValue: access }]);
    await guard.canActivate(context({ user, params: { id: homeId }, query: {} }));
    expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId);
  });
});

describe('Hash de contraseñas y sesiones', () => {
  it('dos contraseñas iguales no se guardan con el mismo hash', async () => {
    const first = await hashPassword('ClaveDePrueba2026!'); const second = await hashPassword('ClaveDePrueba2026!');
    expect(first).not.toBe(second); expect(await verifyPassword('ClaveDePrueba2026!', first)).toBe(true);
  });
  it('una contraseña incorrecta no verifica', async () => {
    expect(await verifyPassword('incorrecta', await hashPassword('ClaveDePrueba2026!'))).toBe(false);
  });
  it.each(['', 'sin-sal', 'sal:hash-corto'])('un hash incompleto no rompe la aplicación', async stored => {
    expect(await verifyPassword('clave', stored)).toBe(false);
  });
  it('la base utiliza el hash de un token, no el token original', () => {
    expect(hashToken('sesion')).toMatch(/^[a-f0-9]{64}$/); expect(hashToken('sesion')).not.toBe('sesion');
  });
});
