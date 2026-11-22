import { RuleReportsService } from '../src/rules/rule-reports.service';
import { RulesRepository } from '../src/rules/rules.repository';
import { DatabaseService } from '../src/database/database.service';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { clauseInRules, excerpt } from '../src/rules/rules.rules';
import { client, database, homeId, memberId, service, user } from './helpers';

const versionId = '00000000-0000-4000-8000-000000000060';
const reportId = '00000000-0000-4000-8000-000000000070';
const adminId = '00000000-0000-4000-8000-000000000003';
const otherId = '00000000-0000-4000-8000-000000000002';
const clause = 'Silencio desde las 10 p. m.';
const form = { clause, description: 'Música hasta tarde', reported_membership_id: null };

describe('Incumplimientos del reglamento', () => {
  let reports: RuleReportsService;
  const repo = { latest: jest.fn(), activeMember: jest.fn(), createReport: jest.fn(), admins: jest.fn(), lockReport: jest.fn(), resolveReport: jest.fn() };
  const access = { requireHome: jest.fn() };
  const activities = { add: jest.fn() };
  const notifications = { notify: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks();
    repo.latest.mockResolvedValue({ id: versionId, version: 1, content: `Lavar la loza.\n\n${clause}` });
    repo.createReport.mockResolvedValue(reportId);
    repo.admins.mockResolvedValue([adminId, user.id]);
    repo.activeMember.mockResolvedValue({ user_id: otherId, name: 'Miguel' });
    repo.lockReport.mockResolvedValue({ id: reportId, home_id: homeId, clause, reported_by: otherId, resolved_at: null });
    reports = await service(RuleReportsService, [
      { provide: RulesRepository, useValue: repo }, { provide: DatabaseService, useValue: database() }, { provide: HomeAccessService, useValue: access },
      { provide: ActivitiesService, useValue: activities }, { provide: NotificationsService, useValue: notifications },
    ]);
  });
  it('HU9.4 avisa a los administradores y a la persona señalada, pero no a quien reporta', async () => {
    expect(await reports.report(user, homeId, { ...form, reported_membership_id: memberId })).toEqual({ id: reportId, message: 'Reporte enviado.' });
    expect(repo.createReport).toHaveBeenCalledWith(expect.objectContaining({ versionId, clause, reportedMembershipId: memberId }), client);
    const messages = Object.fromEntries(notifications.notify.mock.calls.map(([, notice]) => [notice.userId, notice.message]));
    expect(messages).toEqual({
      [adminId]: `Juan reportó un incumplimiento de Miguel: "${clause}"`,
      [otherId]: `Juan reportó que no cumpliste: "${clause}"`,
    });
  });
  it('HU9.4 rechaza un acuerdo que no está en la versión vigente', async () => {
    await expect(reports.report(user, homeId, { ...form, clause: 'Nadie paga el arriendo' })).rejects.toMatchObject({ status: 400 });
    expect(repo.createReport).not.toHaveBeenCalled();
  });
  it('HU9.4 impide reportarse a uno mismo o a alguien que ya no es integrante', async () => {
    repo.activeMember.mockResolvedValue({ user_id: user.id, name: 'Juan' });
    await expect(reports.report(user, homeId, { ...form, reported_membership_id: memberId })).rejects.toThrow('ti mismo');
    repo.activeMember.mockResolvedValue(null);
    await expect(reports.report(user, homeId, { ...form, reported_membership_id: memberId })).rejects.toThrow('integrante activo');
    expect(repo.createReport).not.toHaveBeenCalled();
  });
  it('HU9.4 un hogar sin reglamento no recibe reportes', async () => {
    repo.latest.mockResolvedValue(null);
    await expect(reports.report(user, homeId, form)).rejects.toMatchObject({ status: 409 });
  });
  it('HU9.4 resolver exige administrador y avisa a quien reportó', async () => {
    expect(await reports.resolve(user, reportId)).toEqual({ message: 'Reporte resuelto.' });
    expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId, true, client);
    expect(repo.resolveReport).toHaveBeenCalledWith(reportId, user.id, client);
    expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({ userId: otherId, title: 'Incumplimiento resuelto' }));
  });
  it('HU9.4 un reporte resuelto no se resuelve otra vez', async () => {
    repo.lockReport.mockResolvedValue({ id: reportId, home_id: homeId, clause, reported_by: otherId, resolved_at: new Date() });
    await expect(reports.resolve(user, reportId)).rejects.toMatchObject({ status: 409 });
    expect(repo.resolveReport).not.toHaveBeenCalled();
  });
  it('HU9.4 compara acuerdos sin importar espacios y recorta textos largos en los avisos', () => {
    expect(clauseInRules('Uno.\n\nSilencio   desde las\n10 p. m.', clause)).toBe(true);
    expect(excerpt('a'.repeat(130))).toHaveLength(120);
    expect(excerpt(clause)).toBe(clause);
  });
});
