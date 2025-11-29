## Requirements
- Header toggle: always show variant picker (hard-coded on by default).
- Default script: use your current script.
- Upload/manage variants of scripts.
- Variants available on all devices (not just localStorage).

## Approach
- Add cloud storage for templates using your existing Vercel Postgres (same project):
  - Table `templates(id uuid default gen_random_uuid(), name text not null, text text not null, is_default boolean not null default false, updated_at timestamptz default now())`.
- API routes:
  - `GET /api/templates` → list templates
  - `POST /api/templates` → insert or update templates; supports bulk upload via JSON
  - `POST /api/templates/default` → set default template by id (unsets others)
- Frontend:
  - Header toggle “Always show picker” (hard-coded to ON initially; stored in localStorage `smsAlwaysPicker=true`).
  - Script Manager modal: list templates from API; add/edit/delete; set default.
  - On phone tap: always show variant picker (because toggle ON). Selecting one injects `{name}`/`{brokerage}` and sends via SMS URL.
- Sync:
  - On load, fetch templates. If none exist, seed DB with your default script.
  - Changes to templates post to API, so all devices see updates after reload.

## Steps
1. Create `templates` table (using non-pooled connection for DDL) and APIs.
2. Build Script Manager UI with upload (paste JSON or multiline forms for variants).
3. Implement variant picker overlay triggered on phone tap.
4. Keep current behavior (auto-check, tabs, counts, movement).

## Notes
- Authentication: reuse your login cookie for template APIs.
- Placeholder support `{name}`, `{brokerage}`; first-name only.
- Later: add CSV import if you want.

Confirm and I’ll implement the table, APIs, header toggle, template manager, and picker.