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

async function ensureCheckmarksTable(){
  try {
    const conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
    if (conn) {
      const client = new PgClient({ connectionString: conn, ssl: { rejectUnauthorized: false } })
      await client.connect()
      await client.query('CREATE TABLE IF NOT EXISTS checkmarks (phone text primary key, checked boolean not null, updated_at timestamptz not null default now())')
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
  await ensureCheckmarksTable()

  if (req.method === 'GET') {
    try {
      const conn = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING
      const client = new PgClient({ connectionString: conn, ssl: { rejectUnauthorized: false } })
      await client.connect()
      const r = await client.query('SELECT phone, checked, updated_at FROM checkmarks')
      await client.end()
      res.status(200).json(r.rows)
    } catch (e) { console.error('checkmarks GET error', e && e.message ? e.message : e); res.status(200).json([]) }
    return
  }
  if (req.method === 'POST') {
    try {
      const body = await readJson(req)
      if (body && body.__parse_error) { res.status(400).json({ error: 'invalid_body' }); return }
      let phone = String(body.phone || '').replace(/\D/g, '')
      const checked = Boolean(body.checked)
      if (phone.length === 11 && phone.startsWith('1')) phone = phone.slice(1)
      if (phone.length !== 10) {
        res.status(400).json({ error: 'invalid_phone' })
        return
      }
      const conn = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING
      const client = new PgClient({ connectionString: conn, ssl: { rejectUnauthorized: false } })
      await client.connect()
      await client.query('INSERT INTO checkmarks(phone, checked, updated_at) VALUES($1, $2, now()) ON CONFLICT (phone) DO UPDATE SET checked=$2, updated_at=now()', [phone, checked])
      await client.end()
      res.status(200).json({ phone, checked })
      return
    } catch (e) {
      console.error('checkmarks POST error', e && e.message ? e.message : e)
      res.status(500).json({ error: 'server_error' })
      return
    }
  }
  res.status(405).json({ error: 'method_not_allowed' })
}
