
async function loadCards(){
 const container=document.getElementById("cards");
 if(!container || typeof supabase==="undefined") return;

 const {data,error}=await supabase
   .from("cards")
   .select("*")
   .order("created_at",{ascending:false});

 if(error){
   container.innerHTML="<p>"+error.message+"</p>";
   return;
 }

 container.innerHTML="";
 (data||[]).forEach(card=>{
   const d=document.createElement("div");
   d.className="card";
   d.innerHTML=`
    <h3>${card.name||"Eugene Card"}</h3>
    <p>${card.edition||""}</p>
    <p>Rp ${Number(card.price||0).toLocaleString()}</p>
    <button>Buy</button>
   `;
   container.appendChild(d);
 });
}

document.addEventListener("DOMContentLoaded",loadCards);