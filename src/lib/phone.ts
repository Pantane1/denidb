export function sanitizeWhatsAppNumber(raw: string, defaultCountryCode = '254'): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (!cleaned) return '';

  const code = defaultCountryCode.replace(/\D/g, '') || '254';

  if (cleaned.startsWith('+')) {
    return cleaned.slice(1).replace(/\D/g, '');
  }

  if (cleaned.startsWith('00')) {
    return cleaned.slice(2).replace(/\D/g, '');
  }

  if (cleaned.startsWith('0')) {
    return `${code}${cleaned.slice(1).replace(/\D/g, '')}`;
  }

  // If 9 digits like 712345678, prepend country code
  if (cleaned.length === 9 && !cleaned.startsWith(code)) {
    return `${code}${cleaned}`;
  }

  return cleaned.replace(/\D/g, '');
}

export function isValidWhatsAppNumber(raw: string, defaultCountryCode = '254'): boolean {
  const digits = sanitizeWhatsAppNumber(raw, defaultCountryCode);
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
