/**
 * Derives a clean, professional application title from a user prompt or custom name input.
 * E.g. "build a todo app" -> "Todo App"
 *      "create a kanban board" -> "Kanban Board"
 *      "personal finance tracker" -> "Personal Finance Tracker"
 */
export function deriveProjectName(promptText: string, customName?: string): string {
  if (customName && customName.trim().length > 0) {
    return customName.trim().slice(0, 40);
  }

  let clean = (promptText || '').trim();

  // Strip leading command phrases (case-insensitive)
  clean = clean.replace(/^(build|create|generate|make|develop|design|code)\s+(an?|the)\s+/i, '');
  clean = clean.replace(/^(build|create|generate|make|develop|design|code)\s+/i, '');

  // Strip trailing punctuation
  clean = clean.replace(/[.,!?;:]+$/, '').trim();

  // Remove non-alphanumeric except spaces and hyphens
  clean = clean.replace(/[^a-zA-Z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim();

  if (!clean || clean.length < 2) {
    return 'New Project';
  }

  // Split into words, title-case first letters
  const words = clean.split(' ').slice(0, 5);
  const titleCased = words
    .map((w) => {
      if (w.length === 0) return '';
      // Keep acronyms like CRM, API, SQL uppercase if all upper
      if (w === w.toUpperCase() && w.length <= 4) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join(' ');

  return titleCased.slice(0, 36).trim() || 'New Project';
}

/**
 * Cleans a stored or legacy project title for UI display if it starts with raw command verbs.
 */
export function cleanDisplayTitle(rawName: string): string {
  if (!rawName) return 'Application';
  const trimmed = rawName.trim();
  if (/^(build|create|generate|make)\s+/i.test(trimmed)) {
    return deriveProjectName(trimmed);
  }
  return trimmed;
}

