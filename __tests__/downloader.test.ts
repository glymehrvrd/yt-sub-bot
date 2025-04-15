import {
  downloadSubtitle,
  YoutubeTranscriptError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
} from '../lib/downloader';
import { logger } from '../lib/utils'; // Assuming logger doesn't need complex mocking for basic tests

// Mock the global fetch API
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock logger to prevent console noise during tests
jest.mock('../lib/utils', () => ({
  logger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

// Helper to create mock fetch responses
const createMockResponse = (body: string, ok: boolean = true, status: number = 200) => {
  return Promise.resolve({
    ok,
    status,
    text: () => Promise.resolve(body),
  } as Response);
};

// Sample HTML snippets and XML data
const sampleVideoPageHtmlWithCaptions = `
<html>
<head><title>Test Video Title - YouTube</title></head>
<body>
  Some content...
  "captions": {
    "playerCaptionsTracklistRenderer": {
      "captionTracks": [
        { "baseUrl": "https://example.com/transcript?lang=en", "languageCode": "en", "isTranslatable": true },
        { "baseUrl": "https://example.com/transcript?lang=es", "languageCode": "es", "isTranslatable": true }
      ],
      "translationLanguages": [ { "languageCode": "fr", "languageName": { "simpleText": "French" } } ]
    }
  },"videoDetails": {}
  More content...
</body>
</html>
`;

const sampleVideoPageHtmlNoCaptions = `
<html>
<head><title>Test Video Title - YouTube</title></head>
<body>
  Some content...
  "captions": {
    "playerCaptionsTracklistRenderer": {}
  },"videoDetails": {}
  More content...
</body>
</html>
`;

const sampleVideoPageHtmlDisabled = `
<html>
<head><title>Test Video Title - YouTube</title></head>
<body>
  Some content...
  "playabilityStatus": { "status": "OK" }
  More content...
</body>
</html>
`;

const sampleVideoPageHtmlUnavailable = `
<html>
<head><title>Test Video Title - YouTube</title></head>
<body>
  Some content...
  "playabilityStatus": { "status": "UNPLAYABLE", "reason": "Video unavailable" }
  More content...
</body>
</html>
`;

const sampleVideoPageHtmlCaptcha = `
<html>
<head><title>Test Video Title - YouTube</title></head>
<body>
  Some content...
  <div class="g-recaptcha"></div>
  More content...
</body>
</html>
`;


const sampleTranscriptXmlEn = `
<?xml version="1.0" encoding="utf-8" ?>
<transcript>
  <text start="0.5" dur="1.5">Hello world.</text>
  <text start="2.1" dur="2.0">This is a test.</text>
</transcript>
`;

const sampleTranscriptXmlEs = `
<?xml version="1.0" encoding="utf-8" ?>
<transcript>
  <text start="0.6" dur="1.4">Hola mundo.</text>
  <text start="2.2" dur="1.9">Esto es una prueba.</text>
</transcript>
`;

describe('Downloader', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockFetch.mockClear();
    // Add a default fallback mock for unexpected fetches (e.g., invalid ID)
    mockFetch.mockResolvedValue(createMockResponse('', false, 404)); // Simple non-OK response
  });

  // Tests for retrieveVideoId (internal, but testable via downloadSubtitle)
  it('should throw error for invalid video ID format', async () => {
    // With the default mock, an invalid ID should lead to a fetch failure,
    // resulting in YoutubeTranscriptNotAvailableError after the retrieveVideoId change.
    await expect(downloadSubtitle({ videoId: 'invalid-id' })).rejects.toThrow(YoutubeTranscriptNotAvailableError);
  });

  // Tests for parseCookies (internal, but testable via downloadSubtitle with cookies)
  // Add later if needed, focusing on fetchTranscript/downloadSubtitle first

  describe('downloadSubtitle', () => {
    it('should fetch and parse English transcript by default', async () => {
      const videoId = 'validVideo11';
      mockFetch
        .mockResolvedValueOnce(createMockResponse(sampleVideoPageHtmlWithCaptions)) // Video page
        .mockResolvedValueOnce(createMockResponse(sampleTranscriptXmlEn)); // Transcript XML

      const result = await downloadSubtitle({ videoId });

      expect(result.title).toBe('Test Video Title');
      expect(result.language).toBe('en'); // Should fetch 'en' by default now
      expect(result.subtitle).toBe('Hello world. This is a test.');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(`https://www.youtube.com/watch?v=${videoId}`, expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/transcript?lang=en', expect.any(Object));
    });

    it('should fetch and parse specified language transcript', async () => {
        const videoId = 'validVideo11';
        const language = 'es';
        mockFetch
          .mockResolvedValueOnce(createMockResponse(sampleVideoPageHtmlWithCaptions)) // Video page
          .mockResolvedValueOnce(createMockResponse(sampleTranscriptXmlEs)); // Transcript XML

        const result = await downloadSubtitle({ videoId, language });

        expect(result.title).toBe('Test Video Title');
        expect(result.language).toBe(language);
        expect(result.subtitle).toBe('Hola mundo. Esto es una prueba.');
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch).toHaveBeenCalledWith(`https://www.youtube.com/watch?v=${videoId}`, expect.objectContaining({
            headers: expect.objectContaining({ 'Accept-Language': language })
        }));
        expect(mockFetch).toHaveBeenCalledWith(`https://example.com/transcript?lang=${language}`, expect.any(Object));
      });

    it('should handle transcript XML decoding', async () => {
        const videoId = 'validVideo11';
        const encodedXml = `
        <?xml version="1.0" encoding="utf-8" ?>
        <transcript>
          <text start="0.5" dur="1.5">Hello &amp; <world>.</text>
          <text start="2.1" dur="2.0">This is &apos;test&apos; "quote".</text>
        </transcript>
        `;
        mockFetch
          .mockResolvedValueOnce(createMockResponse(sampleVideoPageHtmlWithCaptions))
          .mockResolvedValueOnce(createMockResponse(encodedXml)); // Fetch transcript (using the encoded XML)

        const result = await downloadSubtitle({ videoId, language: 'en' });
        expect(result.subtitle).toBe("Hello & <world>. This is 'test' \"quote\"."); // Check decoded result
      });

    it('should combine text into paragraphs respecting MAX_WORDS (approx)', async () => {
        const videoId = 'validVideo11';
        // Create XML that should be split into multiple paragraphs
        let longXmlContent = '<?xml version="1.0" encoding="utf-8" ?><transcript>';
        for (let i = 0; i < 150; i++) { // ~1500 words
            longXmlContent += `<text start="${i * 2}" dur="1.5">word${i} word word word word word word word word word</text>\n`; // 10 words per line, remove period
        }
        longXmlContent += '</transcript>';

        mockFetch
          .mockResolvedValueOnce(createMockResponse(sampleVideoPageHtmlWithCaptions))
          .mockResolvedValueOnce(createMockResponse(longXmlContent));

        const result = await downloadSubtitle({ videoId, language: 'en' });
        // Expect multiple paragraphs separated by newline
        expect(result.subtitle.includes('\n')).toBe(true);
        // Check if the first and last words are present
        expect(result.subtitle.startsWith('word0')).toBe(true);
        expect(result.subtitle.endsWith('word149')).toBe(true); // Last word from the last <text> (no period)
      });

    it('should throw YoutubeTranscriptTooManyRequestError on captcha', async () => {
      const videoId = 'validVideo11';
      mockFetch.mockResolvedValueOnce(createMockResponse(sampleVideoPageHtmlCaptcha));
      await expect(downloadSubtitle({ videoId })).rejects.toThrow(YoutubeTranscriptTooManyRequestError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw YoutubeTranscriptVideoUnavailableError if video unavailable', async () => {
        const videoId = 'validVideo11';
        // Need to simulate the specific structure indicating unavailability
        const unavailableHtml = `<html><body>"playabilityStatus":{"status":"ERROR"}</body></html>`;
        // Mock for Video Unavailable: Needs playabilityStatus: ERROR *before* captions check
        mockFetch.mockResolvedValueOnce(createMockResponse(sampleVideoPageHtmlUnavailable));
        await expect(downloadSubtitle({ videoId })).rejects.toThrow(YoutubeTranscriptVideoUnavailableError);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

    it('should throw YoutubeTranscriptDisabledError if captions renderer missing', async () => {
        const videoId = 'validVideo11';
        // Mock for Disabled: Needs valid playabilityStatus but missing captions block entirely
        mockFetch.mockResolvedValueOnce(createMockResponse(sampleVideoPageHtmlDisabled));
        await expect(downloadSubtitle({ videoId })).rejects.toThrow(YoutubeTranscriptDisabledError);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

    it('should throw YoutubeTranscriptNotAvailableError if captionTracks missing', async () => {
      const videoId = 'validVideo11';
      mockFetch.mockResolvedValueOnce(createMockResponse(sampleVideoPageHtmlNoCaptions));
      // Mock for Not Available: Has captions block but no captionTracks array
      mockFetch.mockResolvedValueOnce(createMockResponse(sampleVideoPageHtmlNoCaptions));
      await expect(downloadSubtitle({ videoId })).rejects.toThrow(YoutubeTranscriptNotAvailableError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

     it('should throw YoutubeTranscriptNotAvailableLanguageError if requested language not found', async () => {
        const videoId = 'validVideo11';
        const language = 'fr'; // Not in sampleVideoPageHtmlWithCaptions
        // Mock for Language Not Available: Has tracks, but 'fr' isn't one of them
        mockFetch.mockResolvedValueOnce(createMockResponse(sampleVideoPageHtmlWithCaptions));
        await expect(downloadSubtitle({ videoId, language })).rejects.toThrow(YoutubeTranscriptNotAvailableLanguageError);
        // Check specific error message as well
        await expect(downloadSubtitle({ videoId, language })).rejects.toThrow(`No transcripts are available in ${language} this video (${videoId}). Available languages: en, es`);
        expect(mockFetch).toHaveBeenCalledTimes(1); // Only fetches video page, not transcript
      });

      it('should throw YoutubeTranscriptNotAvailableError if transcript fetch fails', async () => {
        const videoId = 'validVideo11';
        mockFetch
          .mockResolvedValueOnce(createMockResponse(sampleVideoPageHtmlWithCaptions)) // Video page OK
          .mockResolvedValueOnce(createMockResponse('', false, 404)); // Transcript fetch fails

        await expect(downloadSubtitle({ videoId, language: 'en' })).rejects.toThrow(YoutubeTranscriptNotAvailableError);
        expect(mockFetch).toHaveBeenCalledTimes(2); // Video page fetch + failed transcript fetch
      });

      it('should handle cookies correctly', async () => {
        const videoId = 'validVideo11';
        const cookieContents = `
# Netscape HTTP Cookie File
.youtube.com\tTRUE\t/\tTRUE\t0\tPREF\tf1=50000000
.youtube.com\tTRUE\t/\tTRUE\t0\tCONSENT\tYES+cb.20210328-17-p0.en+FX+684
        `;
        const expectedCookieHeader = 'PREF=f1=50000000; CONSENT=YES+cb.20210328-17-p0.en+FX+684';

        mockFetch
          .mockResolvedValueOnce(createMockResponse(sampleVideoPageHtmlWithCaptions)) // Video page
          .mockResolvedValueOnce(createMockResponse(sampleTranscriptXmlEn)); // Transcript XML

        await downloadSubtitle({ videoId, cookieContents });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        // Check if both fetch calls included the parsed cookie header
        expect(mockFetch).toHaveBeenNthCalledWith(1, `https://www.youtube.com/watch?v=${videoId}`, expect.objectContaining({
            headers: expect.objectContaining({ Cookie: expectedCookieHeader })
        }));
        expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://example.com/transcript?lang=en', expect.objectContaining({
            headers: expect.objectContaining({ Cookie: expectedCookieHeader })
        }));
      });
  });
});