import dns from 'dns/promises';
import net from 'net';
import { getDb } from '../db';

const AVATARS_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 8 * 1024 * 1024; // 8MB cap to prevent memory-exhaustion DoS

// Blocks SSRF against internal/private infrastructure (cloud metadata endpoints,
// localhost, RFC1918 ranges) — this URL is attacker-supplied via scraped TikTok data.
function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local / cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true; // loopback
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true; // link-local / unique-local
    return false;
  }
  return true; // unparseable — treat as unsafe
}

async function isSafeExternalUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const hostname = parsed.hostname;
  if (hostname === 'localhost' || hostname.endsWith('.local')) return false;
  if (net.isIP(hostname)) {
    return !isPrivateOrReservedIp(hostname);
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (records.length === 0) return false;
    return records.every(r => !isPrivateOrReservedIp(r.address));
  } catch {
    return false;
  }
}

export async function downloadAvatar(url: string, creatorId: string): Promise<string | null> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return null;
  }

  if (!(await isSafeExternalUrl(url))) {
    console.error(`Blocked avatar download to unsafe/internal URL for ${creatorId}: ${url}`);
    return null;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_AVATAR_BYTES) {
      console.error(`Avatar for ${creatorId} exceeds size limit (${contentLength} bytes), skipping`);
      return null;
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    let ext: string | null = null;

    if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
      ext = 'jpg';
    } else if (contentType.includes('image/png')) {
      ext = 'png';
    } else if (contentType.includes('image/webp')) {
      ext = 'webp';
    } else if (contentType.includes('image/gif')) {
      ext = 'gif';
    }

    if (!ext) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_AVATAR_BYTES) {
      console.error(`Avatar for ${creatorId} exceeded size limit after download, discarding`);
      return null;
    }
    const buffer = Buffer.from(arrayBuffer);

    const newFileName = `${creatorId}.${ext}`;
    const contentTypeByExt: Record<string, string> = {
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };

    const storage = getDb().storage.from(AVATARS_BUCKET);

    // Clean up old avatar files for this creatorId with a different extension.
    const { data: existing } = await storage.list('', { search: creatorId });
    const stale = (existing ?? []).filter(f => f.name.startsWith(`${creatorId}.`) && f.name !== newFileName);
    if (stale.length > 0) {
      await storage.remove(stale.map(f => f.name));
    }

    const { error: uploadError } = await storage.upload(newFileName, buffer, {
      contentType: contentTypeByExt[ext],
      upsert: true,
    });
    if (uploadError) {
      console.error(`Error uploading avatar for ${creatorId}:`, uploadError);
      return null;
    }

    const { data: publicUrlData } = storage.getPublicUrl(newFileName);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.error(`Error downloading avatar for ${creatorId}:`, err);
    return null;
  }
}
