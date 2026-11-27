import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import { AssistantService, assistantLimit } from '../src/rules/assistant.service';
import { ASSISTANT_CONFIG, AssistantConfig, assistantConfig } from '../src/rules/assistant.config';
import { assistantMessage, assistantReplySchema, parseAssistantReply } from '../src/rules/assistant.prompt';
import { RulesRepository } from '../src/rules/rules.repository';
import { HomeAccessService } from '../src/access/home-access.service';
import { homeId, service, user } from './helpers';

const ask = { prompt: 'Somos cuatro y nadie cumple las tareas', draft: 'Silencio desde las 10 p. m.', language: 'es' as const };
const reply = { text: 'Propongo una rotación semanal.', clauses: ['Semana 1: Ana cocina; Beto baños.', 'Quien no pueda cumplir su turno lo cambia antes del lunes.'] };
const message = (body: object) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(body) }] });
const headers = new Headers();

describe('Asistente de acuerdos con IA', () => {
  const create = jest.fn();
  const repo = { memberNames: jest.fn() };
  const access = { requireHome: jest.fn() };
  const build = (config: AssistantConfig) => service(AssistantService, [
    { provide: ASSISTANT_CONFIG, useValue: config }, { provide: RulesRepository, useValue: repo }, { provide: HomeAccessService, useValue: access },
  ]);
  let assistant: AssistantService;
  const logged = jest.spyOn(Logger.prototype, 'error');
  jest.spyOn(Logger.prototype, 'warn');
  beforeEach(async () => {
    jest.resetAllMocks();
    repo.memberNames.mockResolvedValue(['Ana', 'Beto', 'Caro', 'Dani']);
    create.mockResolvedValue(message(reply));
    assistant = await build({ client: { beta: { messages: { create } } } as unknown as Pick<Anthropic, 'beta'>, model: 'claude-opus-5-5' });
  });

  it('HU9.5 informa si el hogar usa la IA real o el asistente simulado', async () => {
    expect(await assistant.status(user.id, homeId)).toEqual({ mode: 'ai', model: 'claude-opus-5-5' });
    const simulated = await build({ client: null, model: 'claude-opus-5-5' });
    expect(await simulated.status(user.id, homeId)).toEqual({ mode: 'simulated', model: null });
    expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId);
  });
  it('HU9.5 envía al modelo la petición, el borrador y los integrantes del hogar con salida estructurada', async () => {
    expect(await assistant.ask(user.id, homeId, ask)).toEqual(reply);
    expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId, true);
    const [request] = create.mock.calls[0];
    expect(request).toMatchObject({
      model: 'claude-opus-5-5', betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: assistantReplySchema } },
    });
    expect(request.messages[0].content).toBe(assistantMessage(ask.prompt, ask.draft, ['Ana', 'Beto', 'Caro', 'Dani'], 'es'));
    expect(request.messages[0].content).toContain('Ana, Beto, Caro, Dani');
  });
  it('HU9.5 solo los administradores consultan y sin clave no se llama a la API', async () => {
    access.requireHome.mockRejectedValueOnce(new Error('Se requiere administrador'));
    await expect(assistant.ask(user.id, homeId, ask)).rejects.toThrow('Se requiere administrador');
    const simulated = await build({ client: null, model: 'claude-opus-5-5' });
    await expect(simulated.ask(user.id, homeId, ask)).rejects.toMatchObject({ status: 503 });
    expect(create).not.toHaveBeenCalled();
  });
  it('HU9.5 un modelo sin respaldo del servidor no envía fallbacks y responde en inglés si se pide', async () => {
    const haiku = await build({ client: { beta: { messages: { create } } } as unknown as Pick<Anthropic, 'beta'>, model: 'claude-haiku-5-5' });
    await haiku.ask(user.id, homeId, { ...ask, language: 'en' });
    const [request] = create.mock.calls[0];
    expect(request).not.toHaveProperty('fallbacks');
    expect(request.messages[0].content).toContain('in English');
  });
  it('HU9.5 un rechazo del modelo o una respuesta incompleta no se muestran como acuerdos', async () => {
    create.mockResolvedValueOnce({ stop_reason: 'refusal', content: [] });
    await expect(assistant.ask(user.id, homeId, ask)).rejects.toMatchObject({ status: 422 });
    create.mockResolvedValueOnce({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"text":"Propon' }] });
    await expect(assistant.ask(user.id, homeId, ask)).rejects.toMatchObject({ status: 502 });
    create.mockResolvedValueOnce(message({ text: '', clauses: [] }));
    await expect(assistant.ask(user.id, homeId, ask)).rejects.toMatchObject({ status: 502 });
  });
  it('HU9.5 traduce los errores de la API de Claude sin exponer detalles', async () => {
    const cases: [unknown, number][] = [
      [new Anthropic.RateLimitError(429, undefined, 'rate limit', headers), 429],
      [new Anthropic.AuthenticationError(401, undefined, 'invalid x-api-key', headers), 503],
      [new Anthropic.BadRequestError(400, undefined, 'bad request', headers), 502],
      [new Anthropic.APIConnectionTimeoutError(), 503],
      [new Anthropic.InternalServerError(529, undefined, 'overloaded', headers), 503],
    ];
    for (const [error, status] of cases) {
      create.mockRejectedValueOnce(error);
      const failure: { status: number; message: string } = await assistant.ask(user.id, homeId, ask).then(() => ({ status: 200, message: '' }), e => e);
      expect(failure.status).toBe(status);
      expect(failure.message).not.toMatch(/x-api-key|rate limit|overloaded/);
    }
    expect(JSON.stringify(logged.mock.calls)).not.toContain('clave-de-prueba');
  });
  it('HU9.5 limita las consultas seguidas de una misma persona', async () => {
    for (let i = 0; i < assistantLimit.requests; i++) await assistant.ask(user.id, homeId, ask);
    await expect(assistant.ask(user.id, homeId, ask)).rejects.toMatchObject({ status: 429 });
    expect(create).toHaveBeenCalledTimes(assistantLimit.requests);
    await expect(assistant.ask('otra-persona', homeId, ask)).resolves.toEqual(reply);
  });
  it('HU9.5 valida la respuesta: descarta acuerdos vacíos o repetidos y rechaza formatos inválidos', () => {
    expect(parseAssistantReply(JSON.stringify({ text: ' Hola ', clauses: [' Uno ', 'Uno', '', 'Dos'] }))).toEqual({ text: 'Hola', clauses: ['Uno', 'Dos'] });
    expect(parseAssistantReply(JSON.stringify({ text: 'x', clauses: Array.from({ length: 12 }, (_, i) => `Acuerdo ${i}`) }))?.clauses).toHaveLength(8);
    expect(parseAssistantReply('no es JSON')).toBeNull();
    expect(parseAssistantReply(JSON.stringify({ text: 'x', clauses: [1] }))).toBeNull();
    expect(parseAssistantReply(undefined)).toBeNull();
  });
  it('HU9.5 la clave solo se lee del entorno del servidor y el modelo se puede cambiar', () => {
    expect(assistantConfig({})).toEqual({ client: null, model: 'claude-opus-5-5' });
    expect(assistantConfig({ ANTHROPIC_API_KEY: '  ' }).client).toBeNull();
    const configured = assistantConfig({ ANTHROPIC_API_KEY: 'clave-de-prueba', ANTHROPIC_MODEL: 'claude-sonnet-5-5' });
    expect(configured.client).toBeInstanceOf(Anthropic);
    expect(configured.model).toBe('claude-sonnet-5-5');
  });
  it('HU9.5 el borrador vacío se indica al modelo en vez de enviarse en blanco', () => {
    expect(assistantMessage('Ideas para visitas', '  ', [], 'es')).toContain('<borrador>\n(vacío)\n</borrador>');
  });
});
