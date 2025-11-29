## Diagnosis
- The 500 is very likely caused by `CREATE TABLE` running on a pooled (PgBouncer) connection (`POSTGRES_URL` on port 6543 with `pgbouncer=true`). PgBouncer transaction mode blocks DDL statements, so table creation fails and the route throws 500.
- Your APIs try to auto-create `agents` and `checkmarks` on first call. With pooled connections, that DDL fails; hence no tables in Supabase.

## Plan Options (choose one)
### Option A — Quick env toggle (no code changes)
1. In Vercel → Project → Settings → Environment Variables, temporarily set `POSTGRES_URL` to the non-pooling connection (`POSTGRES_URL_NON_POOLING`, port 5432). Keep other envs as-is.
2. Redeploy. Then call `GET /api/agents` (or click Add Agent), which will run `CREATE TABLE IF NOT EXISTS` successfully.
3. Confirm tables exist in Supabase (agents, checkmarks).
4. Switch `POSTGRES_URL` back to the pooled string (port 6543) and redeploy for better runtime performance.

### Option B — Robust code change (preferred)
1. Update `api/agents.js` and `api/checkmarks.js` to use a non-pooled client only for DDL:
   - Create a client with `POSTGRES_URL_NON_POOLING` (port 5432) and run `CREATE TABLE IF NOT EXISTS ...` in a try/catch.
   - Use the existing pooled `sql` client for all normal queries (GET/POST).
2. Redeploy once; DDL will succeed without env toggling.

### Option C — Manual create in Supabase
1. In Supabase SQL Editor, run:
   - `CREATE TABLE IF NOT EXISTS agents (id serial primary key, name text not null, phone text unique not null, brokerage text);
      CREATE TABLE IF NOT EXISTS checkmarks (phone text primary key, checked boolean not null, updated_at timestamptz not null default now());`
2. Redeploy (not strictly required), then try Add Agent.

## Verification
- After tables exist, `POST /api/agents` returns 200 and inserted items; the page appends the new agent.
- `GET /api/agents` shows rows; `GET /api/checkmarks` works; check/uncheck syncs across devices.
- If you still see 401 on POST, log in via the overlay; ensure `ADMIN_USER`, `ADMIN_PASS`, `SESSION_SECRET` are set.

## Next Steps
- I’ll implement Option B (code change to run DDL using `POSTGRES_URL_NON_POOLING`) so you don’t need any future env toggling. Confirm and I’ll proceed. 