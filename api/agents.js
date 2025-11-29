import { sql } from '@vercel/postgres'
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

export default async function handler(req, res) {
  if(!isAuthed(req)){ res.status(401).json({ error: 'unauthorized' }); return }
  try {
    const conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
    if (conn) {
      const client = new PgClient({ connectionString: conn })
      await client.connect()
      await client.query('CREATE TABLE IF NOT EXISTS agents (id serial primary key, name text not null, phone text unique not null, brokerage text)')
      await client.end()
    } else {
      await sql`CREATE TABLE IF NOT EXISTS agents (id serial primary key, name text not null, phone text unique not null, brokerage text)`
    }
  } catch (e) {
    // ignore DDL errors (e.g., pgbouncer); assume tables exist or will be created manually
  }

  if (req.method === 'GET') {
    const { rows } = await sql`SELECT name, phone, brokerage FROM agents ORDER BY name`
    res.status(200).json(rows)
    return
  }
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const items = Array.isArray(body) ? body : [body]
      const inserted = []
      for (const it of items) {
        const name = String(it.name || 'Unknown').trim()
        const brokerage = String(it.brokerage || '').trim()
        let phone = String(it.phone || '').replace(/\D/g, '')
        if (phone.length === 11 && phone.startsWith('1')) phone = phone.slice(1)
        if (phone.length !== 10) continue
        await sql`INSERT INTO agents(name, phone, brokerage) VALUES(${name}, ${phone}, ${brokerage}) ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, brokerage=EXCLUDED.brokerage`
        inserted.push({ name, phone, brokerage })
      }
      res.status(200).json({ inserted })
      return
    } catch (e) {
      res.status(400).json({ error: 'invalid_body' })
      return
    }
  }
  res.status(405).json({ error: 'method_not_allowed' })
}
