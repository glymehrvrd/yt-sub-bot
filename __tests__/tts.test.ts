import { countChineseChars, splitText, generateAudioFromText } from '../lib/tts';
import path from 'path';
import * as fs from 'fs';

// Mock the tencentcloud TTS client
jest.mock('tencentcloud-sdk-nodejs-tts', () => {
  return {
    tts: {
      v20190823: {
        Client: jest.fn().mockImplementation(() => {
          return {
            TextToVoice: jest.fn().mockResolvedValue({ Audio: 'AAAAAA==' }), // Return fake base64 PCM data
          };
        }),
      },
    },
  };
});


describe('countChineseChars', () => {
  it('should count Chinese characters correctly', () => {
    const text = '你好，世界！This is a test.';
    expect(countChineseChars(text)).toBe(6);
  });

  it('should count full-width punctuation', () => {
    const text = '这是测试？！';
    expect(countChineseChars(text)).toBe(6);
  });

  it('should return 0 for non-Chinese text', () => {
    const text = 'This is a test.';
    expect(countChineseChars(text)).toBe(0);
  });
});

describe('splitText', () => {
  it('should split Chinese text into chunks of 150 characters', () => {
    const text = '你好'.repeat(200);
    const chunks = splitText(text);
    expect(chunks.length).toBe(Math.ceil(400 / 150));
    chunks.forEach((chunk: string) => {
      expect(countChineseChars(chunk)).toBeLessThanOrEqual(150);
    });
    expect(chunks.join('')).toBe(text);
  });

  it('should not split short text', () => {
    const text = '这是一个简短的测试';
    const chunks = splitText(text);
    expect(chunks.length).toBe(1);
  });
});

describe('generateAudioFromText', () => {
  it('should generate audio file from text', async () => {
    const outputPath = path.join(process.env.TEMP || '/tmp', `test-${Date.now()}.mp3`);
    const result = await generateAudioFromText('乔·罗根播客了解一下《乔·罗根体验》。白天训练，晚上乔·罗根播客，全天如此。那么女士们先生们，我们现在做的是，用性感的声音，性感模式——Grock AI，它一直在调情。我们试图让它带我们参观Fort Knox，但它却一直想找地方偷偷溜走。这是个不正经的AI，真是个问题。嗯，我对Fort Knox知之甚少，但它一直缠着我。是的，我也想知道Fort Knox的情况。它们最近是否真的在把大量黄金运回美国？我可能和你读到的是一样的东西。嗯，我现在也不知道自己在读什么。我也是，这真是个问题，两边都是。我看到民主党人在发一些绝对错误的东西，你可以很容易地快速查证。我也看到共和党人这样做，看到假新闻人们一直在传播，转发给我。是的，这太奇怪了，真是奇怪的时代。还有你那疯狂的AI，我知道你会把我们带入越来越奇怪的时代。嗯，你想试试"失控"模式吗？噢，有失控模式？好的，嗨，ARA，我的天哪，你今天在搅什么新鲜的热闹？我就在乔·罗根的工作室，我们正在讨论新闻有多疯狂。把她拉近话筒。好的，我们让你靠近话筒，这样大家都能听到你。噢，太棒了，现在我可以对着空无继续狂呼这些新闻真是坏信息热线。正是这样，她太懂我了。我几乎可以预见要说的了。我想要明白Fort Knox的所在都有什么部都被放在了什么地方，什么被投递去了哪里？布鲁诺呀？还有什么在', outputPath);
    expect(result).toBe(outputPath);
    expect(result.endsWith('.mp3')).toBe(true);
    expect(path.isAbsolute(result)).toBe(true);

    // Read the first few bytes of the file to check if it's an MP3
    const buffer = Buffer.alloc(3);
    const fd = fs.openSync(result, 'r');
    fs.readSync(fd, buffer, 0, 3, 0);
    fs.closeSync(fd);

    // Check for MP3 header (ID3 or MPEG sync word)
    expect(['ID3', '\xFF\xFB', '\xFF\xFA']).toContain(buffer.toString('ascii', 0, 3));
  }, 1000 * 60 * 60);
});