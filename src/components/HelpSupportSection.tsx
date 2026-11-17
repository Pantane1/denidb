import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  HelpCircle,
  Mail,
  MessageCircle,
  X,
} from 'lucide-react';

interface GuideStep {
  id: string;
  title: string;
  summary: string;
  details: string[];
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'step-1',
    title: 'Step 1: Add Your Customers',
    summary: 'Save customer names and WhatsApp numbers in seconds.',
    details: [
      'Tap Add Client in the top-right corner of the home screen.',
      'Enter the customer name and WhatsApp phone number (e.g. 0712345678). DeniBook automatically adds your country code.',
      'Optionally enter a Credit Limit or leave it blank for unlimited credit.',
    ],
  },
  {
    id: 'step-2',
    title: 'Step 2: Tap-to-Sell & Split Mode',
    summary: 'Log a single sale or split a shared purchase across multiple buyers.',
    details: [
      'Tap 1 customer card for a single sale, or tap 2 or more cards to activate Split Mode automatically.',
      'Use the bottom tap bar to increment quantity (+1, -1, Reset) or choose Custom Amount.',
      'Expand Discount / Depo if you allowed a discount or collected an upfront deposit, then tap Save Debt.',
    ],
  },
  {
    id: 'step-3',
    title: 'Step 3: Set Credit Limits',
    summary: 'Monitor customer credit health and avoid risky balances.',
    details: [
      'Add an optional Credit Limit when creating or editing any customer.',
      'Cards show a color-coded usage bar: green under 80%, amber between 80% and 99%, and red at 100% or above.',
      'If a sale will push a customer past their limit, DeniBook shows a confirmation warning where you can either Cancel or Allow & Save Anyway.',
    ],
  },
  {
    id: 'step-4',
    title: 'Step 4: Record Payments & Void Mistakes',
    summary: 'Record cash or mobile repayments and fix accidental entries cleanly.',
    details: [
      'Tap the profile icon on any customer card to open their ledger drawer.',
      'Tap Record Payment and pick a quick preset (Full Balance, Half, 50, 100, 200, 500) or enter any custom amount.',
      'Made a mistake? Scroll through the customer history, tap Void / Delete on that entry, and confirm—their balance recalculates automatically.',
    ],
  },
  {
    id: 'step-5',
    title: 'Step 5: One-Tap WhatsApp Reminders & Offline Mode',
    summary: 'Send polite reminders instantly and keep selling without internet.',
    details: [
      'Tap the Notify (bell) icon on a customer card or inside their profile to open WhatsApp with their balance and reminder message pre-filled.',
      'If your mobile signal drops, keep adding customers, sales, and payments normally—they queue safely on your phone and sync automatically once you are back online.',
    ],
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-safe',
    question: 'Is my customer data safe if I lose my phone or log out?',
    answer:
      'Yes. Your customer directory, item catalog, and transaction ledger are safely backed up to the cloud under your account. If you lose your phone, switch devices, or log out, simply sign back in with your email and password to access your full shop ledger.',
  },
  {
    id: 'faq-privacy',
    question: 'Can other users see my clients or balances?',
    answer:
      'No. Every shop account has strict per-account data isolation. Only your authenticated login can view, add, or update your customers and debt records.',
  },
  {
    id: 'faq-offline',
    question: 'What happens if my internet cuts off while serving customers?',
    answer:
      'DeniBook switches smoothly to Offline Queue mode. Any new customer, credit sale, or payment you save is stored safely on your device with a pending sync badge in the header, and uploads automatically as soon as your connection returns.',
  },
  {
    id: 'faq-split',
    question: 'How do split bills work on odd numbers?',
    answer:
      'When splitting an odd amount (such as 100 across 3 buyers), DeniBook divides and rounds cleanly to 2 decimal places so every share adds up accurately to the total sale, and shows the exact per-person breakdown before you save.',
  },
  {
    id: 'faq-password',
    question: 'How do I reset a forgotten password?',
    answer:
      'On the Sign In screen, tap "Forgot Password?" below the password field, enter your account email, and tap "Send Reset Link". Open the link sent to your email to choose a new password and return straight to your shop ledger.',
  },
];

