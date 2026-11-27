import Anthropic from '@anthropic-ai/sdk';
import { BadGatewayException, HttpException, HttpStatus, Inject, Injectable, Logger, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { HomeAccessService } from '../access/home-access.service';
import { ASSISTANT_CONFIG, AssistantConfig } from './assistant.config';
import { assistantMessage, assistantReplySchema, assistantSystemPrompt, parseAssistantReply } from './assistant.prompt';
import { AssistantDto } from './rules.dto';
import { RulesRepository } from './rules.repository';

// Con estos modelos, si el principal rechaza la petición, la API la reintenta con otro modelo.
const fallbackModels = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5']);
// Cada consulta tiene costo: se limita por persona para evitar abusos.
export const assistantLimit = { requests: 10, windowMs: 10 * 60 * 1000 };

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly usage = new Map<string, number[]>();

  constructor(
    @Inject(ASSISTANT_CONFIG) private readonly config: AssistantConfig,
    private readonly repository: RulesRepository,
    private readonly access: HomeAccessService,
  ) {}

  // La interfaz lo usa para decidir si muestra el asistente real o el simulado.
  async status(userId: string, homeId: string) {
    await this.access.requireHome(userId, homeId);
    return this.config.client ? { mode: 'ai' as const, model: this.config.model } : { mode: 'simulated' as const, model: null };
  }

  async ask(userId: string, homeId: string, data: AssistantDto) {
    await this.access.requireHome(userId, homeId, true);
    const client = this.config.client;
    if (!client) throw new ServiceUnavailableException('El asistente con IA no está configurado.');
    this.consume(userId);
    // Los nombres salen de la base de datos, no del navegador.
    const members = await this.repository.memberNames(homeId);
    const fallback = fallbackModels.has(this.config.model);
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model: this.config.model,
        max_tokens: 16000,
        ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        output_config: { effort: 'low', format: { type: 'json_schema', schema: assistantReplySchema } },
        system: assistantSystemPrompt,
        messages: [{ role: 'user', content: assistantMessage(data.prompt, data.draft, members, data.language) }],
      });
    } catch (error) {
      throw this.httpError(error);
    }
    if (response.stop_reason === 'refusal') throw new UnprocessableEntityException('El asistente no puede ayudar con esa petición. Intenta con otra.');
    const text = response.content.find(block => block.type === 'text');
    const reply = response.stop_reason === 'max_tokens' ? null : parseAssistantReply(text?.type === 'text' ? text.text : undefined);
    if (!reply) throw new BadGatewayException('El asistente no devolvió una respuesta completa. Intenta nuevamente.');
    return reply;
  }

  private consume(userId: string, now = Date.now()) {
    const recent = (this.usage.get(userId) ?? []).filter(time => now - time < assistantLimit.windowMs);
    if (recent.length >= assistantLimit.requests) throw new HttpException('Hiciste muchas consultas al asistente. Espera unos minutos.', HttpStatus.TOO_MANY_REQUESTS);
    this.usage.set(userId, [...recent, now]);
  }

  // De lo más específico a lo más general; nunca se registra la clave ni el contenido del hogar.
  private httpError(error: unknown) {
    if (error instanceof Anthropic.RateLimitError) return new HttpException('El asistente está ocupado. Intenta en un momento.', HttpStatus.TOO_MANY_REQUESTS);
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      this.logger.error(`La API de Claude rechazó la clave configurada (${error.status}).`);
      return new ServiceUnavailableException('El asistente con IA no está disponible. Revisa su configuración.');
    }
    if (error instanceof Anthropic.BadRequestError) {
      this.logger.error(`La API de Claude rechazó la solicitud: ${error.message}`);
      return new BadGatewayException('El asistente no pudo procesar la petición. Intenta nuevamente.');
    }
    if (error instanceof Anthropic.APIConnectionError) return new ServiceUnavailableException('No pudimos conectar con el asistente. Intenta nuevamente.');
    if (error instanceof Anthropic.APIError) {
      this.logger.warn(`La API de Claude respondió ${error.status}.`);
      return new ServiceUnavailableException('El asistente no está disponible en este momento. Intenta nuevamente.');
    }
    return error;
  }
}
