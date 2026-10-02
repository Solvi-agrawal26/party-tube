/**
 * Extracts an 11-character YouTube video ID from various URL patterns
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

/**
 * Formats time in seconds to mm:ss or hh:mm:ss
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(remainingSeconds)}`;
  }
  return `${pad(minutes)}:${pad(remainingSeconds)}`;
}

/**
 * Returns a stable vibrant avatar color for a username
 */
export function getAvatarColor(username: string): string {
  const colors = [
    'linear-gradient(135deg, #6366f1, #a855f7)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
    'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}
