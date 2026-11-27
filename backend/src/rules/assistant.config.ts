import Anthropic from '@anthropic-ai/sdk';

export const ASSISTANT_CONFIG = Symbol('ASSISTANT_CONFIG');
export const defaultAssistantModel = 'claude-opus-5-5';

export interface AssistantConfig {
  // null cuando no hay ANTHROPIC_API_KEY: la interfaz usa entonces el asistente simulado.
  client: Pick<Anthropic, 'beta'> | null;
  model: string;
}

// La clave solo se lee en el servidor y nunca se envía al navegador.
export function assistantConfig(env: NodeJS.ProcessEnv = process.env): AssistantConfig {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  return {
    // 25 s por intento y un reintento caben en el minuto que espera el proxy de Next.
    client: apiKey ? new Anthropic({ apiKey, timeout: 25000, maxRetries: 1 }) : null,
    model: env.ANTHROPIC_MODEL?.trim() || defaultAssistantModel,
  };
}

export const assistantConfigProvider = { provide: ASSISTANT_CONFIG, useFactory: () => assistantConfig() };
