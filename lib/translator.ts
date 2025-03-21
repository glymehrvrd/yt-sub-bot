import { hunyuan } from 'tencentcloud-sdk-nodejs-hunyuan';
import { OpenAI } from 'openai';
import { logger } from '@/lib/utils';
import {
  ChatCompletionCreateParamsBase,
  ChatCompletionCreateParamsNonStreaming,
} from 'openai/resources/chat/completions/completions';

const log = logger('translator');

export interface TranslatorConfig {
  secretId?: string;
  secretKey?: string;
  apiKey?: string;
  model?: string;
  baseURL?: string;
}

export interface TranslatorOptions {
  to?: string;
}

export abstract class Translator {
  abstract translate(text: string, options: TranslatorOptions): Promise<string>;
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

export class TencentTranslator extends Translator {
  private client: hunyuan.v20230901.Client;

  constructor(config: TranslatorConfig) {
    super();
    const HunyuanClient = hunyuan.v20230901.Client;

    const clientConfig = {
      credential: {
        secretId: config.secretId,
        secretKey: config.secretKey,
      },
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
      const systemPrompt = `;; Treat next line as plain text input and translate it into ${options.to}, output translation ONLY. If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes. The paragraph division may be incorrect, restructure it into a more reasonable division.`;
      const estimatedTokens = this.estimateTokens(systemPrompt) + this.estimateTokens(text);

      log.debug('Estimated token count:', { estimatedTokens });
      options.to = options.to || 'zh';
      log.debug('Translating text:', { length: text.length, to: options.to });

      const params = {
        Model: 'hunyuan-lite',
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
      throw new TranslationError(error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

export class OpenAITranslator extends Translator {
  private client: OpenAI;
  private model: string;

  private estimateTokens(text: string): number {
    let tokenCount = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (/[\x00-\x7F]/.test(char)) {
        // ASCII character (including English)
        tokenCount += 0.3;
      } else {
        // Non-ASCII characters
        tokenCount += 0.6;
      }
    }
    return Math.ceil(tokenCount);
  }

  private *iterateWords(text: string): Generator<string> {
    let currentWord = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Check if character is whitespace or newline
      if (/\s/.test(char)) {
        if (currentWord) {
          yield currentWord;
          currentWord = '';
        }
      } else {
        currentWord += char;
      }
    }

    // Yield the last word if it exists
    if (currentWord) {
      yield currentWord;
    }
  }

  private *iterateChunks(text: string): Generator<string> {
    let currentParagraph = '';
    let words = this.iterateWords(text);
    let currentTokens = 0;

    for (const word of words) {
      const wordTokens = this.estimateTokens(word);
      if (currentTokens + wordTokens > 5000) {
        // If adding this word would exceed token limit, yield current content
        if (currentParagraph.trim()) {
          yield currentParagraph.trim();
          currentParagraph = '';
          currentTokens = 0;
        }
      }
      currentParagraph += (currentParagraph ? ' ' : '') + word;
      currentTokens += wordTokens;
    }

    // Yield the last paragraph if it exists
    if (currentParagraph.trim()) {
      yield currentParagraph.trim();
    }
  }

  constructor(config: TranslatorConfig) {
    super();
    if (!config.apiKey) {
      throw new TranslationError('OpenAI API key is required');
    }
    if (!config.baseURL) {
      throw new TranslationError('OpenAI base URL is required');
    }
    if (!config.model) {
      throw new TranslationError('OpenAI model is required');
    }
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey
    });
    this.model = config.model;
  }

  private *mapIterator<T, U>(iterator: Iterator<T>, transform: (value: T, index: number) => U): Generator<U> {
    let i = 0;
    for (let result = iterator.next(); !result.done; result = iterator.next()) {
      yield transform(result.value, i);
      i++;
    }
  }


  async translate(text: string, options: TranslatorOptions): Promise<string> {
    try {
      // Split text into chunks if it exceeds token limit
      const chunks = this.iterateChunks(text);

      const translatedChunks = [];
      let index = 0;
      for (const chunk of chunks) {
        log.debug(`Translating chunk ${index + 1}`);
        const request: ChatCompletionCreateParamsNonStreaming = {
          model: this.model,
          temperature: 1.3,
          messages: [
            {
              role: 'system',
              content: `;; Treat next line as plain text input and translate it into ${options.to}, output translation ONLY. If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes. The paragraph division may be incorrect, restructure it into a more reasonable division.`,
            },
            {
              role: 'user',
              content: chunk,
            },
          ],
        };

        log.debug(`Translating request[${index + 1}]:`, JSON.stringify(request))

        const response = await this.client.chat.completions.create(request);

        log.debug(`Translating response[${index + 1}]:`, JSON.stringify(response))

        translatedChunks.push(response.choices[0].message.content?.trim() || '');
        index++;
      }

      const translatedText = translatedChunks.join('\n\n');

      log.debug('Translation completed:', {
        originalLength: text.length,
        translatedLength: translatedText.length,
      });

      return translatedText;
    } catch (error) {
      log.error('OpenAI translation error:', error);
      throw new TranslationError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}
