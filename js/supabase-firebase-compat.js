
/* Firebase compatibility adapter for Eugene Card Supabase migration */
(function(){
  function wrap(data){ return { id:data.id, data:()=>{const x={...data}; delete x.id; return x;} }; }
  function makeCollection(table){
    return {
      async get(){
        const {data,error}=await supabaseClient.from(table).select('*');
        if(error) throw error;
        return {docs:(data||[]).map(wrap)};
      },
      onSnapshot(cb){
        let active=true;
        (async()=>{ if(!active)return; const r=await this.get(); cb(r); })();
        const ch=supabaseClient.channel('compat-'+table)
          .on('postgres_changes',{event:'*',schema:'public',table},async()=>{
            if(active){ const r=await this.get(); cb(r); }
          }).subscribe();
        return ()=>{active=false; supabaseClient.removeChannel(ch);};
      },
      doc(id){
        return {
          async get(){
            const {data,error}=await supabaseClient.from(table).select('*').eq('id',id).maybeSingle();
            if(error) throw error;
            return {exists:!!data,id:data?.id,data:()=>{const x={...(data||{})}; delete x.id; return x;}};
          },
          async set(value,opt){
            const payload={...value,id:id};
            const {error}=await supabaseClient.from(table).upsert(payload);
            if(error) throw error;
          },
          async update(value){
            const {error}=await supabaseClient.from(table).update(value).eq('id',id);
            if(error) throw error;
          },
          async delete(){
            const {error}=await supabaseClient.from(table).delete().eq('id',id);
            if(error) throw error;
          }
        }
      }
    }
  }
  window.db={
    collection(name){
      const map={tradeRequests:'trade_requests', analytics:'analytics_events'};
      return makeCollection(map[name]||name);
    },
    batch(){
      const ops=[];
      return {update(ref,data){ops.push(()=>ref.update(data));},set(ref,data){ops.push(()=>ref.set(data));},async commit(){for(const op of ops) await op();}};
    }
  };
})();
