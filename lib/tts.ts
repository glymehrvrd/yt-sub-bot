import * as tencentcloud from "tencentcloud-sdk-nodejs-tts";
import fs from 'fs/promises';
import path from 'path';
import { logger } from './utils';

const log = logger('tts');

export async function tts(text: string, sid: string) {
    const TtsClient = tencentcloud.tts.v20190823.Client;

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
        "VoiceType": 101001,
        "SampleRate": 16000,
        "Codec": "mp3"
    };

    try {
        const data = await client.TextToVoice(params);
        return data.Audio;
    } catch (err) {
        log.error("TTS generation failed", err);
        throw err;
    }
}

export async function generateAudioFromTranslation(translatedText: string, outputPath: string) {
    try {
        log.info('Generating audio from translation');
        const audioData = await tts(translatedText, 'translation-session');

        const fullPath = path.resolve(outputPath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, new Uint8Array(Buffer.from(audioData, 'base64')));

        log.info(`Audio successfully saved to ${fullPath}`);
        return fullPath;
    } catch (error) {
        log.error('Audio generation failed', error);
        throw error;
    }
}
