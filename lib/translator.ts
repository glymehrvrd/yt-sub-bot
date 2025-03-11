import { hunyuan } from 'tencentcloud-sdk-nodejs-hunyuan';
import { logger } from '@/lib/utils';

const log = logger('translator');

interface TranslatorConfig {
  secretId: string;
  secretKey: string;
  region?: string;
}

interface TranslatorOptions {
  to?: string;
}

export class TranslationError extends Error {
  constructor(message: string) {
    super(`Translation error: ${message}`);
  }
}

interface HunyuanResponse {
  RequestId: string;
  Note: string;
  Choices: Array<{
    Index: number;
    Message: {
      Role: string;
      Content: string;
    };
    FinishReason: string;
  }>;
  Created: number;
  Id: string;
  Usage: {
    PromptTokens: number;
    CompletionTokens: number;
    TotalTokens: number;
  };
}

export class Translator {
  private client: hunyuan.v20230901.Client;

  constructor(config: TranslatorConfig) {
    const HunyuanClient = hunyuan.v20230901.Client;

    const clientConfig = {
      credential: {
        secretId: config.secretId,
        secretKey: config.secretKey,
      },
      region: config.region || '',
      profile: {
        httpProfile: {
          endpoint: 'hunyuan.tencentcloudapi.com',
        },
      },
    };

    this.client = new HunyuanClient(clientConfig);
  }

  async translate(text: string, options: TranslatorOptions): Promise<string> {
    try {
      options.to = options.to || 'zh';
      log.debug('Translating text:', { length: text.length, to: options.to });

      const params = {
        Model: 'hunyuan-turbos-latest',
        Messages: [
          {
            Role: 'user',
            Content: `;; Treat next line as plain text input and translate it into ${options.to}, output translation ONLY. If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes. The paragraph division may be incorrect, restructure it into a more reasonable division. Input:\n${text}`,
          },
        ],
      };

      log.debug('Translating request:', JSON.stringify(params));

      const response = (await this.client.ChatCompletions(params)) as HunyuanResponse;

      log.debug('Translating response:', JSON.stringify(response));

      if (!response.Choices?.[0]?.Message?.Content) {
        throw new TranslationError('Empty response from translation service');
      }

      const translatedText = response.Choices[0].Message.Content;

      log.debug('Translation completed:', {
        originalLength: text.length,
        translatedLength: translatedText.length,
      });

      return translatedText;
    } catch (error) {
      log.error('Translation failed:', error);
      throw new TranslationError(error.message || 'Unknown error');
    }
  }
}
