const SUPABASE_URL = "https://kkhqztzobicxipznafjq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtraHF6dHpvYmljeGlwem5hZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTI4NDIsImV4cCI6MjA5NDk2ODg0Mn0.9GgjX5qjOtq3YXXc1LdPmDepJ13yHhHKuxSD8qHn77A";

async function check() {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?limit=1`, { headers });
    if (res.ok) {
      const data = await res.json();
      console.log("Products response:", data);
    } else {
      console.error("Products error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Products request failed:", err);
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/activity_logs?limit=1`, { headers });
    if (res.ok) {
      const data = await res.json();
      console.log("Activity logs response:", data);
    } else {
      console.error("Activity logs error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Activity logs request failed:", err);
  }
}

check();
