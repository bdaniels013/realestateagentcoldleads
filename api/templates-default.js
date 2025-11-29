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
export default async function handler(req, res){
  if(!isAuthed(req)){ res.status(401).json({ error:'unauthorized' }); return }
  if(req.method!=='POST'){ res.status(405).json({ error:'method_not_allowed' }); return }
  let id
  try{ const d = await new Promise(r=>{ let s=''; req.on('data',c=>s+=c); req.on('end',()=>{ try{ r(JSON.parse(s||'{}')) }catch{ r({}) } }) }); id = String(d.id||'') }catch{ id='' }
  if(!id){ res.status(400).json({ error:'invalid_id' }); return }
  const c = new PgClient(pgCfg())
  await c.connect()
  try{
    await c.query('UPDATE templates SET is_default=false')
    await c.query('UPDATE templates SET is_default=true, updated_at=now() WHERE id=$1', [id])
    res.status(200).json({ ok:true })
  }catch(e){
    console.error('templates-default error', e && e.message ? e.message : e)
    res.status(500).json({ error:'server_error' })
  }finally{
    await c.end()
  }
}

