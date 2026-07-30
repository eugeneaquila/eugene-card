
async function backupTable(table){
 const {data,error}=await supabase.from(table).select("*");
 if(error) return alert(error.message);
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
 const a=document.createElement("a");
 a.href=URL.createObjectURL(blob);
 a.download=`eugene-${table}-backup.json`;
 a.click();
}