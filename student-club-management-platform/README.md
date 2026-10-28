# Student Club Management Platform (CampusClubs)

CampusClubs is a beginner-friendly full-stack college project for discovering student clubs, publishing campus events, and managing event registrations.

## 1. Problem and objectives

Campus club information is often spread across chats, posters, and spreadsheets. Students can miss events, while club coordinators struggle to keep registrations organized. CampusClubs brings the core workflow into one responsive website.

Objectives:
- Let students create accounts and sign in.
- Browse and search clubs and upcoming events.
- Register for an event, see their registrations, and cancel a registration.
- Let administrators create clubs and publish events with capacity limits.
- Store data persistently in Supabase PostgreSQL.

## 2. Roles

- **Student:** browse clubs/events, register for upcoming events, and cancel their own registrations.
- **Administrator:** all student capabilities plus create clubs and publish events.
- New registrations always receive the `student` role. To promote the first administrator, use the secure SQL instructions below. Never expose the service-role key.

## 3. Features and limitations

Implemented: account registration/login, password hashing, signed 2-hour bearer tokens, role checks, club search, event search, event capacity, duplicate-registration prevention, cancellation, responsive interface, validation, rate limits, health check.

Not included in this MVP: email verification/password reset, club membership approval, editing/deleting clubs/events, attendance marking, file uploads, and automated end-to-end browser tests. The token is held in JavaScript memory only; reloading the page signs the user out. This avoids persistent browser token storage in this beginner MVP.

## 4. Technology

- HTML5, CSS3, Vanilla JavaScript
- Node.js (20 or newer) and Express 5
- Supabase PostgreSQL through `@supabase/supabase-js`
- `bcryptjs` for password hashing, `jsonwebtoken` for short-lived tokens, `helmet`, `express-rate-limit`, `dotenv`, and `cors`

## 5. Folder structure

