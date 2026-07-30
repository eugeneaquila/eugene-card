/* Eugene Card - Unified Supabase Data Layer v2 */

/* Auth/Profile */
async function getCurrentUser(){
  const {data, error} = await supabaseClient.auth.getUser();
  if(error) console.error(error);
  return data.user || null;
}

async function getProfile(){
  const user = await getCurrentUser();
  if(!user) return null;

  const {data,error} = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if(error) console.error(error);
  return data;
}

/* Marketplace */
async function loadMarketplace(){
  return await supabaseClient
    .from("cards")
    .select("*")
    .order("created_at",{ascending:false});
}

/* Auctions */
async function loadAuctions(){
  // Eugene Card currently has auctions but no bids table.
  return await supabaseClient
    .from("auctions")
    .select("*")
    .order("created_at",{ascending:false});
}

async function createAuction(payload){
  const user = await getCurrentUser();
  if(!user) throw new Error("Login required");

  return await supabaseClient
    .from("auctions")
    .insert({
      ...payload,
      seller_id:user.id
    });
}

/* Trade */
async function loadTradeRequests(){
  const user = await getCurrentUser();
  if(!user) return {data:[],error:null};

  return await supabaseClient
    .from("trade_requests")
    .select("*")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at",{ascending:false});
}

async function createTradeRequest(payload){
  const user = await getCurrentUser();
  if(!user) throw new Error("Login required");

  return await supabaseClient
    .from("trade_requests")
    .insert({
      ...payload,
      sender_id:user.id
    });
}

/* Transactions */
async function loadRevenue(){
  return await supabaseClient
    .from("transactions")
    .select("*")
    .order("created_at",{ascending:false});
}

/* Analytics */
async function loadAdminAnalytics(){
  return await supabaseClient
    .from("analytics_events")
    .select("*")
    .order("created_at",{ascending:false});
}
