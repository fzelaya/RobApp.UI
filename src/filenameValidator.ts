/**
 * Filename validation for uploaded reports.
 *
 * Goals:
 *  - Only accept the extension we can actually process (.docx).
 *  - Block characters that are unsafe for a filesystem path or that enable
 *    path traversal (../, absolute paths, null bytes, separators).
 *  - Block Windows-reserved device names, since the extracted spreadsheet
 *    may end up on a Windows machine even if this server doesn't run one.
 *  - Give back one specific, actionable reason on failure rather than a
 *    generic "invalid filename".
 *
 * This never tries to "fix" a bad name (e.g. by stripping characters) --
 * the user asked for validation, so a bad name is rejected outright and the
 * person re-uploads with a corrected name. Silently renaming a file behind
 * the user's back is confusing and can mask the exact problem.
 */

export interface FilenameValidationResult {
  valid: boolean;
  /** Present only when valid is false. */
  reason?: string;
  /** The name with its extension stripped, for reference in error messages. */
  baseName?: string;
}

const MAX_NAME_LENGTH = 150;

// Windows reserved device names (case-insensitive), with or without an extension.
const RESERVED_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

// Allowed in the base name: letters (incl. accented), digits, spaces,
// hyphen, underscore, parentheses, and a single dot used only as a
// decimal-style separator (not consecutive dots, not leading/trailing).
const ALLOWED_BASENAME_CHARS = /^[\p{L}\p{N} ()_.-]+$/u;

// Characters that are always rejected outright, called out individually so
// the error message can be specific about *why*.
const PATH_SEPARATOR_CHARS = /[\/\\]/;
const WINDOWS_RESERVED_CHARS = /[<>:"|?*]/;
const CONTROL_CHARS = /[\x00-\x1F\x7F]/;

export function validateFilename(rawName: string): FilenameValidationResult {
  const name = rawName.normalize("NFC");

  if (name.trim().length === 0) {
    return { valid: false, reason: "Filename is empty." };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return { valid: false, reason: `Filename is too long (max ${MAX_NAME_LENGTH} characters).` };
  }

  if (CONTROL_CHARS.test(name)) {
    return { valid: false, reason: "Filename contains control characters, which are not allowed." };
  }

  if (PATH_SEPARATOR_CHARS.test(name)) {
    return { valid: false, reason: "Filename cannot contain \"/\" or \"\\\"." };
  }

  if (name.includes("..")) {
    return { valid: false, reason: "Filename cannot contain \"..\"." };
  }

  if (WINDOWS_RESERVED_CHARS.test(name)) {
    return {
      valid: false,
      reason: 'Filename cannot contain any of: < > : " | ? *',
    };
  }

  // Extension check -- must be exactly ".docx" (case-insensitive), and
  // there must be something before it.
  const extMatch = name.match(/^(.*)(\.[^.]+)$/);
  if (!extMatch) {
    return { valid: false, reason: 'Filename must end in ".docx" (no extension found).' };
  }

  const [, baseName, ext] = extMatch;

  if (ext.toLowerCase() !== ".docx") {
    return {
      valid: false,
      reason: `Unsupported file type "${ext}". Only .docx files are accepted (legacy .doc is not supported -- please save as .docx in Word first).`,
      baseName,
    };
  }

  if (baseName.trim().length === 0) {
    return { valid: false, reason: 'Filename cannot be just ".docx" -- give it a name.', baseName };
  }

  if (baseName.startsWith(".") || baseName.startsWith(" ") || baseName.endsWith(" ")) {
    return {
      valid: false,
      reason: "Filename cannot start with a dot/space or end with a space.",
      baseName,
    };
  }

  if (baseName.includes("..")) {
    return { valid: false, reason: 'Filename cannot contain "..".', baseName };
  }

  if (!ALLOWED_BASENAME_CHARS.test(baseName)) {
    return {
      valid: false,
      reason:
        "Filename can only contain letters, numbers, spaces, and the characters ( ) _ - . -- " +
        "please rename the file and try again.",
      baseName,
    };
  }

  const bareName = baseName.split(".")[0].toUpperCase();
  if (RESERVED_NAMES.has(bareName)) {
    return {
      valid: false,
      reason: `"${bareName}" is a reserved system name and can't be used as a filename.`,
      baseName,
    };
  }

  return { valid: true, baseName };
}
