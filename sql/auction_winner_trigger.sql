-- =====================================================
-- Eugene Card Auction Winner Trigger (IDR / Rp)
-- =====================================================

ALTER TABLE auctions
ADD COLUMN IF NOT EXISTS winner_id uuid
REFERENCES auth.users(id);

ALTER TABLE auctions
ADD COLUMN IF NOT EXISTS last_bid_at timestamptz;


CREATE OR REPLACE FUNCTION update_auction_winner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN

    UPDATE auctions
    SET
        current_bid = NEW.amount,
        winner_id = NEW.bidder_id,
        last_bid_at = now()

    WHERE id = NEW.auction_id
    AND (
        current_bid IS NULL
        OR NEW.amount > current_bid
    );

    RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS trigger_update_auction_winner
ON auction_bids;


CREATE TRIGGER trigger_update_auction_winner
AFTER INSERT ON auction_bids
FOR EACH ROW
EXECUTE FUNCTION update_auction_winner();



-- =====================================================
-- Finalize auction winner
-- =====================================================

CREATE OR REPLACE FUNCTION finalize_auction()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN

IF NEW.status = 'completed'
AND OLD.status <> 'completed'

THEN

    UPDATE auctions
    SET winner_id = (
        SELECT bidder_id
        FROM auction_bids
        WHERE auction_id = NEW.id
        ORDER BY amount DESC
        LIMIT 1
    )
    WHERE id = NEW.id;

END IF;

RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS trigger_finalize_auction
ON auctions;


CREATE TRIGGER trigger_finalize_auction
AFTER UPDATE ON auctions
FOR EACH ROW
EXECUTE FUNCTION finalize_auction();