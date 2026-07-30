/*
 Eugene Card Sell Back v2
 Supabase initialization
*/

const SUPABASE_URL = "https://yswwicdycbscurnpbqjb.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzd3dpY2R5Y2JzY3VybnBicWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyOTUzNjAsImV4cCI6MjEwMDg3MTM2MH0.FESrSxt3ys6WJXF768q1lXJceQrff6T6WLgCn8prEw8";

window.supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);