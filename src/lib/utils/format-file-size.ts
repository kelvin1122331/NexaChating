/** Formats a file size using readable binary units. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1_024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1_024)) - 1, units.length - 1);
  return `${(bytes / 1_024 ** (exponent + 1)).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
