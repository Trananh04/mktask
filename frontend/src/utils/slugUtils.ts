/**
 * Extracts the UUID from a string that might contain a slug suffix.
 * A UUID is 36 characters long.
 * Example: "123e4567-e89b-12d3-a456-426614174000-my-task-slug" -> "123e4567-e89b-12d3-a456-426614174000"
 */
export const extractUuid = (id: string | undefined | null): string | null => {
  if (!id) return null;

  // UUIDs are 36 characters long (32 hex digits + 4 hyphens)
  // If the ID is longer than 36 chars and starts with a UUID pattern, extract it.
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = id.match(uuidPattern);

  if (match) {
    return match[0];
  }

  // Fallback: if it doesn't look like a UUID at start, just return the ID (might be invalid or legacy)
  return id;
};

/**
 * Generates a URL-friendly slug from a string (e.g., task title or project name).
 * Supports Vietnamese and other Unicode characters via NFD normalization.
 * Vietnamese-specific characters (đ/Đ) are explicitly mapped before normalization.
 */
export const generateSlug = (text: string): string => {
  if (!text) return '';
  const slug = text
    .toString()
    // Handle Vietnamese đ/Đ before NFD normalization (they don't decompose)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    // NFD decomposition separates base letters from diacritics
    .normalize('NFD')
    // Remove all combining diacritical marks (accents, tone marks, etc.)
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, '-and-')       // Replace & with 'and'
    .replace(/[^a-z0-9\s._-]/g, '') // Remove remaining unsafe chars
    .replace(/[\s_]+/g, '-')      // Replace spaces/underscores with -
    .replace(/-+/g, '-')          // Replace multiple - with single -
    .replace(/^-|-$/g, '');       // Remove leading/trailing dashes

  // Ensure we always return something — fallback to timestamp if input maps to nothing
  return slug || `project-${Date.now()}`;
};

/**
 * Validates if a string is a safe slug (alphanumeric, hyphens, dots, underscores).
 * Prevents open redirect attacks via malicious workspace/project slugs.
 */
export const isValidSlug = (slug: any): slug is string => {
  if (typeof slug !== 'string') return false;
  if (slug.length === 0) return false;
  // Allow alphanumeric (Unicode letters allowed), hyphens, dots and underscores (consistent with sanitizeSlug in projectApi)
  return /^[\p{L}0-9._-]+$/u.test(slug);
};
