export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatNumber(value: number): string {
  const rounded = roundCurrency(value);
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.001;
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function formatCurrency(value: number, currency = 'KES'): string {
  const absFormatted = formatNumber(Math.abs(value));
  const prefix = value < 0 ? '-' : '';
  return `${prefix}${currency} ${absFormatted}`;
}

export function splitAmountEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [roundCurrency(total)];

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;

  return Array.from({ length: count }, (_, idx) => {
    const cents = idx < remainder ? baseCents + 1 : baseCents;
    return cents / 100;
  });
}

export function formatLedgerDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatShortDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function isSameLocalDay(isoA: string, dateB = new Date()): boolean {
  const a = new Date(isoA);
  return (
    a.getFullYear() === dateB.getFullYear() &&
    a.getMonth() === dateB.getMonth() &&
    a.getDate() === dateB.getDate()
  );
}
