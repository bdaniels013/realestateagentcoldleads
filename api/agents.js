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

async function ensureAgentsTable(){
  try {
    const conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
    if (conn) {
      const client = new PgClient({ connectionString: conn, ssl: { rejectUnauthorized: false } })
      await client.connect()
      await client.query('CREATE TABLE IF NOT EXISTS agents (id serial primary key, name text not null, phone text unique not null, brokerage text)')
      await client.end()
    }
  } catch (_) { /* ignore */ }
}

function readJson(req){
  return new Promise((resolve)=>{
    let data=''
    req.on('data', (chunk)=>{ data += chunk })
    req.on('end', ()=>{
      try { resolve(JSON.parse(data || '{}')) } catch { resolve({ __parse_error: true }) }
    })
  })
}

export default async function handler(req, res) {
  if(!isAuthed(req)){ res.status(401).json({ error: 'unauthorized' }); return }
  await ensureAgentsTable()

  if (req.method === 'GET') {
    try {
      const conn = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING
      const client = new PgClient({ connectionString: conn, ssl: { rejectUnauthorized: false } })
      await client.connect()
      const r = await client.query('SELECT name, phone, brokerage FROM agents ORDER BY name')
      await client.end()
      res.status(200).json(r.rows)
    } catch (_) { res.status(200).json([]) }
    return
  }
  if (req.method === 'POST') {
    try {
      const body = await readJson(req)
      if (body && body.__parse_error) { res.status(400).json({ error: 'invalid_body' }); return }
      const items = Array.isArray(body) ? body : [body]
      const inserted = []
      const conn = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING
      const client = new PgClient({ connectionString: conn, ssl: { rejectUnauthorized: false } })
      await client.connect()
      for (const it of items) {
        const name = String(it.name || 'Unknown').trim()
        const brokerage = String(it.brokerage || '').trim()
        let phone = String(it.phone || '').replace(/\D/g, '')
        if (phone.length === 11 && phone.startsWith('1')) phone = phone.slice(1)
        if (phone.length !== 10) continue
        await client.query('INSERT INTO agents(name, phone, brokerage) VALUES($1, $2, $3) ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, brokerage=EXCLUDED.brokerage', [name, phone, brokerage])
        inserted.push({ name, phone, brokerage })
      }
      await client.end()
      res.status(200).json({ inserted })
      return
    } catch (e) {
      console.error('agents POST error', e && e.message ? e.message : e)
      res.status(500).json({ error: 'server_error' })
      return
    }
  }
  res.status(405).json({ error: 'method_not_allowed' })
}
