import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  MessageCircle,
  Printer,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { TransactionType } from '../types';
import { useAuth } from '../lib/auth';
import {
  formatCurrency,
  formatLedgerDateTime,
  formatNumber,
  formatTimeOnly,
  formatZReportDate,
  roundCurrency,
  shiftDateKey,
  toLocalDateKey,
} from '../lib/currency';
import { useDeniBook } from '../lib/store';

interface ZReportModalProps {
  onClose: () => void;
}

export const ZReportModal: React.FC<ZReportModalProps> = ({ onClose }) => {
  const { profile } = useAuth();
  const { clients, transactions, settings, kpis, pushToast } = useDeniBook();

  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);

  const shopName = profile?.shop_name || settings.shopName || 'My Shop';
  const currency = settings.currency || 'KES';

  const report = useMemo(() => {
    const clientMap = new Map(clients.map((c) => [c.id, c]));

    const dayTxs = transactions
      .filter((tx) => toLocalDateKey(tx.created_at) === selectedDate)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let creditIssued = 0;
    let creditCount = 0;
    let totalCollected = 0;
    let paymentCount = 0;
    let cashCollected = 0;
    let mpesaCollected = 0;

    const itemMap = new Map<string, { productName: string; totalQty: number; totalValue: number }>();

    for (const tx of dayTxs) {
      if (tx.type === TransactionType.DEBT) {
        creditIssued = roundCurrency(creditIssued + tx.amount);
        creditCount += 1;

        const existing = itemMap.get(tx.product_name) || {
          productName: tx.product_name,
          totalQty: 0,
          totalValue: 0,
        };
        existing.totalQty = roundCurrency(existing.totalQty + (tx.quantity || 1));
        existing.totalValue = roundCurrency(existing.totalValue + tx.amount);
        itemMap.set(tx.product_name, existing);
      } else {
        totalCollected = roundCurrency(totalCollected + tx.amount);
        paymentCount += 1;
        if (tx.payment_method === 'MPESA') {
          mpesaCollected = roundCurrency(mpesaCollected + tx.amount);
        } else {
          cashCollected = roundCurrency(cashCollected + tx.amount);
        }
      }
    }

    const itemsSold = Array.from(itemMap.values()).sort((a, b) => b.totalValue - a.totalValue);
    const netChange = roundCurrency(creditIssued - totalCollected);

    const topDebtors = [...clients]
      .filter((c) => c.total_balance > 0)
      .sort((a, b) => b.total_balance - a.total_balance)
      .slice(0, 5);

    const activityRows = dayTxs.map((tx) => {
      const client = clientMap.get(tx.client_id);
      const isDebt = tx.type === TransactionType.DEBT;
      const itemOrMethod = isDebt
        ? `${tx.quantity}x ${tx.product_name}${tx.split_count > 1 ? ` (Split ${tx.split_count})` : ''}`
        : `${tx.product_name === 'Deposit' ? 'Deposit · ' : ''}${
            tx.payment_method === 'MPESA' ? 'M-Pesa' : 'Cash'
          }`;

      return {
        tx,
        time: formatTimeOnly(tx.created_at),
        clientName: client?.name || 'Unknown Client',
        whatsappNumber: client?.whatsapp_number || '',
        isDebt,
        itemOrMethod,
      };
    });

    return {
      creditIssued,
      creditCount,
      totalCollected,
      paymentCount,
      cashCollected,
      mpesaCollected,
      netChange,
      totalBookBalance: kpis.totalOwed,
      itemsSold,
      topDebtors,
      activityRows,
    };
  }, [clients, kpis.totalOwed, selectedDate, transactions]);

  const formattedDisplayDate = useMemo(() => formatZReportDate(selectedDate), [selectedDate]);

  const netLabel =
    report.netChange > 0
      ? `+${currency} ${formatNumber(report.netChange)}`
      : report.netChange < 0
        ? `-${currency} ${formatNumber(Math.abs(report.netChange))}`
        : `${currency} 0`;

  const whatsappShareUrl = useMemo(() => {
    const lines = [
      '📊 *DENIBOOK DAILY Z-REPORT*',
      `🏪 Shop: ${shopName}`,
      `📅 Date: ${formattedDisplayDate}`,
      '',
      `➕ Credit Issued: ${currency} ${formatNumber(report.creditIssued)} (${report.creditCount} ${
        report.creditCount === 1 ? 'sale' : 'sales'
      })`,
      `✅ Collected: ${currency} ${formatNumber(report.totalCollected)}`,
      `   • Cash: ${currency} ${formatNumber(report.cashCollected)}`,
      `   • M-Pesa: ${currency} ${formatNumber(report.mpesaCollected)}`,
      `📈 Net Change: ${netLabel}`,
      `💼 Total Book Balance: ${currency} ${formatNumber(report.totalBookBalance)}`,
    ];
    return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
  }, [currency, formattedDisplayDate, netLabel, report, shopName]);

  const handleDownloadCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const generatedAt = formatLedgerDateTime(new Date().toISOString());

    const headerBlock: string[][] = [
      ['DENIBOOK DAILY Z-REPORT'],
      ['Shop Name', shopName],
      ['Report Date', selectedDate],
      ['Generated At', generatedAt],
      ['Credit Issued', `${currency} ${formatNumber(report.creditIssued)}`, 'Sales Count', String(report.creditCount)],
      ['Total Collected', `${currency} ${formatNumber(report.totalCollected)}`, 'Payments Count', String(report.paymentCount)],
      ['Cash Collected', `${currency} ${formatNumber(report.cashCollected)}`],
      ['M-Pesa Collected', `${currency} ${formatNumber(report.mpesaCollected)}`],
      ['Net Daily Ledger Change', netLabel],
      ['Total Outstanding Book Balance', `${currency} ${formatNumber(report.totalBookBalance)}`],
    ];

    const tableHeaders = [
      'Time',
      'Client Name',
      'WhatsApp Number',
      'Type',
      'Item / Method',
      'Qty',
      'Split',
      'Amount',
    ];

    const tableRows = report.activityRows.map((row) => [
      row.time,
      row.clientName,
      row.whatsappNumber,
      row.isDebt ? 'CREDIT' : 'PAYMENT',
      row.itemOrMethod,
      String(row.tx.quantity),
      String(row.tx.split_count),
      row.isDebt ? String(row.tx.amount) : String(-row.tx.amount),
    ]);

    const csvLines = [
      ...headerBlock.map((r) => r.map(esc).join(',')),
      '',
      tableHeaders.map(esc).join(','),
      ...tableRows.map((r) => r.map(esc).join(',')),
    ];

    const csv = '\uFEFF' + csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `denibook-z-report-${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast(`Downloaded Z-Report CSV for ${formattedDisplayDate}`);
  };

  const handlePrint = () => {
    document.body.classList.add('printing-z-report');
    const cleanup = () => {
      document.body.classList.remove('printing-z-report');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    window.setTimeout(cleanup, 1500);
  };

  return (
    <div
      id="z-report-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Daily Z-Report End-of-Day Closing"
      onClick={onClose}
    >
      <div
        id="z-report-modal-shell"
        className="w-full sm:max-w-3xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Navy Modal Header */}
        <div className="bg-[#07111F] text-white px-5 py-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
                Daily Z-Report · End-of-Day Closing
              </h2>
              <p className="text-xs text-slate-300 truncate">
                {shopName} · {formattedDisplayDate}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Daily Z-Report"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Picker & Quick Day Switcher */}
        <div className="px-4 sm:px-6 py-3 bg-stone-50 dark:bg-[#101614] border-b border-stone-200 dark:border-[#222B28] flex flex-wrap items-center justify-between gap-2 shrink-0 no-print">
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftDateKey(d, -1))}
              className="min-h-[40px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#161D1B] text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1 whitespace-nowrap"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous Day</span>
              <span className="sm:hidden">Prev</span>
            </button>

            <input
              type="date"
              value={selectedDate}
              max={todayKey}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              aria-label="Select Z-Report date"
              className="min-h-[40px] flex-1 sm:flex-initial rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#161D1B] px-3 text-xs sm:text-sm font-mono-num font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <button
              type="button"
              disabled={selectedDate >= todayKey}
              onClick={() => setSelectedDate((d) => shiftDateKey(d, 1))}
              className="min-h-[40px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#161D1B] text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 flex items-center gap-1 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Next Day</span>
              <span className="sm:hidden">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedDate !== todayKey && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayKey)}
              className="min-h-[36px] px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 whitespace-nowrap"
            >
              Jump to Today
            </button>
          )}
        </div>

        {/* Scrollable Printable Report Body */}
        <div
          id="z-report-printable"
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#F6F7F5] dark:bg-[#0E1312]"
        >
          {/* Print-only Formal Header */}
          <div className="hidden print:block border-b border-stone-300 pb-3 mb-4">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-stone-900">
                  {shopName} — Daily Z-Report
                </h1>
                <p className="text-xs text-stone-600">
                  Closing Date: {formattedDisplayDate} ({selectedDate})
                </p>
              </div>
              <p className="text-xs text-stone-500 font-mono-num">
                Printed {formatLedgerDateTime(new Date().toISOString())}
              </p>
            </div>
          </div>

          {/* 4 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Credit Issued */}
            <div className="print-card rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  Credit Issued
                </p>
                <span className="text-xs font-mono-num font-semibold text-amber-700 dark:text-amber-400">
                  {report.creditCount} {report.creditCount === 1 ? 'sale' : 'sales'}
                </span>
              </div>
              <p className="mt-1.5 font-mono-num text-2xl font-bold text-stone-900 dark:text-stone-50">
                {formatCurrency(report.creditIssued, currency)}
              </p>
            </div>

            {/* 2. Total Collected + Cash / M-Pesa split */}
            <div className="print-card rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  Total Collected
                </p>
                <span className="text-xs font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                  {report.paymentCount} {report.paymentCount === 1 ? 'payment' : 'payments'}
                </span>
              </div>
              <p className="mt-1.5 font-mono-num text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(report.totalCollected, currency)}
              </p>
              <div className="mt-2 pt-2 border-t border-stone-100 dark:border-[#1E2724] flex items-center justify-between gap-2 text-xs font-mono-num text-stone-600 dark:text-stone-300">
                <span>Cash: {formatCurrency(report.cashCollected, currency)}</span>
                <span>M-Pesa: {formatCurrency(report.mpesaCollected, currency)}</span>
              </div>
            </div>

            {/* 3. Net Daily Ledger Change */}
            <div className="print-card rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  Net Daily Ledger Change
                </p>
                {report.netChange > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Receivables grew
                  </span>
                ) : report.netChange < 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    Receivables reduced
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                    Balanced
                  </span>
                )}
              </div>
              <p
                className={`mt-1.5 font-mono-num text-2xl font-bold ${
                  report.netChange > 0
                    ? 'text-amber-700 dark:text-amber-400'
                    : report.netChange < 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-stone-900 dark:text-stone-100'
                }`}
              >
                {netLabel}
              </p>
            </div>

            {/* 4. Total Outstanding Book Balance */}
            <div className="print-card rounded-2xl bg-[#07111F] text-white border border-slate-800 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-300">
                  Total Book Balance (Closing)
                </p>
                <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
              <p className="mt-1.5 font-mono-num text-2xl font-bold text-white">
                {formatCurrency(report.totalBookBalance, currency)}
              </p>
              <p className="mt-1 text-[11px] text-slate-300">
                Across {clients.filter((c) => c.total_balance > 0).length} active owing clients
              </p>
            </div>
          </div>

          {/* Items Sold on Credit + Top Debtors Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Items Sold on Credit */}
            <section className="print-card rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-4">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50">
                Items Sold on Credit ({formattedDisplayDate})
              </h3>
              {report.itemsSold.length === 0 ? (
                <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
                  No credit items recorded on this date.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-stone-100 dark:divide-[#1E2724]">
                  {report.itemsSold.map((item) => (
                    <li
                      key={item.productName}
                      className="py-2 flex items-center justify-between gap-3 text-xs sm:text-sm"
                    >
                      <span className="font-medium text-stone-800 dark:text-stone-200 truncate">
                        {item.productName}{' '}
                        <span className="text-stone-500 dark:text-stone-400 font-mono-num">
                          — {formatNumber(item.totalQty)}{' '}
                          {item.totalQty === 1 ? 'unit' : 'units'}
                        </span>
                      </span>
                      <span className="font-mono-num font-bold text-stone-900 dark:text-stone-100 shrink-0">
                        {formatCurrency(item.totalValue, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Top Debtors Snapshot */}
            <section className="print-card rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50">
                  Top Debtors Snapshot
                </h3>
                <Users className="w-4 h-4 text-stone-400" />
              </div>
              {report.topDebtors.length === 0 ? (
                <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
                  All customer balances are settled.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-stone-100 dark:divide-[#1E2724]">
                  {report.topDebtors.map((client, idx) => (
                    <li
                      key={client.id}
                      className="py-2 flex items-center justify-between gap-3 text-xs sm:text-sm"
                    >
                      <span className="font-medium text-stone-800 dark:text-stone-200 truncate">
                        <span className="font-mono-num text-stone-400 mr-1.5">
                          {idx + 1}.
                        </span>
                        {client.name}
                      </span>
                      <span className="font-mono-num font-bold text-rose-700 dark:text-rose-400 shrink-0">
                        {formatCurrency(client.total_balance, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Chronological Activity Log */}
          <section className="print-card rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50">
                Chronological Activity Log
              </h3>
              <span className="text-xs font-mono-num text-stone-500 dark:text-stone-400">
                {report.activityRows.length}{' '}
                {report.activityRows.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {report.activityRows.length === 0 ? (
              <p className="py-6 text-center text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                No transactions logged on {formattedDisplayDate}.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-[#222B28] text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Client</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Item / Method</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-[#1E2724]">
                    {report.activityRows.map(({ tx, time, clientName, isDebt, itemOrMethod }) => (
                      <tr key={tx.id}>
                        <td className="py-2.5 pr-3 font-mono-num text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">
                          {time}
                        </td>
                        <td className="py-2.5 pr-3 font-semibold text-stone-900 dark:text-stone-100">
                          {clientName}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          <span
                            className={`text-xs font-bold ${
                              isDebt
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {isDebt ? 'Credit' : 'Payment'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-stone-700 dark:text-stone-300">
                          {itemOrMethod}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono-num font-bold whitespace-nowrap ${
                            isDebt
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {isDebt ? '+' : '-'}
                          {formatCurrency(tx.amount, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-center text-[11px] text-stone-500 dark:text-stone-400 pt-1">
            Generated by DeniBook • Pantane Hub
          </p>
        </div>

        {/* 3 One-Tap Export Actions */}
        <div className="px-4 sm:px-6 py-3.5 bg-white dark:bg-[#131917] border-t border-stone-200 dark:border-[#222B28] grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0 no-print">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="min-h-[46px] px-4 rounded-xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-950 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Download CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[46px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#18201D] hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-100 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>Print / Save PDF</span>
          </button>

          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[46px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>Send to WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
};
