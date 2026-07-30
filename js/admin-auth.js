/* Eugene Card Supabase Login + Admin Role Check */

const ADMIN_EMAILS = [
  "eugene.aquila06@gmail.com",
  "yujinybwork@gmail.com"
];

async function loginWithGoogle() {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "https://eugene-card-2.vercel.app/"
    }
  });

  if (error) {
    console.error(error.message);
  }
}

async function checkUserRole() {
  const { data } = await supabaseClient.auth.getUser();
  const user = data.user;

  if (!user) return;

  const isAdmin = ADMIN_EMAILS.includes(user.email);

  if (isAdmin) {
    document.querySelectorAll(".admin-only").forEach(el => {
      el.style.display = "block";
    });
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "/";
}

document.addEventListener("DOMContentLoaded", checkUserRole);