import { createHmac } from 'crypto'

function b64url(s){
  return Buffer.from(s).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_')
}

export default async function handler(req, res){
  if(req.method !== 'POST'){ res.status(405).json({ error: 'method_not_allowed' }); return }
  const user = process.env.ADMIN_USER || ''
  const pass = process.env.ADMIN_PASS || ''
  const secret = process.env.SESSION_SECRET || ''
  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const u = String(body.username || '')
    const p = String(body.password || '')
    if(!u || !p || u !== user || p !== pass || !secret){ res.status(401).json({ error: 'unauthorized' }); return }
    const payload = { u, t: Date.now() }
    const data = b64url(JSON.stringify(payload))
    const sig = createHmac('sha256', secret).update(data).digest('base64url')
    const token = `${data}.${sig}`
    res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`)
    res.status(200).json({ ok: true })
  }catch(_){ res.status(400).json({ error: 'invalid_body' }) }
}

