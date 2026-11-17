export function normalizePhoneNumber(raw: string, defaultCountryCode = '254'): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const hadPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return '';

  const code = defaultCountryCode.replace(/\D/g, '') || '254';

  if (hadPlus) {
    return digitsOnly;
  }

  if (digitsOnly.startsWith('00') && digitsOnly.length > 2) {
    return digitsOnly.slice(2);
  }

  // Convert local numbers starting with 0 (e.g. 07XXXXXXXX or 01XXXXXXXX) to country code format
  if (digitsOnly.startsWith('0')) {
    const subscriber = digitsOnly.slice(1);
    return subscriber ? `${code}${subscriber}` : '';
  }

  // If 9 digits like 712345678 or 112345678, prepend country code
  if (digitsOnly.length === 9 && !digitsOnly.startsWith(code)) {
    return `${code}${digitsOnly}`;
  }

  return digitsOnly;
}

export function sanitizeWhatsAppNumber(raw: string, defaultCountryCode = '254'): string {
  return normalizePhoneNumber(raw, defaultCountryCode);
}

export function isValidWhatsAppNumber(raw: string, defaultCountryCode = '254'): boolean {
  const digits = normalizePhoneNumber(raw, defaultCountryCode);
  return digits.length >= 10 && digits.length <= 15;
}

export function formatPhoneDisplay(sanitizedDigits: string): string {
  const digits = sanitizedDigits.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('254') && digits.length === 12) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return `+${digits}`;
}

export interface WhatsAppMessageParams {
  clientName: string;
  currency: string;
  totalOwed: number;
  latestDate: string;
  recentItems: string;
}

export const DEFAULT_WHATSAPP_TEMPLATE =
  'Hi {name}, friendly reminder regarding your current balance of {currency} {balance} for items taken up to {date}. Kindly settle when you can. Thanks!';

export function buildWhatsAppMessage(template: string, params: WhatsAppMessageParams): string {
  const formattedBalance = Number.isInteger(params.totalOwed)
    ? params.totalOwed.toLocaleString('en-US')
    : params.totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return template
    .replace(/\{name\}/gi, params.clientName)
    .replace(/\{currency\}/gi, params.currency)
    .replace(/\{balance\}/gi, formattedBalance)
    .replace(/\{date\}/gi, params.latestDate)
    .replace(/\{items\}/gi, params.recentItems || 'recent items');
}

export function buildWhatsAppUrl(
  rawPhone: string,
  message: string,
  defaultCountryCode = '254'
): string {
  const digits = sanitizeWhatsAppNumber(rawPhone, defaultCountryCode);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
