import { NotificationsService } from '../src/notifications/notifications.service';
import { NotificationsRepository } from '../src/notifications/notifications.repository';
import { DatabaseService } from '../src/database/database.service';
import { HomeAccessService } from '../src/access/home-access.service';
import { client, database, homeId, service, user } from './helpers';

describe('Notificaciones y preferencias', () => {
  let notifications: NotificationsService;
  const originalEnv = process.env;
  const prefs = { email_enabled: false, push_enabled: false, reminder_hours: 24 };
  const input = { homeId, userId: user.id, title: 'Tarea asignada', message: 'Revisar la tarea', href: '/tareas', sourceKey: 'tarea:1' };
  const repo = { preferences: jest.fn(), savePreferences: jest.fn(), list: jest.fn(), find: jest.fn(), dismiss: jest.fn(), read: jest.fn(), subscribe: jest.fn(), activeMember: jest.fn(), insert: jest.fn(), delivery: jest.fn(), schedule: jest.fn(), cancel: jest.fn(), cancelHome: jest.fn() };
  const access = { requireHome: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks(); process.env = { ...originalEnv };
    for (const key of ['SMTP_HOST', 'SMTP_FROM', 'VAPID_PRIVATE_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_SUBJECT']) delete process.env[key];
    repo.preferences.mockResolvedValue(prefs); repo.list.mockResolvedValue([]); repo.find.mockResolvedValue({ home_id: homeId });
    repo.activeMember.mockResolvedValue(true); repo.insert.mockResolvedValue('aviso-1');
    notifications = await service(NotificationsService, [
      { provide: NotificationsRepository, useValue: repo }, { provide: DatabaseService, useValue: database() }, { provide: HomeAccessService, useValue: access },
    ]);
  });
  afterEach(() => { process.env = originalEnv; });
  it('HU7.2 indica que los canales sin credenciales todavía no están disponibles', async () => {
    expect(await notifications.preferences(user.id)).toMatchObject({ ...prefs, emailAvailable: false, pushAvailable: false });
  });
  it('HU7.2 permite guardar preferencias con los canales desactivados', async () => {
    await notifications.savePreferences(user.id, { ...prefs, reminder_hours: 6 });
    expect(repo.savePreferences).toHaveBeenCalledWith(user.id, { ...prefs, reminder_hours: 6 });
  });
  it('HU7.2 no activa correo si el servidor no está configurado', async () => {
    await expect(notifications.savePreferences(user.id, { ...prefs, email_enabled: true })).rejects.toMatchObject({ status: 400 });
    expect(repo.savePreferences).not.toHaveBeenCalled();
  });
  it('HU7.2 no activa push si falta la configuración', async () => {
    await expect(notifications.savePreferences(user.id, { ...prefs, push_enabled: true })).rejects.toMatchObject({ status: 400 });
  });
  it('HU7.2 reconoce correo y push configurados sin revelar sus claves', async () => {
    Object.assign(process.env, { SMTP_HOST: 'smtp.example.test', SMTP_FROM: 'roomie@example.test', VAPID_PRIVATE_KEY: 'privada', NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'publica', VAPID_SUBJECT: 'mailto:a@example.test' });
    await notifications.savePreferences(user.id, { ...prefs, email_enabled: true, push_enabled: true });
    const result = await notifications.preferences(user.id);
    expect(result).toMatchObject({ emailAvailable: true, pushAvailable: true });
    expect(JSON.stringify(result)).not.toContain('privada');
  });
  it('HU7.1 una cuenta sin hogar activo recibe una bandeja vacía', async () => {
    expect(await notifications.list(user.id)).toEqual([]);
    expect(repo.list).not.toHaveBeenCalled();
  });
  it('HU7.1 solo consulta los avisos del usuario y hogar autorizados', async () => {
    await notifications.list(user.id, homeId);
    expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId);
    expect(repo.list).toHaveBeenCalledWith(user.id, homeId);
  });
  it('HU7.1 no permite consultar avisos de un hogar ajeno', async () => {
    access.requireHome.mockRejectedValue(new Error('Sin permiso'));
    await expect(notifications.list(user.id, homeId)).rejects.toThrow('Sin permiso');
    expect(repo.list).not.toHaveBeenCalled();
  });
  it.each([true, false])('HU7.1 marca el aviso con leído=%s', async read => {
    await notifications.change(user.id, 'aviso', read);
    expect(repo.read).toHaveBeenCalledWith(user.id, 'aviso', read, client);
  });
  it('HU7.1 elimina de la bandeja y cancela entregas en una misma transacción', async () => {
    await notifications.change(user.id, 'aviso', null);
    expect(repo.dismiss).toHaveBeenCalledWith(user.id, 'aviso', client);
    expect(repo.read).not.toHaveBeenCalled();
  });
  it('HU7.1 no modifica avisos ajenos o ya eliminados', async () => {
    repo.find.mockResolvedValue(null);
    await expect(notifications.change(user.id, 'aviso-ajeno', true)).rejects.toMatchObject({ status: 404 });
    expect(repo.read).not.toHaveBeenCalled();
  });
  it('HU7.3 no crea avisos para integrantes retirados', async () => {
    repo.activeMember.mockResolvedValue(false);
    await notifications.notify(client, input);
    expect(repo.insert).not.toHaveBeenCalled();
  });
  it('HU7.3 un aviso repetido no vuelve a programar entregas', async () => {
    repo.insert.mockResolvedValue(undefined);
    await notifications.notify(client, input);
    expect(repo.delivery).not.toHaveBeenCalled();
  });
  it('HU7.3 no crea entregas externas si ambos canales están desactivados', async () => {
    await notifications.notify(client, input);
    expect(repo.insert).toHaveBeenCalledWith(input, client);
    expect(repo.delivery).not.toHaveBeenCalled();
  });
  it('HU7.3 crea entregas solo en los canales elegidos por la persona', async () => {
    repo.preferences.mockResolvedValue({ ...prefs, email_enabled: true, push_enabled: true });
    await notifications.notify(client, input);
    expect(repo.delivery.mock.calls).toEqual([['aviso-1', 'email', client], ['aviso-1', 'push', client]]);
  });
  it.each(['https://otro.test', '//otro.test', '/\\otro.test', '/tareas\n'])('HU7.3 rechaza enlaces inseguros %s', async href => {
    await expect(notifications.notify(client, { ...input, href })).rejects.toMatchObject({ status: 400 });
  });
  it('HU7.3 programa un recordatorio con una clave reutilizable y la misma transacción', async () => {
    const reminder = { ...input, dueAt: new Date('2099-01-01') };
    await notifications.scheduleReminder(client, reminder);
    expect(repo.schedule).toHaveBeenCalledWith(reminder, client);
  });
  it('HU7.3 también comprueba la ruta del recordatorio', () => {
    expect(() => notifications.scheduleReminder(client, { ...input, href: '//otro.test', dueAt: new Date() })).toThrow('ruta interna');
  });
  it('HU7.3 permite cancelar el recordatorio de una tarea o reserva', async () => {
    await notifications.cancelReminder(client, input.sourceKey);
    expect(repo.cancel).toHaveBeenCalledWith(input.sourceKey, client);
  });
  it('HU7.3 archivar un hogar cancela sus recordatorios y entregas', async () => {
    await notifications.cancelHome(homeId, client);
    expect(repo.cancelHome).toHaveBeenCalledWith(homeId, client);
  });
  it.each(['http://fcm.googleapis.com/a', 'https://otro.test/a', 'https://fcm.googleapis.com.otro.test/a'])('HU7.2 rechaza endpoints push no permitidos %s', async endpoint => {
    await expect(notifications.subscribe(user.id, { endpoint, keys: { p256dh: 'clave', auth: 'auth' } })).rejects.toMatchObject({ status: 400 });
    expect(repo.subscribe).not.toHaveBeenCalled();
  });
  it('HU7.2 registra una suscripción del usuario para un proveedor permitido', async () => {
    const data = { endpoint: 'https://fcm.googleapis.com/fcm/send/dispositivo', keys: { p256dh: 'clave', auth: 'auth' } };
    await notifications.subscribe(user.id, data);
    expect(repo.subscribe).toHaveBeenCalledWith(user.id, data);
  });
});