```text
student-club-management-platform/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── supabase.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── clubs.js
│   │   ├── events.js
│   │   └── registrations.js
│   ├── middleware/
│   │   └── auth.js
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

## 6. Prerequisites and installation links

Install:
- Visual Studio Code: https://code.visualstudio.com/
- Node.js LTS (includes npm): https://nodejs.org/
- Git: https://git-scm.com/downloads
- Supabase account: https://supabase.com/

In a new terminal, verify installations:

```bash
node --version
npm --version
git --version
```

Use Node.js 20 or newer.

## 7. Create the Supabase database

1. Sign in to Supabase and create a new project.
2. Set a strong database password and keep it private. Wait until the project is ready.
3. Open **SQL Editor** in the project dashboard.
4. Open `database/schema.sql` from this repository, copy the entire file, paste it into a new SQL query, and click **Run**.
5. Open **Table Editor** and verify `app_users`, `clubs`, `events`, and `registrations` exist. The function `register_for_event` should also exist in the database functions area.

No demo records are inserted by the schema. The first administrator can create clubs and events after promotion.

### Promote an administrator safely

1. Register an account through the application first.
2. In Supabase SQL Editor, run this query after replacing the email with the exact email used to register:

```sql
update public.app_users
set role = 'admin'
where email = lower('your-admin-email@example.com');
```

3. Confirm exactly one row was updated. Log out and log in again so the new token includes the administrator role.

Do not provide a public API endpoint for role promotion.

## 8. Configure environment variables

From `backend/`, copy `.env.example` to a new file named `.env`. Replace the example values with your own:

```dotenv
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_actual_server_only_service_role_key
JWT_SECRET=your_actual_random_secret
```

Get `SUPABASE_URL` and the **service-role/secret server key** from your Supabase project's API settings. Supabase dashboard labels may vary. This key is privileged: it belongs only in `backend/.env`, never in frontend files, GitHub, screenshots, or public documentation.

Generate a JWT secret from the `backend/` directory:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output into `JWT_SECRET`. `.env` contains private local values and is ignored by Git; `.env.example` contains only placeholders and is committed.

## 9. Install and run

Open a terminal at the project root, then:

```bash
cd backend
npm install
npm run check
npm start
```

Expected startup message:

```text
CampusClubs running at http://localhost:3000
```

Open http://localhost:3000 in your browser. Do not open `frontend/index.html` directly: Express serves it and the API from the same origin.

Health check: http://localhost:3000/api/health should return:

```json
{"status":"ok","service":"campus-clubs-api"}
```

For development auto-restart, stop the server with Ctrl+C and run `npm run dev`.

## 10. Architecture

Browser HTML/CSS/JavaScript → same-origin Express REST API → Supabase PostgreSQL. The frontend uses `fetch()` and does not connect directly to Supabase. Express verifies the JWT, checks roles, validates request bodies, and performs database operations with the server-only service-role key.

RLS is enabled on all application tables with no browser-access policies. The service-role key bypasses RLS, so RLS does not replace backend authorization: the Express routes must keep their authentication, role, and ownership checks.

Passwords are hashed with bcryptjs and never returned by the API. JWTs expire after two hours. This learning project uses bearer tokens held in memory, so page reload clears the session. For production, use a carefully designed session/cookie approach, account verification, password reset, stronger monitoring, and a security review.

## 11. REST API

Successful JSON responses generally use `{ "data": ... }`; errors use `{ "error": "message" }`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Server health |
| POST | `/api/auth/register` | Public, rate-limited | Create student account; body: `name`, `email`, `password` |
| POST | `/api/auth/login` | Public, rate-limited | Log in; body: `email`, `password` |
| GET | `/api/clubs` | Public | List clubs |
| POST | `/api/clubs` | Admin | Create club; body: `name`, `description`, `category` |
| GET | `/api/events` | Public | List upcoming events |
| POST | `/api/events` | Admin | Publish event; body: `club_id`, `title`, `description`, `location`, `starts_at` (ISO date), `capacity` |
| GET | `/api/registrations/mine` | Student/Admin | List current user's registrations |
| POST | `/api/registrations` | Student/Admin | Register; body: `event_id` |
| DELETE | `/api/registrations/:eventId` | Student/Admin | Cancel own registration |

Common errors: `400` invalid input, `401` missing/invalid login token, `403` insufficient role, `404` missing resource/route, `409` duplicate registration or full event, and `500` unexpected server failure. The API does not expose raw database errors to the browser.

## 12. Sample usage and manual testing

1. Create a student account.
2. Verify clubs/events load and search filters results.
3. Promote the account to admin using the SQL above, then log out and log back in.
4. Add a club and publish a future event.
5. Create a second student account in a separate browser/private window.
6. Register that student for the event and check **My event registrations**.
7. Cancel the registration and verify the registration disappears.
8. Try invalid email/password, duplicate email, invalid capacity, a past event date, and duplicate registration. Expect friendly errors and no duplicate rows.
9. Try creating a club as a student using an API client; expect `403`.
10. Check mobile layout using browser developer tools.

Syntax check: `npm run check` from `backend/`. This checks JavaScript syntax only; it does not verify your Supabase credentials or run browser end-to-end tests.

## 13. Troubleshooting

- **Missing environment variable:** ensure `backend/.env` exists and variable names match `.env.example`. Restart the server after edits.
- **Invalid API key / database errors:** copy the URL and server-only key from the correct Supabase project. Do not use the anon key as `SUPABASE_SERVICE_ROLE_KEY`.
- **Tables do not exist:** rerun `database/schema.sql` in the correct project's SQL Editor and check for SQL errors.
- **Port in use:** change `PORT=3001` in `.env`, restart, and open `http://localhost:3001`.
- **Cannot reach server:** keep the terminal running and open the site through the Express URL.
- **Admin controls missing:** promote an existing account with the SQL above, then log out and log in again.
- **Event registration errors:** ensure event is in the future, capacity is not reached, and the student has not already registered.
- **`npm` is not recognized:** reinstall Node.js LTS, reopen the terminal, and recheck `node --version` and `npm --version`.

## 14. GitHub upload

Create an empty repository at https://github.com/new. Do not add a README or license there if you already have them locally. From the **project root**:

```bash
git init
git status
git add .
git status
git commit -m "Build project"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the HTTPS or SSH URL from your repository. Confirm the uploaded files on GitHub. Before `git add .`, ensure real `.env` files, `node_modules/`, database exports, and private information are excluded. `.env.example` should be included.

`.gitignore` does not erase a secret already committed. If a credential was exposed, rotate it immediately in Supabase and remove it from Git history as appropriate before sharing the repository.

## 15. Future improvements

Add email verification and password recovery, club membership requests, event editing/cancellation, attendance, CSV reports, pagination, audit logs, and automated integration/browser tests. Review authentication, token storage, authorization, and database access before any production deployment.
