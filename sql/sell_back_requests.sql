CREATE TABLE IF NOT EXISTS sell_back_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 card_id uuid,
 seller_id uuid REFERENCES auth.users(id),
 card_name text,
 amount numeric DEFAULT 0,
 status text DEFAULT 'pending',
 admin_note text,
 created_at timestamptz DEFAULT now(),
 updated_at timestamptz DEFAULT now()
);

ALTER TABLE sell_back_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sell request insert" ON sell_back_requests;
CREATE POLICY "sell request insert"
ON sell_back_requests
FOR INSERT
WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "sell request user read" ON sell_back_requests;
CREATE POLICY "sell request user read"
ON sell_back_requests
FOR SELECT
USING (auth.uid() = seller_id);