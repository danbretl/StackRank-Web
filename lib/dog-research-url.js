// A factual-source link exception, never an image-input or network TLS exception.
// CKU's own Tang standard was read at this exact legacy URL; HTTPS timed out.
// Its current HTTPS conservation and examination notices corroborate the source.
export const LEGACY_TANG_STANDARD = 'http://old.cku.org.cn/nativedog/tangdog.html';

export function validDogResearchUrl(value) {
  try {
    const url = new URL(value);
    return !url.username && !url.password &&
      (url.protocol === 'https:' || value === LEGACY_TANG_STANDARD);
  } catch { return false; }
}
