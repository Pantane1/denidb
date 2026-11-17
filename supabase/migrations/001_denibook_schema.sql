-- DeniBook Multi-Tenant Supabase PostgreSQL Schema, Profiles & Atomic Triggers
-- Run this migration in your Supabase SQL Editor or via Supabase CLI.

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Shop Owner Profiles (1 row per authenticated user)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL DEFAULT 'My Shop' CHECK (char_length(trim(shop_name)) > 0),
  currency TEXT NOT NULL DEFAULT 'KES',
  country_code TEXT NOT NULL DEFAULT '254',
  whatsapp_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_template TEXT;

-- 3. Core Multi-Tenant Ledger Tables (user_id defaults to auth.uid())
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  whatsapp_number TEXT NOT NULL CHECK (char_length(trim(whatsapp_number)) > 0),
  credit_limit NUMERIC(12, 2) CHECK (credit_limit IS NULL OR credit_limit > 0),
  total_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12, 2);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_tx_id UUID UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('DEBT', 'PAYMENT')),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('CASH', 'MPESA')),
  product_name TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  split_count INT NOT NULL DEFAULT 1 CHECK (split_count >= 1),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS client_tx_id UUID;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_client_tx_id_key'
  ) THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_client_tx_id_key UNIQUE (client_tx_id);
  END IF;
END $$;

-- Safe upgrade if earlier migration created owner_id instead of user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'owner_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.clients RENAME COLUMN owner_id TO user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'owner_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.products RENAME COLUMN owner_id TO user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'owner_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.transactions RENAME COLUMN owner_id TO user_id;
  END IF;
END $$;

-- Clean up any legacy unowned rows before enforcing defaults
DELETE FROM public.products WHERE user_id IS NULL;

-- 4. Indexes for fast mobile queries
DROP INDEX IF EXISTS idx_clients_owner_balance;
DROP INDEX IF EXISTS idx_products_owner;
DROP INDEX IF EXISTS idx_transactions_owner_created;

CREATE INDEX IF NOT EXISTS idx_clients_user_balance ON public.clients (user_id, total_balance DESC);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients (name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_user_whatsapp_unique ON public.clients (user_id, whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_products_user ON public.products (user_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_client_created ON public.transactions (client_id, created_at DESC);

-- 5. Auto-provision Profile & Default Product ("Fert" @ 50) on User Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_name TEXT;
BEGIN
  v_shop_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'shop_name'), ''),
    'My Shop'
  );

  INSERT INTO public.profiles (id, shop_name)
  VALUES (NEW.id, v_shop_name)
  ON CONFLICT (id) DO UPDATE
    SET shop_name = EXCLUDED.shop_name,
        updated_at = now();

  INSERT INTO public.products (user_id, name, unit_price, is_default)
  SELECT NEW.id, 'Fert', 50, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products WHERE user_id = NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

-- 6. Atomic Balance Synchronization Trigger
CREATE OR REPLACE FUNCTION public.sync_client_total_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_client_id UUID;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_client_id := OLD.client_id;
  ELSE
    target_client_id := NEW.client_id;
  END IF;

  UPDATE public.clients
  SET
    total_balance = COALESCE((
      SELECT SUM(
        CASE
          WHEN t.type = 'DEBT' THEN t.amount
          WHEN t.type = 'PAYMENT' THEN -t.amount
          ELSE 0
        END
      )
      FROM public.transactions t
      WHERE t.client_id = target_client_id
    ), 0),
    updated_at = now()
  WHERE id = target_client_id;

  IF (TG_OP = 'UPDATE' AND OLD.client_id IS DISTINCT FROM NEW.client_id) THEN
    UPDATE public.clients
    SET
      total_balance = COALESCE((
        SELECT SUM(
          CASE
            WHEN t.type = 'DEBT' THEN t.amount
            WHEN t.type = 'PAYMENT' THEN -t.amount
            ELSE 0
          END
        )
        FROM public.transactions t
        WHERE t.client_id = OLD.client_id
      ), 0),
      updated_at = now()
    WHERE id = OLD.client_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_balance ON public.transactions;
CREATE TRIGGER trg_sync_client_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_total_balance();

-- 7. Atomic Split-Sale RPC (handles single or multi-client split sales in one DB transaction)
CREATE OR REPLACE FUNCTION public.record_split_sale(
  p_client_ids UUID[],
  p_product_name TEXT,
  p_quantity NUMERIC,
  p_total_amount NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS SETOF public.transactions
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_count INT := array_length(p_client_ids, 1);
  v_base_share NUMERIC(12, 2);
  v_remainder NUMERIC(12, 2);
  v_share NUMERIC(12, 2);
  v_i INT;
  v_tx public.transactions;
BEGIN
  IF v_count IS NULL OR v_count < 1 THEN
    RAISE EXCEPTION 'At least one client must be selected';
  END IF;

  v_base_share := floor((p_total_amount / v_count) * 100) / 100;
  v_remainder := round(p_total_amount - (v_base_share * v_count), 2);

  FOR v_i IN 1..v_count LOOP
    v_share := v_base_share;
    IF v_i = 1 AND v_remainder > 0 THEN
      v_share := v_base_share + v_remainder;
    END IF;

    INSERT INTO public.transactions (
      user_id,
      client_id,
      type,
      product_name,
      quantity,
      split_count,
      amount,
      note
    )
    VALUES (
      auth.uid(),
      p_client_ids[v_i],
      'DEBT',
      p_product_name,
      p_quantity,
      v_count,
      v_share,
      p_note
    )
    RETURNING * INTO v_tx;

    RETURN NEXT v_tx;
  END LOOP;
END;
$$;

-- 8. Strict Multi-Tenant Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User manages own profile" ON public.profiles;
CREATE POLICY "User manages own profile"
ON public.profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Owner manages clients" ON public.clients;
CREATE POLICY "Owner manages clients"
ON public.clients
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner manages products" ON public.products;
CREATE POLICY "Owner manages products"
ON public.products
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner manages transactions" ON public.transactions;
CREATE POLICY "Owner manages transactions"
ON public.transactions
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
