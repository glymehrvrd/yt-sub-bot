import * as tencentcloud from "tencentcloud-sdk-nodejs-tts";
import fs from 'fs/promises';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import ffmpeg from 'ffmpeg-static';
import { logger } from './utils';

const log = logger('tts');

export function countChineseChars(text: string): number {
    // Match Chinese characters and full-width punctuation
    const chineseRegex = /[\u4e00-\u9fa5\u3000-\u303f\uff01-\uff5e]/g;
    const matches = text.match(chineseRegex);
    return matches ? matches.length : 0;
}

export function splitText(text: string): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    let currentCount = 0;

    for (const char of text) {
        let charCount = 0;
        if (/[\u4e00-\u9fa5\u3000-\u303f\uff01-\uff5e]/.test(char)) {
            // 中文字符算三个
            charCount = 3;
        } else {
            charCount = 1
        }
        // 一个chunks最大450个字符
        if (currentCount + charCount >= 450) {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = char;
            currentCount = charCount;
        } else {
            currentChunk += char;
            currentCount += charCount;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

export async function tts(text: string, sid: string) {
    const TtsClient = tencentcloud.tts.v20190823.Client;

    // Verify UTF-8 encoding
    if (!Buffer.isEncoding('utf8')) {
        throw new Error('Text must be UTF-8 encoded');
    }

    const clientConfig = {
        credential: {
            secretId: process.env.TTS_SECRET_ID,
            secretKey: process.env.TTS_SECRET_KEY
        },
        region: "",
        profile: {
            httpProfile: {
                endpoint: "tts.tencentcloudapi.com",
            },
        },
    };

    const client = new TtsClient(clientConfig);
    const params = {
        "Text": text,
        "SessionId": sid,
        "VoiceType": 101026,
        "SampleRate": 16000,
        "Codec": "pcm"
    };

    try {
        const data = await client.TextToVoice(params);
        return data.Audio;
    } catch (err) {
        log.error(`TTS generation failed, err = ${err}, text = ${text}`);
        throw err;
    }
}

async function convertPcmToMp3(inputPath: string, outputPath: string): Promise<void> {
    log.info('Converting PCM to MP3...');
    await new Promise((resolve, reject) => {
        if (!ffmpeg) {
            throw new Error('FFmpeg not found');
        }
        const ffmpegProcess: ChildProcess = spawn(ffmpeg, [
            '-y',  // Add force overwrite flag
            '-f', 's16le',
            '-ar', '16000',
            '-ac', '1',
            '-i', inputPath,
            '-acodec', 'libmp3lame',
            outputPath
        ]);

        let ffmpegOutput = '';
        let ffmpegError = '';

        ffmpegProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            ffmpegOutput += output;
            log.info(`FFmpeg: ${output.trim()}`);
        });

        ffmpegProcess.stderr?.on('data', (data) => {
            const output = data.toString();
            ffmpegError += output;
            log.info(`FFmpeg stderr: ${output.trim()}`);
        });

        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                resolve(null);
            } else {
                reject(new Error(`FFmpeg process exited with code ${code}. Error: ${ffmpegError}`));
            }
        });
    });
}

export async function generateAudioFromText(text: string, outputPath: string) {
    try {
        log.info(`Generating audio from translation, output path: ${outputPath}`);

        const chunks = splitText(text);
        const audioChunks: Buffer[] = [];

        log.info(`Text split into ${chunks.length} chunks`);

        for (let i = 0; i < chunks.length; i++) {
            log.info(`Processing chunk ${i + 1}/${chunks.length}`);
            const audioData = await tts(chunks[i], 'translation-session');
            if (!audioData) {
                throw new Error('No audio data received from TTS service');
            }
            audioChunks.push(Buffer.from(audioData, 'base64'));
            log.info(`Chunk ${i + 1}/${chunks.length} processed successfully`);
        }

        log.info('All chunks processed, combining audio data...');
        const pcmPath = `${outputPath}.pcm`;
        await fs.writeFile(pcmPath, Buffer.concat(audioChunks));

        await convertPcmToMp3(pcmPath, outputPath);

        // Clean up PCM file
        await fs.unlink(pcmPath);

        log.info(`Audio successfully converted and saved to ${outputPath}`);
        return outputPath;
    } catch (error) {
        log.error('Audio generation failed', error);
        throw error;
    }
}
