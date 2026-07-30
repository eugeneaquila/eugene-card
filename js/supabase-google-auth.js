async function loginWithGoogle(){
 const {error}=await supabaseClient.auth.signInWithOAuth({
  provider:'google',
  options:{
   redirectTo:window.location.origin+'/dashboard.html'
  }
 });
 if(error) console.error(error.message);
}