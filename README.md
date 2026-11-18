# Scholarship Monitoring and Academic Compliance System (SAD Exam Section B)
Vanilla HTML/CSS/JS + Supabase. Blue and white theme (switch to green in the `:root` variables of `styles.css`). Synthetic data only.

## Setup
1. Create a Supabase project. In SQL Editor run `supabase/schema.sql` (tables, RLS, RPCs, seed).
2. Authentication → Providers → Email: disable "Confirm email" (exam convenience).
3. Edit `config.js` with the Project URL and **anon** key (never the service-role key).
4. Open the app (`npx serve .` or VS Code Live Server, or GitHub Pages). Sign up `staff@example.test`, `b01@example.test`, `b02@example.test`; then run in SQL Editor: `update profiles set role='staff' where email='staff@example.test';`
5. Test-account passwords are supplied privately to the instructor.

## Environment variable names
`SUPABASE_URL`, `SUPABASE_ANON_KEY` (in `config.js`).

## Files
`index.html`, `styles.css`, `app.js`, `config.js`, `supabase/schema.sql`, `docs/ANALYSIS.md` (Part I), `docs/TEST_RESULTS.md`, `docs/LACKING.md`.

## Design notes
Access is enforced in the database: tables are read-only through RLS; every write on submissions goes through `security definer` RPCs that check role and rules. Policies are rows in `programs`; `evaluate_submission` reads them.
See `docs/LACKING.md` for known defects.
