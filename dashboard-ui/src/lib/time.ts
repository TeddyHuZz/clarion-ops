export function formatTime(timestamp: string | number | Date): string {
  let date: Date;

  if (typeof timestamp === 'number') {
    // Unix timestamp (seconds) from Prometheus
    date = new Date(timestamp * 1000);
  } else if (typeof timestamp === 'string') {
    // Check if it's already a formatted time string (passthrough)
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(timestamp)) {
      return timestamp;
    }
    date = new Date(timestamp);
  } else {
    date = timestamp;
  }

  if (isNaN(date.getTime())) {
    return typeof timestamp === 'string' ? timestamp : 'Invalid Date';
  }

  return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
