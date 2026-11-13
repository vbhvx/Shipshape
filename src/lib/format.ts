/** "Just now", "5m ago", "3h ago", "2d ago", then a short date ("Nov 4"). */
export function formatRelativeTime(dateString: string, now = new Date()): string {
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Fallback zip name for a project when the server sends none. */
export function exportFileName(projectName: string): string {
  return `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'}-source.zip`;
}
