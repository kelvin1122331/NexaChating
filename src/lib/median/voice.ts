'use client';

import { isMedianApp } from '@/lib/median/bridge';

export interface NativeVoiceRecording {
  url: string;
  duration: number;
}

/** Starts native AAC capture where the Median bridge supports recording. */
export function startNativeRecording(): boolean {
  if (!isMedianApp() || !window.median?.audio?.startRecording) return false;
  try {
    window.median.audio.startRecording({ format: 'aac', sampleRate: 44_100 });
    return true;
  } catch (error) {
    console.warn('[NexaChat voice bridge] Native recording could not start.', error);
    return false;
  }
}

/** Stops a native recording and resolves the temporary audio URL and duration. */
export async function stopNativeRecording(): Promise<NativeVoiceRecording | null> {
  const stop = window.median?.audio?.stopRecording;
  if (!isMedianApp() || !stop) return null;
  try {
    return await stop();
  } catch (error) {
    console.warn('[NexaChat voice bridge] Native recording could not stop.', error);
    return null;
  }
}
