export interface MedianRegistrationInfo {
  oneSignalUserId?: string;
  oneSignalPushToken?: string;
}
export interface MedianCaptureResult { url: string; mimeType?: string; }
export interface MedianMediaResult { url: string; mimeType: string; fileName?: string; }
export interface MedianLocationResult { latitude: number; longitude: number; accuracy: number; }
export interface MedianBridgeGlobal {
  onesignalInfo?: { getRegistrationId?: (callback: (data: MedianRegistrationInfo) => void) => void };
  oneSignalRegisterExternalUserId?: (params: { externalUserId: string }) => void;
  oneSignalRemoveExternalUserId?: () => void;
  camera?: { capture?: (params: { type: 'photo' | 'video'; quality: number; maxWidth: number; maxHeight: number; saveToGallery: boolean }) => Promise<MedianCaptureResult> };
  media?: { pick?: (params: { mediaType: 'image' | 'video' | 'mixed'; maxFiles: number }) => Promise<MedianMediaResult[]> };
  audio?: { startRecording?: (params: { format: 'aac'; sampleRate: number }) => void; stopRecording?: () => Promise<{ url: string; duration: number }> };
  geolocation?: { getCurrentPosition?: (params: { enableHighAccuracy: boolean; timeout: number }) => Promise<MedianLocationResult> };
  haptics?: { generate?: (params: { style: 'light' | 'medium' | 'heavy' | 'selection' }) => void };
  statusbar?: { set?: (params: { style: 'light' | 'dark'; color: string; overlay: boolean }) => void };
  navigationbar?: { set?: (params: { color: string }) => void };
  share?: { shareRequest?: (params: { title?: string; text?: string; url?: string }) => void };
}

declare global {
  interface Window {
    median?: MedianBridgeGlobal;
    gonative?: Record<string, unknown>;
  }
}

export {};
