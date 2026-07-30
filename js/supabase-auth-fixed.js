/* Eugene Card - Supabase Auth Replacement */

async function loginWithGoogle() {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) {
    console.error("Supabase Google Login Error:", error.message);
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "/";
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session) {
    console.log("Supabase user:", session.user.email);
  }
});