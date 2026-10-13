import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createMediaObjectPath, mediaExtensionForMime, validateAndPrepareMedia } from '@/lib/server/media';

describe('private media validation', () => {
  it('accepts only explicitly supported MIME types', () => {
    expect(mediaExtensionForMime('image/png')).toBe('png');
    expect(mediaExtensionForMime('image/svg+xml')).toBeNull();
    expect(mediaExtensionForMime('text/html')).toBeNull();
  });

  it('creates unpredictable keys inside the uploader-owned Storage folder', () => {
    const userId = 'a7b091e3-9d0e-4fa9-82c7-a4f5dc359bc7';
    const conversationId = 'f9677adc-26bc-4fdc-946b-994fc258054a';
    const first = createMediaObjectPath(userId, conversationId, 'image/webp');
    const second = createMediaObjectPath(userId, conversationId, 'image/webp');
    expect(first).toMatch(new RegExp(`^${userId}/${conversationId}/[\\w-]+\\.webp$`));
    expect(second).not.toBe(first);
    expect(createMediaObjectPath('../other-user', null, 'image/png')).toBeNull();
  });

  it('decodes valid images and prepares a thumbnail', async () => {
    const png = await sharp({ create: { width: 4, height: 3, channels: 3, background: '#2583e8' } }).png().toBuffer();
    const file = new File([png], 'small.png', { type: 'image/png' });
    const media = await validateAndPrepareMedia(file);
    expect(media.width).toBe(4);
    expect(media.height).toBe(3);
    expect(media.thumbnailPath).toContain('thumbnail.webp');
    expect(media.thumbnailBuffer?.byteLength).toBeGreaterThan(0);
  });

  it('rejects a spoofed image MIME type', async () => {
    const file = new File([new TextEncoder().encode('<svg onload="alert(1)"></svg>')], 'spoof.png', { type: 'image/png' });
    await expect(validateAndPrepareMedia(file)).rejects.toThrow(/MEDIA_IMAGE_INVALID|MEDIA_SIGNATURE_INVALID/);
  });

  it('rejects oversized files before reading their content', async () => {
    const file = new File([new Uint8Array(0)], 'empty.png', { type: 'image/png' });
    await expect(validateAndPrepareMedia(file)).rejects.toThrow('MEDIA_SIZE_INVALID');
  });
});
