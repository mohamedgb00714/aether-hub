/**
 * Google Cloud Speech Service
 * 
 * Provides Speech-to-Text (STT) and Text-to-Speech (TTS) using Google Cloud APIs
 */

import storage, { STORAGE_KEYS } from './electronStore';

/**
 * Get the Google Speech API key from storage
 * Falls back to Gemini API key if Google Speech key is not set
 */
export async function getApiKey(): Promise<string | null> {
  const customKey = await storage.get(STORAGE_KEYS.GOOGLE_SPEECH_API_KEY);
  if (customKey) return customKey;
  
  // Fallback to Gemini key as it's often the same project
  return await storage.get(STORAGE_KEYS.GEMINI_API_KEY);
}

/**
 * Text-to-Speech (TTS)
 * Converts text to spoken audio using Google Cloud TTS API
 */
export async function textToSpeech(text: string, languageCode: string = 'en-US'): Promise<string | null> {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.warn('Google Speech API key not found');
      return null;
    }

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text },
        voice: { 
          languageCode, 
          name: languageCode.includes('en') ? 'en-US-Neural2-D' : undefined,
          ssmlGender: 'NEUTRAL' 
        },
        audioConfig: { audioEncoding: 'MP3' },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to synthesize speech');
    }

    const data = await response.json();
    return `data:audio/mp3;base64,${data.audioContent}`;
  } catch (error) {
    console.error('Google TTS Error:', error);
    return null;
  }
}

/**
 * Speech-to-Text (STT)
 * Converts audio data to text using Google Cloud STT API
 * @param audioBase64 Base64 encoded audio data (linear16, 16000Hz recommended)
 */
export async function speechToText(audioBase64: string, languageCode: string = 'en-US'): Promise<string | null> {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.warn('Google Speech API key not found');
      return null;
    }

    const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode,
          enableAutomaticPunctuation: true,
        },
        audio: {
          content: audioBase64,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to recognize speech');
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].alternatives[0].transcript;
    }
    return '';
  } catch (error) {
    console.error('Google STT Error:', error);
    return null;
  }
}
