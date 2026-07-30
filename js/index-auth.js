async function initIndexAuth(){
  const {data:{session}} = await supabase.auth.getSession();
  const login=document.getElementById('ec-login-btn');
  const profile=document.getElementById('ec-user-profile');
  const name=document.getElementById('ec-user-name');
  const admin=document.getElementById('ec-admin-btn');
  if(!login) return;
  if(session){
    login.style.display='none';
    profile.style.display='block';
    const {data:p}=await supabase.from('profiles').select('email,role').eq('id',session.user.id).single();
    if(name) name.textContent=p?.email || session.user.email;
    if(admin && p?.role==='admin') admin.style.display='block';
  }
}
async function loginGoogle(){
 await supabase.auth.signInWithOAuth({provider:'google', options:{redirectTo:window.location.href}});
}
async function logoutUser(){ await supabase.auth.signOut(); location.reload(); }
window.addEventListener('load',initIndexAuth);