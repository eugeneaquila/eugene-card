
async function importCards(file){
 const text=await file.text();
 const json=JSON.parse(text);
 const cards=json.cards||[];
 const rows=cards.map(c=>({
   id:c.id,
   name:c.name,
   serial:c.serial,
   type:c.type,
   price:Number(c.price||0),
   base_floor_price:Number(c.baseFloorPrice||0),
   owner:c.owner||null,
   status:c.status||"AVAILABLE",
   image_url:c.imgUrl||null,
   edition:c.edition||null,
   sn:c.sn||null,
   tier:c.tier||null,
   printing:c.printing||null
 }));
 const {error}=await supabase.from("cards").upsert(rows);
 if(error) alert(error.message);
 else alert(`Imported ${rows.length} cards`);
}