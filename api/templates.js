import { Client as PgClient } from 'pg'
import { createHmac } from 'crypto'

function parseCookie(h){
  const out = {}
  if(!h) return out
  h.split(';').forEach(p=>{ const i = p.indexOf('='); if(i>0){ const k = p.slice(0,i).trim(); const v = p.slice(i+1).trim(); out[k]=v } })
  return out
}
function isAuthed(req){
  const secret = process.env.SESSION_SECRET || ''
  const cookie = parseCookie(req.headers.cookie || '')
  const token = cookie.session || ''
  if(!secret || !token) return false
  const i = token.lastIndexOf('.')
  if(i<=0) return false
  const data = token.slice(0,i)
  const sig = token.slice(i+1)
  const expect = createHmac('sha256', secret).update(data).digest('base64url')
  return sig === expect
}
function pgCfg(){
  const conn = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING
  const u = new URL(conn)
  return { host: u.hostname, port: Number(u.port)||5432, database: (u.pathname||'/postgres').slice(1), user: decodeURIComponent(u.username||''), password: decodeURIComponent(u.password||''), ssl:{ require:true, rejectUnauthorized:false } }
}
async function ensureDDL(){
  const conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
  const u = new URL(conn)
  const cfg = { host:u.hostname, port:Number(u.port)||5432, database:(u.pathname||'/postgres').slice(1), user:decodeURIComponent(u.username||''), password:decodeURIComponent(u.password||''), ssl:{ require:true, rejectUnauthorized:false } }
  const c = new PgClient(cfg)
  await c.connect()
  await c.query('CREATE TABLE IF NOT EXISTS templates (id uuid default gen_random_uuid() primary key, name text not null, text text not null, is_default boolean not null default false, updated_at timestamptz not null default now())')
  await c.end()
}
function readJson(req){
  return new Promise((resolve)=>{
    let d='';
    req.on('data',ch=>{ d+=ch })
    req.on('end',()=>{ try{ resolve(JSON.parse(d||'{}')) }catch{ resolve({ __parse_error:true }) } })
  })
}

export default async function handler(req, res){
  if(!isAuthed(req)){ res.status(401).json({ error:'unauthorized' }); return }
  await ensureDDL()
  const client = new PgClient(pgCfg())
  await client.connect()
  try{
    if(req.method==='GET'){
      const r = await client.query('SELECT id, name, text, is_default FROM templates ORDER BY updated_at DESC')
      res.status(200).json(r.rows)
      return
    }
    if(req.method==='POST'){
      const body = await readJson(req)
      if(body && body.__parse_error){ res.status(400).json({ error:'invalid_body' }); return }
      const items = Array.isArray(body) ? body : [body]
      const inserted=[]
      for(const it of items){
        const name = String(it.name||'Untitled').trim()
        const text = String(it.text||'').trim()
        if(!text){ continue }
        if(it.id){
          await client.query('UPDATE templates SET name=$1, text=$2, updated_at=now() WHERE id=$3', [name, text, it.id])
          inserted.push({ id: it.id, name, text })
        } else {
          const r = await client.query('INSERT INTO templates(name, text) VALUES($1,$2) RETURNING id', [name, text])
          inserted.push({ id: r.rows[0].id, name, text })
        }
      }
      res.status(200).json({ inserted })
      return
    }
    res.status(405).json({ error:'method_not_allowed' })
  }catch(e){
    console.error('templates API error', e && e.message ? e.message : e)
    res.status(500).json({ error:'server_error' })
  }finally{
    await client.end()
  }
}

