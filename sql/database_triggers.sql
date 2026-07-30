-- =====================================================
-- Eugene Card Supabase Database Triggers v1
-- =====================================================



-- =====================================================
-- 1. AUTO CREATE PROFILE AFTER AUTH SIGNUP
-- =====================================================

CREATE OR REPLACE FUNCTION create_profile_after_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN

INSERT INTO profiles(
    id,
    username,
    role,
    created_at
)
VALUES(
    NEW.id,
    COALESCE(
        NEW.raw_user_meta_data->>'username',
        split_part(NEW.email,'@',1)
    ),
    'user',
    now()
);

RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS on_auth_user_created
ON auth.users;


CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_profile_after_signup();





-- =====================================================
-- 2. UPDATED_AT AUTO UPDATE
-- =====================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN

NEW.updated_at = now();

RETURN NEW;

END;
$$;



CREATE TRIGGER profiles_timestamp
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();



CREATE TRIGGER cards_timestamp
BEFORE UPDATE ON cards
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();



CREATE TRIGGER auctions_timestamp
BEFORE UPDATE ON auctions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();





-- =====================================================
-- 3. AUCTION BID -> UPDATE CURRENT BID
-- =====================================================

CREATE OR REPLACE FUNCTION update_auction_bid()
RETURNS trigger
LANGUAGE plpgsql
AS $$

BEGIN

UPDATE auctions
SET
current_bid = NEW.amount
WHERE id = NEW.auction_id
AND NEW.amount > current_bid;


RETURN NEW;

END;

$$;



DROP TRIGGER IF EXISTS auction_bid_update
ON auction_bids;


CREATE TRIGGER auction_bid_update
AFTER INSERT ON auction_bids
FOR EACH ROW
EXECUTE FUNCTION update_auction_bid();





-- =====================================================
-- 4. AUCTION COMPLETE
-- =====================================================

CREATE OR REPLACE FUNCTION complete_auction()
RETURNS trigger
LANGUAGE plpgsql
AS $$

BEGIN


IF NEW.status='completed'
AND OLD.status!='completed'

THEN


INSERT INTO transactions(
user_id,
type,
amount,
status,
created_at
)

VALUES(
NEW.seller_id,
'AUCTION_SALE',
NEW.current_bid,
'completed',
now()
);


END IF;


RETURN NEW;


END;

$$;



DROP TRIGGER IF EXISTS auction_completed
ON auctions;


CREATE TRIGGER auction_completed
AFTER UPDATE ON auctions
FOR EACH ROW
EXECUTE FUNCTION complete_auction();





-- =====================================================
-- 5. TRADE ACCEPTANCE
-- Transfers card ownership
-- =====================================================

CREATE OR REPLACE FUNCTION complete_trade()
RETURNS trigger
LANGUAGE plpgsql
AS $$

BEGIN


IF NEW.status='accepted'
AND OLD.status!='accepted'

THEN


UPDATE cards
SET owner_id = NEW.to_user
WHERE id = ANY(NEW.offered_cards);



UPDATE cards
SET owner_id = NEW.from_user
WHERE id = ANY(NEW.requested_cards);



INSERT INTO transactions(
user_id,
type,
status,
created_at
)

VALUES(
NEW.from_user,
'TRADE_COMPLETED',
'completed',
now()
);


END IF;



RETURN NEW;


END;

$$;



DROP TRIGGER IF EXISTS trade_completed
ON trade_requests;


CREATE TRIGGER trade_completed
AFTER UPDATE ON trade_requests
FOR EACH ROW
EXECUTE FUNCTION complete_trade();





-- =====================================================
-- 6. CREATE NOTIFICATION ON TRADE REQUEST
-- =====================================================


CREATE OR REPLACE FUNCTION notify_trade_request()
RETURNS trigger
LANGUAGE plpgsql
AS $$

BEGIN


INSERT INTO notifications(
user_id,
title,
message,
created_at
)

VALUES(
NEW.receiver_id,
'New Trade Proposal',
'You received a new trade request',
now()
);


RETURN NEW;


END;

$$;



DROP TRIGGER IF EXISTS new_trade_notification
ON trade_requests;


CREATE TRIGGER new_trade_notification
AFTER INSERT ON trade_requests
FOR EACH ROW
EXECUTE FUNCTION notify_trade_request();





-- =====================================================
-- 7. CHAT MESSAGE NOTIFICATION
-- =====================================================

CREATE OR REPLACE FUNCTION notify_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$

BEGIN


INSERT INTO notifications(
user_id,
title,
message,
created_at
)

VALUES(
NEW.receiver_id,
'New Message',
'You received a new marketplace message',
now()
);


RETURN NEW;


END;

$$;



DROP TRIGGER IF EXISTS message_notification
ON messages;


CREATE TRIGGER message_notification
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_message();