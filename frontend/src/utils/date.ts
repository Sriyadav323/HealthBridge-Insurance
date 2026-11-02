const options: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' };

// Date-only values are calendar dates, not instants: never shift them into the prior day.
export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: dateOnly ? 'UTC' : 'America/Chicago' }).format(date);
}
