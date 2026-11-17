import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, Lock, LogOut, Moon, Sun, UserPlus } from 'lucide-react';
import { AddClientModal } from './components/AddClientModal';
import { AuthScreen } from './components/AuthScreen';
import { ClientGrid } from './components/ClientGrid';
import { ClientProfileDrawer } from './components/ClientProfileDrawer';
import { PinLockScreen } from './components/PinLockScreen';
import { ProductSettings } from './components/ProductSettings';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SetNewPasswordModal } from './components/SetNewPasswordModal';
import { SummaryKPIs } from './components/SummaryKPIs';
import { SyncStatusPill } from './components/SyncStatusPill';
import { TapCounterBar } from './components/TapCounterBar';
import { ToastStack } from './components/ToastStack';
import { ZReportModal } from './components/ZReportModal';
import { AuthProvider, useAuth } from './lib/auth';
import { DeniBookProvider, useDeniBook } from './lib/store';

type AppTab = 'ledger' | 'settings';

const DeniBookShell: React.FC = () => {
  const { user, profile, isPasswordRecovery } = useAuth();
  const {
    clients,
    isLocked,
    isInitialLoading,
    settings,
    updateSettings,
    lockApp,
    logoutAndClear,
  } = useDeniBook();
  const [activeTab, setActiveTab] = useState<AppTab>('ledger');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [profileClientId, setProfileClientId] = useState<string | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showZReport, setShowZReport] = useState(false);

  const selectedClients = useMemo(
    () => clients.filter((c) => selectedIds.includes(c.id)),
    [clients, selectedIds]
  );

  if (isLocked) {
    return <PinLockScreen />;
  }

  const displayShopName = profile?.shop_name || settings.shopName || 'My Shop';

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-[#F6F7F5] dark:bg-[#0B0F0E] text-stone-900 dark:text-stone-100">
      {/* Compact Sticky Top Bar (56px, 3 zones) */}
      <header className="sticky top-0 z-30 h-14 bg-white/90 dark:bg-[#131917]/90 backdrop-blur-md border-b border-stone-200 dark:border-[#222B28] no-print">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className="text-lg font-bold tracking-tight text-teal-800 dark:text-teal-400 whitespace-nowrap shrink-0"
          >
            DeniBook
          </button>

          {/* Zone 2: Concise Single-Line Navigation */}
          <nav
            className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-semibold"
            aria-label="Main navigation"
          >
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`min-h-[40px] border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'ledger'
                  ? 'border-teal-700 text-stone-900 dark:border-teal-400 dark:text-stone-50'
                  : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Ledger
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`min-h-[40px] border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'settings'
                  ? 'border-teal-700 text-stone-900 dark:border-teal-400 dark:text-stone-50'
                  : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() => setShowZReport(true)}
              className="min-h-[36px] px-2.5 sm:px-3 rounded-lg bg-[#07111F] hover:bg-[#0E1D33] text-emerald-300 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Daily Z-Report</span>
              <span className="sm:hidden">Z-Report</span>
            </button>
            <div className="hidden md:block">
              <PWAInstallButton variant="compact" />
            </div>
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddClient(true)}
              className="min-h-[40px] px-3 sm:px-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-[0.98] transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Client</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </header>

      <main
        className={`max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 no-print ${
          selectedClients.length > 0 ? 'pb-60 sm:pb-52' : 'pb-12'
        }`}
      >
        {activeTab === 'ledger' ? (
          <div className="space-y-5">
            {/* Personalized Shop Dashboard Header & Sync Status Pill */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 flex flex-wrap items-center gap-2.5">
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-50 truncate">
                    {displayShopName}
                  </h1>
                  <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                    Daily Credit Book · {user?.email}
                  </p>
                </div>
                <SyncStatusPill />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="sm:hidden">
                  <PWAInstallButton variant="compact" />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })
                  }
                  aria-label="Toggle light or dark theme"
                  className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] text-stone-700 dark:text-stone-200 flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  {settings.theme === 'light' ? (
                    <Moon className="w-4 h-4" />
                  ) : (
                    <Sun className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {settings.theme === 'light' ? 'Dark' : 'Light'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={lockApp}
                  aria-label="Lock DeniBook with PIN"
                  className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] text-stone-700 dark:text-stone-200 flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  <Lock className="w-4 h-4" />
                  <span className="hidden sm:inline">Lock</span>
                </button>
                <button
                  type="button"
                  onClick={logoutAndClear}
                  aria-label="Sign out or switch account"
                  className="min-h-[40px] min-w-[40px] px-3 rounded-xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] text-stone-700 dark:text-stone-200 flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-950/30 dark:hover:text-rose-300 transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>

            {isInitialLoading && clients.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#131917] border border-stone-200 dark:border-[#222B28] p-10 flex flex-col items-center justify-center gap-3 text-stone-500 dark:text-stone-400">
                <Loader2 className="w-6 h-6 animate-spin text-teal-700 dark:text-teal-400" />
                <p className="text-sm font-medium">Loading {displayShopName} ledger...</p>
              </div>
            ) : (
              <>
                <SummaryKPIs />

                <ClientGrid
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onClearSelection={() => setSelectedIds([])}
                  onOpenProfile={(client) => setProfileClientId(client.id)}
                  onOpenAddClient={() => setShowAddClient(true)}
                />
              </>
            )}
          </div>
        ) : (
          <ProductSettings onOpenZReport={() => setShowZReport(true)} />
        )}

        <footer className="mt-10 pt-5 border-t border-stone-200/80 dark:border-[#222B28] text-center">
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
        </footer>
      </main>

      {/* Tap-to-Count Action Bar (renders when 1+ clients selected) */}
      {activeTab === 'ledger' && (
        <div className="no-print">
          <TapCounterBar
            selectedClients={selectedClients}
            onClearSelection={() => setSelectedIds([])}
          />
        </div>
      )}

      {/* Client Profile & Ledger Drawer */}
      {profileClientId && (
        <div className="no-print">
          <ClientProfileDrawer
            clientId={profileClientId}
            onClose={() => setProfileClientId(null)}
            onSelectClient={(id) => setProfileClientId(id)}
          />
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClient && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onSaved={(created) => {
            setActiveTab('ledger');
            setSelectedIds([created.id]);
          }}
          onOpenExistingClient={(existing) => {
            setActiveTab('ledger');
            setProfileClientId(existing.id);
          }}
        />
      )}

      {/* Daily Z-Report Modal */}
      {showZReport && <ZReportModal onClose={() => setShowZReport(false)} />}

      {/* Password Recovery Modal */}
      {isPasswordRecovery && <SetNewPasswordModal />}

      <div className="no-print">
        <ToastStack />
      </div>
    </div>
  );
};

const AuthGate: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F7F5] dark:bg-[#0B0F0E] flex flex-col items-center justify-center gap-3 px-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-700 dark:text-teal-400" />
        <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
          Checking shop session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <DeniBookProvider key={user.id}>
      <DeniBookShell />
    </DeniBookProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
