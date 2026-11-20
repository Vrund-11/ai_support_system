/**
 * Magic byte file signature detection and verification.
 * Rejects spoofed extensions and executable binaries.
 */

export interface MagicByteResult {
  valid: boolean;
  detectedMime: string | null;
  reason?: string;
}

/** Check if buffer matches a byte pattern at given offset */
function matchesBytes(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[offset + i] !== bytes[i]) return false;
  }
  return true;
}

/** Detect if buffer starts with executable signatures */
export function isExecutable(buffer: Buffer): boolean {
  // Windows MZ / PE header
  if (matchesBytes(buffer, [0x4d, 0x5a])) return true;
  // Linux ELF header (\x7fELF)
  if (matchesBytes(buffer, [0x7f, 0x45, 0x4c, 0x46])) return true;
  // Mach-O binary signatures
  if (
    matchesBytes(buffer, [0xfe, 0xed, 0xfa, 0xce]) ||
    matchesBytes(buffer, [0xfe, 0xed, 0xfa, 0xcf]) ||
    matchesBytes(buffer, [0xce, 0xfa, 0xed, 0xfe]) ||
    matchesBytes(buffer, [0xcf, 0xfa, 0xed, 0xfe])
  ) {
    return true;
  }
  return false;
}

/** Detect MIME type from buffer magic bytes */
export function detectMimeType(buffer: Buffer): string | null {
  if (!buffer || buffer.length === 0) return null;

  if (isExecutable(buffer)) {
    return 'application/x-executable';
  }

  // PDF: %PDF-
  if (matchesBytes(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return 'application/pdf';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (matchesBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (matchesBytes(buffer, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }

  // GIF: GIF87a or GIF89a
  if (
    matchesBytes(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    matchesBytes(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return 'image/gif';
  }

  // WebP: RIFF....WEBP
  if (
    matchesBytes(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    matchesBytes(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }

  // ZIP: PK\x03\x04
  if (matchesBytes(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    return 'application/zip';
  }

  // Check for plain text / markdown / JSON / CSV:
  // Must not have null bytes in first 512 bytes, valid utf-8
  const checkLen = Math.min(buffer.length, 512);
  let hasNull = false;
  for (let i = 0; i < checkLen; i++) {
    if (buffer[i] === 0x00) {
      hasNull = true;
      break;
    }
  }

  if (!hasNull) {
    const textSample = buffer.subarray(0, checkLen).toString('utf8');
    const trimmed = textSample.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'application/json';
    }
    return 'text/plain';
  }

  return null;
}

/**
 * Validate that buffer magic bytes match the declared MIME type.
 * Rejects spoofed extensions (e.g. .exe disguised as .pdf).
 */
export function validateFileSignature(buffer: Buffer, declaredMime: string): MagicByteResult {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      detectedMime: null,
      reason: 'Empty file buffer',
    };
  }

  if (isExecutable(buffer)) {
    return {
      valid: false,
      detectedMime: 'application/x-executable',
      reason: 'Executable binaries are strictly prohibited',
    };
  }

  const detected = detectMimeType(buffer);
  const normalizedDeclared = declaredMime.toLowerCase().trim();

  // Match rules
  switch (normalizedDeclared) {
    case 'application/pdf':
      if (detected !== 'application/pdf') {
        return {
          valid: false,
          detectedMime: detected,
          reason: `Spoofed file extension: declared ${declaredMime} but file signature is ${detected ?? 'unknown'}`,
        };
      }
      return { valid: true, detectedMime: detected };

    case 'image/png':
      if (detected !== 'image/png') {
        return {
          valid: false,
          detectedMime: detected,
          reason: `Spoofed file extension: declared ${declaredMime} but file signature is ${detected ?? 'unknown'}`,
        };
      }
      return { valid: true, detectedMime: detected };

    case 'image/jpeg':
    case 'image/jpg':
      if (detected !== 'image/jpeg') {
        return {
          valid: false,
          detectedMime: detected,
          reason: `Spoofed file extension: declared ${declaredMime} but file signature is ${detected ?? 'unknown'}`,
        };
      }
      return { valid: true, detectedMime: detected };

    case 'image/gif':
      if (detected !== 'image/gif') {
        return {
          valid: false,
          detectedMime: detected,
          reason: `Spoofed file extension: declared ${declaredMime} but file signature is ${detected ?? 'unknown'}`,
        };
      }
      return { valid: true, detectedMime: detected };

    case 'image/webp':
      if (detected !== 'image/webp') {
        return {
          valid: false,
          detectedMime: detected,
          reason: `Spoofed file extension: declared ${declaredMime} but file signature is ${detected ?? 'unknown'}`,
        };
      }
      return { valid: true, detectedMime: detected };

    case 'text/plain':
    case 'text/markdown':
    case 'text/csv':
      if (detected !== 'text/plain' && detected !== 'application/json') {
        return {
          valid: false,
          detectedMime: detected,
          reason: `Spoofed file extension: declared ${declaredMime} contains binary data or invalid characters`,
        };
      }
      return { valid: true, detectedMime: detected };

    case 'application/json':
      if (detected !== 'application/json' && detected !== 'text/plain') {
        return {
          valid: false,
          detectedMime: detected,
          reason: `Spoofed file extension: declared ${declaredMime} is not valid JSON text`,
        };
      }
      return { valid: true, detectedMime: detected };

    default:
      // Unknown or custom mime: ensure at least not executable and signature isn't mismatched with standard types
      if (detected && detected !== normalizedDeclared) {
        return {
          valid: false,
          detectedMime: detected,
          reason: `MIME type mismatch: declared ${declaredMime} but detected ${detected}`,
        };
      }
      return { valid: true, detectedMime: detected };
  }
}
