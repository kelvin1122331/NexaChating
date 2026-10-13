'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { startNativeRecording, stopNativeRecording } from '@/lib/median/voice';

export interface VoiceRecording {
  file: File;
  durationSeconds: number;
}

export interface VoiceRecorderControls {
  isRecording: boolean;
  elapsedSeconds: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<VoiceRecording | null>;
  cancelRecording: () => void;
}

/** Captures a short microphone clip using MediaRecorder and releases the device on every exit. */
export function useVoiceRecorder(): VoiceRecorderControls {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const finishRef = useRef<((recording: VoiceRecording | null) => void) | null>(null);
  const discardRef = useRef(false);
  const nativeRecordingRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1_000)), 250);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    if (nativeRecordingRef.current || recorderRef.current?.state === 'recording') return;
    discardRef.current = false;
    chunksRef.current = [];
    if (startNativeRecording()) {
      nativeRecordingRef.current = true;
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      setIsRecording(true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Voice recording is not supported by this browser.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];
    discardRef.current = false;
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    recorder.addEventListener('dataavailable', (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); });
    recorder.addEventListener('stop', () => {
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1_000));
      const type = recorder.mimeType || 'audio/webm';
      const recording = discardRef.current || chunksRef.current.length === 0
        ? null
        : { file: new File(chunksRef.current, `voice-note-${Date.now()}.webm`, { type }), durationSeconds };
      const wasDiscarded = discardRef.current;
      setIsRecording(false);
      setElapsedSeconds(wasDiscarded ? 0 : durationSeconds);
      stopStream();
      finishRef.current?.(recording);
      finishRef.current = null;
    }, { once: true });
    recorder.start(250);
    setIsRecording(true);
  }, [stopStream]);

  const stopRecording = useCallback((): Promise<VoiceRecording | null> => {
    if (nativeRecordingRef.current) {
      nativeRecordingRef.current = false;
      return stopNativeRecording().then(async (nativeResult) => {
        const durationSeconds = nativeResult?.duration && Number.isFinite(nativeResult.duration)
          ? Math.max(1, Math.round(nativeResult.duration))
          : Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1_000));
        const shouldDiscard = discardRef.current;
        setIsRecording(false);
        setElapsedSeconds(shouldDiscard ? 0 : durationSeconds);
        if (!nativeResult || shouldDiscard) return null;
        try {
          const response = await fetch(nativeResult.url);
          if (!response.ok) throw new Error('Could not read the native recording.');
          const blob = await response.blob();
          const type = blob.type || 'audio/aac';
          return {
            file: new File([blob], `voice-note-${Date.now()}.aac`, { type }),
            durationSeconds,
          };
        } catch (error) {
          console.warn('[NexaChat voice recording] Native audio could not be loaded.', error);
          return null;
        }
      });
    }
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return Promise.resolve(null);
    return new Promise((resolve) => {
      finishRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    discardRef.current = true;
    if (nativeRecordingRef.current) void stopRecording();
    else if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else stopStream();
    setIsRecording(false);
    setElapsedSeconds(0);
  }, [stopRecording, stopStream]);

  return { isRecording, elapsedSeconds, startRecording, stopRecording, cancelRecording };
}
