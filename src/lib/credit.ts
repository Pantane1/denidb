export interface CreditHealth {
  hasLimit: boolean;
  percent: number;
  clampedPercent: number;
  level: 'healthy' | 'near' | 'over';
  label: string;
  barClass: string;
  textClass: string;
}

export function getCreditHealth(
  totalBalance: number,
  creditLimit?: number | null
): CreditHealth {
  if (!creditLimit || creditLimit <= 0) {
    return {
      hasLimit: false,
      percent: 0,
      clampedPercent: 0,
      level: 'healthy',
      label: 'Unlimited',
      barClass: 'bg-emerald-600',
      textClass: 'text-emerald-700 dark:text-emerald-400',
    };
  }

  const ratio = totalBalance / creditLimit;
  const percent = Math.round(ratio * 100);
  const clampedPercent = Math.min(100, Math.max(0, percent));

  if (ratio >= 1) {
    return {
      hasLimit: true,
      percent,
      clampedPercent,
      level: 'over',
      label: 'Over Limit',
      barClass: 'bg-rose-600 dark:bg-rose-500',
      textClass: 'text-rose-700 dark:text-rose-400',
    };
  }

  if (ratio >= 0.8) {
    return {
      hasLimit: true,
      percent,
      clampedPercent,
      level: 'near',
      label: 'Near Limit',
      barClass: 'bg-amber-500 dark:bg-amber-400',
      textClass: 'text-amber-700 dark:text-amber-400',
    };
  }

  return {
    hasLimit: true,
    percent,
    clampedPercent,
    level: 'healthy',
    label: 'Healthy',
    barClass: 'bg-emerald-600 dark:bg-emerald-500',
    textClass: 'text-emerald-700 dark:text-emerald-400',
  };
}
