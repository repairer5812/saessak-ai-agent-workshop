const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...CORS,'Content-Type':'application/json','Cache-Control':'no-store'}});
const POLL=['chatgpt','gemini','claude','xai','etc'];
export default {
  async fetch(req,env){
    if(req.method==='OPTIONS')return new Response(null,{headers:CORS});
    const u=new URL(req.url),p=u.pathname;
    try{
      if(req.method==='GET'&&(p==='/state'||p==='/')){
        const out={questions:[],feedback:[],poll:{}};POLL.forEach(o=>out.poll[o]=0);
        const ls=await env.SOTONG.list({limit:1000});
        const gs=await Promise.all(ls.keys.map(k=>env.SOTONG.get(k.name).then(v=>[k.name,v])));
        for(const [n,v] of gs){if(!v)continue;
          if(n[0]==='q')out.questions.push({id:n,text:v});
          else if(n[0]==='f')out.feedback.push({id:n,text:v});
          else if(n[0]==='v'){try{JSON.parse(v).forEach(o=>{if(o in out.poll)out.poll[o]++;});}catch(e){}}}
        out.questions.sort((a,b)=>a.id<b.id?-1:1);out.feedback.sort((a,b)=>a.id<b.id?-1:1);
        return J(out);
      }
      if(req.method==='POST'){
        const b=await req.json().catch(()=>({}));
        const id=Date.now().toString().padStart(15,'0')+Math.random().toString(36).slice(2,7);
        const t=(b.text||'').toString().trim().slice(0,2000);
        if(p==='/question'){if(!t)return J({error:'empty'},400);await env.SOTONG.put('q:'+id,t);return J({ok:true,id:'q:'+id});}
        if(p==='/feedback'){if(!t)return J({error:'empty'},400);await env.SOTONG.put('f:'+id,t);return J({ok:true,id:'f:'+id});}
        if(p==='/vote'){const o=(b.options||[]).filter(x=>POLL.includes(x));if(!o.length)return J({error:'empty'},400);await env.SOTONG.put('v:'+id,JSON.stringify(o));return J({ok:true});}
        return J({error:'bad'},400);
      }
      if(req.method==='DELETE'&&p==='/item'){
        const id=u.searchParams.get('id')||'';
        if(id[0]==='q'||id[0]==='f'){await env.SOTONG.delete(id);return J({ok:true});}
        return J({error:'bad id'},400);
      }
      return J({error:'not found'},404);
    }catch(e){return J({error:String(e)},500);}
  }
};
