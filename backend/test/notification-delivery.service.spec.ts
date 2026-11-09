import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { NotificationDeliveryService } from '../src/jobs/notification-delivery.service';
import { PendingDelivery } from '../src/jobs/jobs.repository';
import { PushSubscription } from '../src/notifications/notifications.entity';

jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: jest.fn() } }));
jest.mock('web-push', () => ({ __esModule: true, default: { setVapidDetails: jest.fn(), sendNotification: jest.fn() } }));

describe('Canales de notificaciones', () => {
  const originalEnv = process.env;
  const row = { title: 'Tarea asignada', message: 'Revisar la tarea', email: 'a@roomie.test', href: '/tareas' } as PendingDelivery;
  const subscription = { endpoint: 'https://fcm.googleapis.com/a', p256dh: 'publica', auth: 'autorizacion' } as PushSubscription;
  const sendMail = jest.fn();
  beforeEach(() => {
    jest.resetAllMocks(); process.env = { ...originalEnv, APP_URL: 'http://localhost:3000' };
    for (const key of ['SMTP_HOST', 'SMTP_FROM', 'SMTP_USER', 'SMTP_PASSWORD', 'VAPID_PRIVATE_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_SUBJECT']) delete process.env[key];
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });
  afterEach(() => { process.env = originalEnv; });
  it('rechaza enviar correo sin credenciales configuradas', async () => {
    await expect(new NotificationDeliveryService().email(row)).rejects.toThrow('SMTP no configurado');
    expect(sendMail).not.toHaveBeenCalled();
  });
  it('envía el correo real a través del transporte, con un enlace al hogar', async () => {
    Object.assign(process.env, { SMTP_HOST: 'smtp.example.test', SMTP_FROM: 'roomie@example.test' });
    await new NotificationDeliveryService().email(row);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: row.email, subject: 'Roomie: Tarea asignada', text: expect.stringContaining('http://localhost:3000/tareas') }));
  });
  it('incluye autenticación SMTP cuando el proveedor la exige', () => {
    Object.assign(process.env, { SMTP_HOST: 'smtp.example.test', SMTP_FROM: 'roomie@example.test', SMTP_USER: 'cuenta', SMTP_PASSWORD: 'clave-prueba', SMTP_SECURE: 'true' });
    new NotificationDeliveryService();
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true, auth: { user: 'cuenta', pass: 'clave-prueba' } }));
  });
  it('no intenta enviar push si faltan claves VAPID', async () => {
    await expect(new NotificationDeliveryService().push(row, subscription)).rejects.toThrow('VAPID no configurado');
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
  it('envía push con las claves de ese dispositivo y una ruta interna', async () => {
    Object.assign(process.env, { VAPID_PRIVATE_KEY: 'privada', NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'publica', VAPID_SUBJECT: 'mailto:a@example.test' });
    await new NotificationDeliveryService().push(row, subscription);
    expect(webpush.setVapidDetails).toHaveBeenCalledWith('mailto:a@example.test', 'publica', 'privada');
    expect(webpush.sendNotification).toHaveBeenCalledWith({ endpoint: subscription.endpoint, keys: { p256dh: 'publica', auth: 'autorizacion' } }, JSON.stringify({ title: row.title, message: row.message, href: row.href }), { timeout: 10000 });
  });
});
