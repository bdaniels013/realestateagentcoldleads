import { createHmac } from 'crypto'

function parseCookie(h){
  const out = {}
  if(!h) return out
  h.split(';').forEach(p=>{ const i = p.indexOf('='); if(i>0){ const k = p.slice(0,i).trim(); const v = p.slice(i+1).trim(); out[k]=v } })
  return out
}

export default async function handler(req, res){
  const secret = process.env.SESSION_SECRET || ''
  const cookie = parseCookie(req.headers.cookie || '')
  const token = cookie.session || ''
  if(!secret || !token){ res.status(401).json({ error: 'unauthorized' }); return }
  const i = token.lastIndexOf('.')
  if(i<=0){ res.status(401).json({ error: 'unauthorized' }); return }
  const data = token.slice(0,i)
  const sig = token.slice(i+1)
  const expect = createHmac('sha256', secret).update(data).digest('base64url')
  if(sig !== expect){ res.status(401).json({ error: 'unauthorized' }); return }
  res.status(200).json({ ok: true })
}

