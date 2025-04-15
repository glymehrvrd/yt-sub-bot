import { OpenAITranslator, TranslatorConfig, TranslationError } from '../lib/translator';
import OpenAI from 'openai';

// Define mock function *before* the mock definition
const mockCreateCompletion = jest.fn();

// Mock the OpenAI client module
jest.mock('openai', () => {
  // Mock the named export 'OpenAI' which is the class constructor
  const mockConstructor = jest.fn().mockImplementation(() => {
    // This object is the mock instance returned by `new OpenAI()`
    return {
      chat: {
        completions: {
          create: mockCreateCompletion,
        },
      },
    };
  });

  // Return an object simulating the module's exports
  return {
    __esModule: true, // Still good practice for ES modules
    OpenAI: mockConstructor, // Mock the named export 'OpenAI'
  };
});

// Get a reference to the mocked constructor for clearing calls etc.
// We need to require the module *after* setting up the mock
const MockedOpenAIConstructor = require('openai').OpenAI as jest.Mock;

// Mock config
const mockConfig: TranslatorConfig = {
  apiKey: 'test-key',
  baseURL: 'http://localhost:8080',
  model: 'gpt-test',
};

describe('OpenAITranslator', () => {
  let translator: OpenAITranslator;

  beforeEach(() => {
    // Clear mock history and reset implementations before each test
    mockCreateCompletion.mockReset();
    // Re-create translator instance for isolation
    // Clear mock history and reset implementations before each test
    MockedOpenAIConstructor.mockClear(); // Clear constructor calls
    mockCreateCompletion.mockReset(); // Reset method calls and implementations

    // Re-create translator instance for isolation
    translator = new OpenAITranslator(mockConfig);
  });

  describe('constructor', () => {
    it('should throw TranslationError if apiKey is missing', () => {
      const config = { baseURL: 'url', model: 'model' };
      expect(() => new OpenAITranslator(config)).toThrow(TranslationError);
      expect(() => new OpenAITranslator(config)).toThrow('OpenAI API key is required');
    });

    it('should throw TranslationError if baseURL is missing', () => {
        const config = { apiKey: 'key', model: 'model' };
        expect(() => new OpenAITranslator(config)).toThrow(TranslationError);
        expect(() => new OpenAITranslator(config)).toThrow('OpenAI base URL is required');
      });

    it('should throw TranslationError if model is missing', () => {
        const config = { apiKey: 'key', baseURL: 'url' };
        expect(() => new OpenAITranslator(config)).toThrow(TranslationError);
        expect(() => new OpenAITranslator(config)).toThrow('OpenAI model is required');
    });

    it('should create an instance successfully with valid config', () => {
        expect(() => new OpenAITranslator(mockConfig)).not.toThrow();
      });
  });


  describe('translate', () => {
    it('should translate short text using OpenAI', async () => {
      const text = 'This is the text to translate.';
      const targetLanguage = 'Chinese';
      const expectedTranslation = '这是翻译后的文本。';

      // Configure the mock response for this specific test
      mockCreateCompletion.mockResolvedValue({
        choices: [{ message: { content: expectedTranslation } }],
      });

      const result = await translator.translate(text, { to: targetLanguage });

      expect(result).toBe(expectedTranslation);
      expect(mockCreateCompletion).toHaveBeenCalledTimes(1); // Short text = 1 chunk
      expect(mockCreateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system', content: expect.stringContaining(targetLanguage) }),
            expect.objectContaining({ role: 'user', content: text }),
          ]),
          model: mockConfig.model,
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      const text = 'Translate this.';
      const targetLanguage = 'Spanish';
      const apiError = new Error('API Error');

      // Configure the mock to reject
      mockCreateCompletion.mockRejectedValue(apiError);

      // Use await with expect().rejects
      await expect(translator.translate(text, { to: targetLanguage })).rejects.toThrow(TranslationError);
      await expect(translator.translate(text, { to: targetLanguage })).rejects.toThrow(apiError.message);
      // Removed call count check as translate is called twice for rejects assertions
    });

    it('should split long text into chunks and combine results', async () => {
        // Create text designed to be split (crude estimation based on implementation)
        // Create text long enough to exceed ~5000 token limit (ASCII * 0.3)
        const longText = 'word '.repeat(4000); // Approx 6000 tokens
        const targetLanguage = 'French';
        const mockTranslationChunk = 'le mot ';

        // Mock response for multiple calls
        mockCreateCompletion.mockResolvedValue({
            choices: [{ message: { content: mockTranslationChunk } }],
        });

        const result = await translator.translate(longText, { to: targetLanguage });

        // Check if called multiple times (more than 1 chunk)
        const callCount = mockCreateCompletion.mock.calls.length;
        expect(callCount).toBeGreaterThan(1);

        // Check if the result is roughly the combination of mock chunks
        // (Joined by \n\n according to implementation)
        const expectedCombined = Array(callCount).fill(mockTranslationChunk.trim()).join('\n\n');
        expect(result).toBe(expectedCombined);
    });

     it('should handle empty translation response from API', async () => {
        const text = 'Translate this.';
        const targetLanguage = 'German';

        // Mock response with null/empty content
        mockCreateCompletion.mockResolvedValue({
            choices: [{ message: { content: null } }], // API might return null
        });
        let result = await translator.translate(text, { to: targetLanguage });
        expect(result).toBe(''); // Expect empty string if translation is null

        mockCreateCompletion.mockResolvedValue({
            choices: [{ message: { content: '' } }], // API might return empty string
        });
        result = await translator.translate(text, { to: targetLanguage });
        expect(result).toBe(''); // Expect empty string if translation is empty

        expect(mockCreateCompletion).toHaveBeenCalledTimes(2); // Called twice for the two scenarios
    });
  });

  // Note: Testing private methods like estimateTokens, splitChunks directly is harder
  // It's often better to test their effects through the public `translate` method,
  // as done in the 'should split long text into chunks' test.
});