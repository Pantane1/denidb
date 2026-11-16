-- DeniBook Supabase PostgreSQL Schema & Atomic Triggers
-- Run this migration in your Supabase SQL Editor or via Supabase CLI.

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  whatsapp_number TEXT NOT NULL CHECK (char_length(trim(whatsapp_number)) > 0),
  total_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('DEBT', 'PAYMENT')),
  product_name TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  split_count INT NOT NULL DEFAULT 1 CHECK (split_count >= 1),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for fast mobile queries
CREATE INDEX IF NOT EXISTS idx_clients_owner_balance ON public.clients (owner_id, total_balance DESC);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients (name);
CREATE INDEX IF NOT EXISTS idx_transactions_client_created ON public.transactions (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON public.transactions (created_at DESC);

-- 4. Atomic Balance Synchronization Trigger
CREATE OR REPLACE FUNCTION public.sync_client_total_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- If a transaction was reassigned to a different client, recalculate the old client too
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

-- 5. Atomic Split-Sale RPC (handles single or multi-client split sales in one DB transaction)
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
      client_id,
      type,
      product_name,
      quantity,
      split_count,
      amount,
      note
    )
    VALUES (
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

-- 6. Row Level Security (RLS)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policies: Each authenticated shop owner can read & manage their own records
DROP POLICY IF EXISTS "Owner manages clients" ON public.clients;
CREATE POLICY "Owner manages clients"
ON public.clients
FOR ALL
TO authenticated
USING (owner_id = auth.uid() OR owner_id IS NULL)
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner manages products" ON public.products;
CREATE POLICY "Owner manages products"
ON public.products
FOR ALL
TO authenticated
USING (owner_id = auth.uid() OR owner_id IS NULL)
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner manages transactions" ON public.transactions;
CREATE POLICY "Owner manages transactions"
ON public.transactions
FOR ALL
TO authenticated
USING (owner_id = auth.uid() OR owner_id IS NULL)
WITH CHECK (owner_id = auth.uid());

-- 7. Seed Default Product ("Fert" @ 50) for global/initial fallback
INSERT INTO public.products (owner_id, name, unit_price, is_default)
SELECT NULL, 'Fert', 50, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.products WHERE name = 'Fert' AND owner_id IS NULL
);