export const HelpSupportSection: React.FC = () => {
  const [openGuideId, setOpenGuideId] = useState<string | null>('step-1');
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-safe');
  const [showTermsModal, setShowTermsModal] = useState(false);

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. How to Use DeniBook (New User Walkthrough) */}
          <section className="rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-50">
                  How to Use DeniBook
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Quick step-by-step walkthrough for daily shop operations
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {GUIDE_STEPS.map((step) => {
                const isOpen = openGuideId === step.id;
                return (
                  <div
                    key={step.id}
                    className="rounded-xl border border-stone-200 dark:border-[#222B28] bg-stone-50/60 dark:bg-[#18201D] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenGuideId(isOpen ? null : step.id)}
                      aria-expanded={isOpen}
                      className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-stone-100/70 dark:hover:bg-[#1E2824] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                          {step.title}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          {step.summary}
                        </p>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-stone-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <ul className="px-4 pb-3.5 pt-1 border-t border-stone-200/70 dark:border-[#222B28] space-y-1.5 text-xs sm:text-sm text-stone-700 dark:text-stone-300 list-disc pl-8">
                        {step.details.map((line, i) => (
                          <li key={i} className="leading-relaxed">
                            {line}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Frequently Asked Questions (FAQs) */}
          <section className="rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <HelpCircle className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-50">
                  Frequently Asked Questions
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Answers about data safety, offline sync, splits, and passwords
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {FAQ_ITEMS.map((faq) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="rounded-xl border border-stone-200 dark:border-[#222B28] bg-stone-50/60 dark:bg-[#18201D] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                      aria-expanded={isOpen}
                      className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-stone-100/70 dark:hover:bg-[#1E2824] transition-colors"
                    >
                      <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        {faq.question}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-stone-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <p className="px-4 pb-3.5 pt-1.5 border-t border-stone-200/70 dark:border-[#222B28] text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* 3. Contact Support & Legal (Pantane Hub) */}
        <section className="rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-5 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-50">
                Need Help? Contact Support
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                Reach the Pantane Hub support team directly on WhatsApp, email, or our website.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="https://wa.me/254740312402?text=Hi%20Pantane%20Hub%2C%20I%20need%20help%20with%20DeniBook."
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 active:scale-[0.98] transition-all whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Chat on WhatsApp</span>
              </a>

              <a
                href="mailto:pantane254@gmail.com?subject=DeniBook%20Support"
                className="min-h-[44px] px-4 rounded-xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-950 text-sm font-semibold flex items-center gap-2 active:scale-[0.98] transition-all whitespace-nowrap"
              >
                <Mail className="w-4 h-4 shrink-0" />
                <span>Email Support</span>
              </a>

              <a
                href="https://pantane.is-a.dev/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>Pantane Hub</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-stone-100 dark:border-[#1E2724] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="min-h-[40px] self-start px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              <span>View Terms &amp; Conditions</span>
            </button>

            <p className="text-xs text-stone-500 dark:text-stone-400">
              DeniBook is a product of{' '}
              <a
                href="https://pantane.is-a.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-teal-700 dark:text-teal-400 hover:underline"
              >
                Pantane Hub
              </a>
            </p>
          </div>
        </section>
      </div>

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Terms and Conditions"
        >
          <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-[#1E2724] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-50">
                  DeniBook Terms &amp; Conditions
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                aria-label="Close Terms and Conditions"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
              <div>
                <h4 className="font-bold text-stone-900 dark:text-stone-100">
                  1. Acceptable Business Ledger Usage
                </h4>
                <p className="mt-1">
                  DeniBook is designed to help business owners record lawful retail credit sales,
                  customer payments, and balance reminders. You agree not to use the platform for
                  fraudulent bookkeeping, harassment, or unlawful activities.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 dark:text-stone-100">
                  2. Entry Verification &amp; Merchant Responsibility
                </h4>
                <p className="mt-1">
                  You are responsible for verifying customer names, phone numbers, product prices,
                  discounts, deposits, and repayment amounts entered into your ledger before saving
                  or sending WhatsApp reminders.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 dark:text-stone-100">
                  3. Data Ownership &amp; Privacy
                </h4>
                <p className="mt-1">
                  Each merchant owns 100% of their customer directory, catalog, and ledger records.
                  Your records are strictly isolated to your authenticated account and may be
                  exported via CSV at any time.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 dark:text-stone-100">
                  4. Service Availability &amp; Offline Sync
                </h4>
                <p className="mt-1">
                  While DeniBook is built for high uptime and offline queueing during network drops,
                  periodic maintenance or connectivity interruptions may occur. Always ensure queued
                  offline entries sync when your internet connection returns, and keep regular CSV
                  backups if required by your business.
                </p>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-stone-100 dark:border-[#1E2724] flex items-center justify-between gap-3 bg-stone-50/70 dark:bg-[#101513]">
              <span className="text-xs text-stone-500 dark:text-stone-400">
                Maintained by Pantane Hub
              </span>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="min-h-[42px] px-5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
