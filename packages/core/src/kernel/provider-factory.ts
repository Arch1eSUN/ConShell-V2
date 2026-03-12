/**
 * Provider Factory — 将配置转换为 InferenceProvider 实例
 *
 * 从 kernel/index.ts 拆分出来，以保持 boot 序列简洁。
 */
import type { Logger } from '../types/common.js';
import type { InferenceProvider } from '../types/inference.js';
import type { InferenceRouter } from '../inference/index.js';

export interface ProviderConfig {
  type?: string;
  id?: string;
  apiKey?: string;
  endpoint?: string;
}

/**
 * Register all providers from config into the InferenceRouter.
 * Returns number of successfully registered providers.
 */
export async function registerProviders(
  router: InferenceRouter,
  providerConfigs: ProviderConfig[],
  logger: Logger,
): Promise<number> {
  const factories = await import('../inference/providers/index.js');
  let count = 0;

  for (const p of providerConfigs) {
    try {
      const provider = createProvider(p, factories, logger);
      if (provider) {
        router.register(provider);
        count++;
      }
    } catch (err) {
      logger.warn('Provider init failed', { id: p.id ?? p.type, error: String(err) });
    }
  }

  return count;
}

function createProvider(
  p: ProviderConfig,
  factories: any,
  logger: Logger,
): InferenceProvider | null {
  const type = p.type ?? p.id ?? '';
  const apiKey = p.apiKey ?? '';
  const endpoint = p.endpoint;

  switch (type) {
    case 'openai':
      return factories.createOpenAIProvider(apiKey, endpoint);
    case 'anthropic':
      return factories.createAnthropicProvider(apiKey);
    case 'google':
      return factories.createGoogleProvider(apiKey);
    case 'deepseek':
      return factories.createDeepSeekProvider(apiKey);
    case 'ollama':
      return factories.createOllamaProvider(endpoint ?? 'http://localhost:11434');
    case 'openrouter':
      return factories.createOpenRouterProvider(apiKey);
    case 'cliproxy':
      return factories.createCLIProxyProvider(endpoint ?? 'http://localhost:4200', apiKey);
    default:
      logger.warn('Unknown provider type', { type });
      return null;
  }
}
