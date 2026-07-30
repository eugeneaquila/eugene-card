async function requireAdmin(){
  const {data:{session}} = await supabase.auth.getSession();

  if(!session){
    window.location.href='login.html';
    return false;
  }

  const {data:profile,error}=await supabase
    .from('profiles')
    .select('email,role')
    .eq('id',session.user.id)
    .single();

  if(error || !profile || profile.role !== 'admin'){
    alert('Admin access required.');
    window.location.href='index.html';
    return false;
  }

  return true;
}