/**
 * Extracts a valid YouTube 11-character video ID from varied URL formats or direct IDs:
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://youtu.be/dQw4w9WgXcQ
 * - https://www.youtube.com/embed/dQw4w9WgXcQ
 * - https://www.youtube.com/shorts/dQw4w9WgXcQ
 * - dQw4w9WgXcQ
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  let trimmed = input.trim().replace(/^["'<(\[]+|[>"')\]]+$/g, '');

  // If already an 11-character alphanumeric/dash/underscore ID
  const directIdRegex = /^[a-zA-Z0-9_-]{11}$/;
  if (directIdRegex.test(trimmed)) {
    return trimmed;
  }

  // 1. Try URL parser if it is a URL or domain-based string
  try {
    let urlString = trimmed;
    if (!/^https?:\/\//i.test(urlString)) {
      urlString = 'https://' + urlString;
    }
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      const v = parsed.searchParams.get('v');
      if (v && directIdRegex.test(v)) {
        return v;
      }

      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        const prefix = pathParts[0].toLowerCase();
        const possibleId = pathParts[1];
        if (['embed', 'v', 'e', 'shorts', 'live'].includes(prefix) && directIdRegex.test(possibleId)) {
          return possibleId;
        }
      }
      if (pathParts.length === 1 && directIdRegex.test(pathParts[0])) {
        return pathParts[0];
      }
    } else if (host.includes('youtu.be')) {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 1 && directIdRegex.test(pathParts[0])) {
        return pathParts[0];
      }
    }
  } catch (e) {
    // Continue to regex fallback
  }

  // 2. Comprehensive regex fallback
  const fallbackRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = trimmed.match(fallbackRegex);
  if (match && match[1] && directIdRegex.test(match[1])) {
    return match[1];
  }

  return null;
}
