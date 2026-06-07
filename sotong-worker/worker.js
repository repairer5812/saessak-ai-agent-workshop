const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
// Client always gets no-store (forces it to re-ask the worker); the worker decides whether to answer from edge cache or KV.
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...CORS,'Content-Type':'application/json','Cache-Control':'no-store'}});
const PK=['chatgpt','gemini','claude','xai','etc'];
// Fixed synthetic key for the edge cache (independent of the client's ?t= cache-buster).
const CKEY=new Request('https://sotong.cache/state');
const TTL=12; // seconds the edge cache serves /state without touching KV
// Isolate-local memo: cheapest layer, valid within one isolate only.
let MEM={t:0,body:null};
async function load(env){let s=await env.SOTONG.get('state',{type:'json'});if(!s)s={questions:[],feedback:[],poll:{}};if(!s.questions)s.questions=[];if(!s.feedback)s.feedback=[];if(!s.poll)s.poll={};PK.forEach(k=>{if(s.poll[k]==null)s.poll[k]=0;});return s;}
// Return /state JSON string, preferring mem -> edge cache -> KV. Only the KV path counts against the daily read quota.
async function getStateBody(env,ctx){
  const now=Date.now();
  if(MEM.body&&now-MEM.t<TTL*1000)return MEM.body;
  const cache=caches.default;
  const hit=await cache.match(CKEY);
  if(hit){const body=await hit.text();MEM={t:now,body};return body;}
  const body=JSON.stringify(await load(env));
  MEM={t:now,body};
  // store a cacheable copy keyed by CKEY; safe to do after responding
  const store=new Response(body,{headers:{'Content-Type':'application/json','Cache-Control':'max-age='+TTL}});
  ctx.waitUntil(cache.put(CKEY,store));
  return body;
}
function bust(ctx){MEM={t:0,body:null};ctx.waitUntil(caches.default.delete(CKEY));}
export default {
  async fetch(req,env,ctx){
    if(req.method==='OPTIONS')return new Response(null,{headers:CORS});
    const u=new URL(req.url),p=u.pathname;
    try{
      if(req.method==='GET'&&(p==='/state'||p==='/')){
        const body=await getStateBody(env,ctx);
        return new Response(body,{headers:{...CORS,'Content-Type':'application/json','Cache-Control':'no-store'}});
      }
      if(req.method==='POST'){
        const b=await req.json().catch(()=>({}));
        const id=Date.now().toString().padStart(15,'0')+Math.random().toString(36).slice(2,7);
        const t=(b.text||'').toString().trim().slice(0,2000);
        const s=await load(env);
        if(p==='/question'){if(!t)return J({error:'empty'},400);s.questions.push({id:'q:'+id,text:t});await env.SOTONG.put('state',JSON.stringify(s));bust(ctx);return J({ok:true,id:'q:'+id});}
        if(p==='/feedback'){if(!t)return J({error:'empty'},400);s.feedback.push({id:'f:'+id,text:t});await env.SOTONG.put('state',JSON.stringify(s));bust(ctx);return J({ok:true,id:'f:'+id});}
        if(p==='/vote'){const o=(b.options||[]).filter(x=>PK.includes(x));if(!o.length)return J({error:'empty'},400);o.forEach(x=>{s.poll[x]=(s.poll[x]||0)+1;});await env.SOTONG.put('state',JSON.stringify(s));bust(ctx);return J({ok:true});}
        return J({error:'bad'},400);
      }
      if(req.method==='DELETE'&&p==='/item'){const id=u.searchParams.get('id')||'';const s=await load(env);s.questions=s.questions.filter(x=>x.id!==id);s.feedback=s.feedback.filter(x=>x.id!==id);await env.SOTONG.put('state',JSON.stringify(s));bust(ctx);return J({ok:true});}
      return J({error:'not found'},404);
    }catch(e){return J({error:String(e)},500);}
  }
};
