import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { PendingDelivery } from './jobs.repository';
import { PushSubscription } from '../notifications/notifications.entity';

@Injectable()
export class NotificationDeliveryService {
  private readonly pushReady = Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_SUBJECT);
  private readonly mail = process.env.SMTP_HOST && process.env.SMTP_FROM ? nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000, socketTimeout: 10000,
  }) : null;

  constructor() {
    if (this.pushReady) webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  }

  async email(row: PendingDelivery) {
    if (!this.mail) throw new Error('SMTP no configurado');
    await this.mail.sendMail({ from: process.env.SMTP_FROM, to: row.email, subject: `Roomie: ${row.title}`, text: `${row.message}\n\n${process.env.APP_URL}${row.href}` });
  }

  async push(row: PendingDelivery, subscription: PushSubscription) {
    if (!this.pushReady) throw new Error('VAPID no configurado');
    await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: row.title, message: row.message, href: row.href }), { timeout: 10000 });
  }
}
