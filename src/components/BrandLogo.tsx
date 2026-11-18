import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  onClick?: () => void;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export const BrandMarkSvg: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect x="1.5" y="1.5" width="45" height="45" rx="12" fill="#07111F" />
    <rect x="1.5" y="1.5" width="45" height="45" rx="12" stroke="#1E293B" strokeWidth="1.5" />
    {/* Digital Ledger Card */}
    <rect x="10.5" y="9" width="24" height="28.5" rx="4.5" fill="#FFFFFF" />
    {/* Header & Structured Record Bars */}
    <rect x="14.5" y="13.5" width="12" height="3" rx="1.5" fill="#0F766E" />
    <rect x="14.5" y="19.5" width="16" height="2.4" rx="1.2" fill="#94A3B8" />
    <rect x="14.5" y="24" width="12.5" height="2.4" rx="1.2" fill="#CBD5E1" />
    <rect x="14.5" y="28.5" width="9" height="2.4" rx="1.2" fill="#CBD5E1" />
    {/* Emerald Verified Settlement Badge */}
    <circle cx="33" cy="33" r="8.25" fill="#10B981" stroke="#07111F" strokeWidth="2.4" />
    <path
      d="M29.6 33L31.9 35.3L36.5 30.7"
      stroke="#FFFFFF"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showSubtitle = false,
  onClick,
  className = '',
}) => {
  const content = (
    <>
      <BrandMarkSvg className={`${SIZE_CLASSES[size]} shrink-0`} />
      <span className="flex flex-col text-left leading-none min-w-0">
        <span
          className={`font-bold tracking-tight text-stone-900 dark:text-stone-50 whitespace-nowrap ${
            size === 'sm' ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
          }`}
        >
          DeniBook
        </span>
        {showSubtitle && (
          <span className="mt-1 text-[11px] font-medium text-stone-500 dark:text-stone-400 whitespace-nowrap">
            Smart Credit &amp; Sales Ledger
          </span>
        )}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-2.5 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-xl ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      {content}
    </div>
  );
};
