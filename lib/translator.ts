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

  private splitChunks(text: string): string[] {
    let currentParagraph = '';
    let words = this.iterateWords(text);
    let currentTokens = 0;
    const chunks: string[] = [];

    for (const word of words) {
      const wordTokens = this.estimateTokens(word);
      if (currentTokens + wordTokens > 5000) {
        // If adding this word would exceed token limit, add current content
        if (currentParagraph.trim()) {
          chunks.push(currentParagraph.trim());
          currentParagraph = '';
          currentTokens = 0;
        }
      }
      currentParagraph += (currentParagraph ? ' ' : '') + word;
      currentTokens += wordTokens;
    }

    // Add the last paragraph if it exists
    if (currentParagraph.trim()) {
      chunks.push(currentParagraph.trim());
    }

    return chunks;
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
      apiKey: config.apiKey,
    });
    this.model = config.model;
  }

  async translate(text: string, options: TranslatorOptions): Promise<string> {
    try {
      // Split text into chunks if it exceeds token limit
      const chunks = this.splitChunks(text);
      const translatedChunks = [];

      for (let index = 0; index < chunks.length; index++) {
        log.info(`Translating chunk ${index + 1}/${chunks.length}`);
        const chunk = chunks[index];
        const request: ChatCompletionCreateParamsNonStreaming = {
          model: this.model,
          // temperature: 1.3,
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

        log.debug(`Translating request[${index + 1}]:`, JSON.stringify(request));

        const response = await this.client.chat.completions.create(request);

        log.debug(`Translating response[${index + 1}]:`, JSON.stringify(response));

        translatedChunks.push(response.choices[0].message.content?.trim() || '');
      }

      const translatedText = translatedChunks.join('\n\n');

      log.info(`Translation completed: originalLength=${text.length}, translatedLength=${translatedText.length}`);

      return translatedText;
    } catch (error) {
      log.error('OpenAI translation error:', error);
      throw new TranslationError(error instanceof Error ? error.message : 'Unknown error');
    }
  }
}
