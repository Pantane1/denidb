export enum TransactionType {
  DEBT = 'DEBT',
  PAYMENT = 'PAYMENT',
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface UserProfile {
  id: string;
  shop_name: string;
  currency: string;
  country_code: string;
  whatsapp_template?: string | null;
}

export interface Client {
  id: string;
  user_id?: string;
  name: string;
  whatsapp_number: string;
  credit_limit?: number | null;
  total_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  user_id?: string;
  name: string;
  unit_price: number;
  is_default: boolean;
}

export interface LedgerTransaction {
  id: string;
  user_id?: string;
  client_id: string;
  client_tx_id?: string;
  type: TransactionType;
  product_name: string;
  quantity: number;
  split_count: number;
  amount: number;
  note?: string;
  created_at: string;
  pending_sync?: boolean;
}

export interface AppSettings {
  shopName: string;
  currency: string;
  countryCode: string;
  whatsappTemplate: string;
  theme: 'light' | 'dark';
  pinEnabled: boolean;
  pinCode: string;
}

export type ClientFilter = 'all' | 'owing' | 'settled';

export type OfflineQueueOp =
  | {
      id: string;
      kind: 'CREATE_CLIENT';
      payload: Client;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'UPDATE_CLIENT';
      payload: {
        id: string;
        name: string;
        whatsapp_number: string;
        credit_limit: number | null;
        updated_at: string;
      };
      createdAt: string;
    }
  | {
      id: string;
      kind: 'ADD_TRANSACTIONS';
      payload: LedgerTransaction[];
      createdAt: string;
    };

export interface ToastItem {
  id: string;
  message: string;
  tone: 'success' | 'info' | 'error';
}
