Eugene Card Supabase Full Tabs Migration

Updated backend direction:

Marketplace -> cards table
Auction -> auctions + bids tables
Trade -> trade_requests table
Sell Back -> sell_back_requests table
Admin Analytics -> analytics table
Revenue -> transactions table

All tabs should call the unified Supabase data layer.

Recommended database tables:
profiles
cards
auctions
bids
trade_requests
sell_back_requests
transactions
analytics

Enable RLS on all tables.