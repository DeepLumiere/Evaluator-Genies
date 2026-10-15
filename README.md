# Evalboard

Evalboard is a small directory for browsing and comparing AI model evaluation results. People can search evaluation cards, submit new results for review, and describe a task to get a model suggestion. Administrators review submissions before they appear on the public board.

This project is a learning/demo application. Its sample evaluation data is illustrative, and its current authentication is not suitable for a public production service. See [Security and data limitations](#security-and-data-limitations) before deploying it.

## Contents

- [What the application does](#what-the-application-does)
- [Technology choices](#technology-choices)
- [Project layout](#project-layout)
- [How information moves through the app](#how-information-moves-through-the-app)
- [Run it on your computer](#run-it-on-your-computer)
- [Environment settings](#environment-settings)
- [Main pages and components](#main-pages-and-components)
- [API reference](#api-reference)
- [Database structure](#database-structure)
- [How the model advisor works](#how-the-model-advisor-works)
- [Common tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)
- [Security and data limitations](#security-and-data-limitations)

## What the application does

Evalboard has three main user journeys:

1. **Browse evidence.** The home page shows approved evaluation cards. Search and category filters help narrow the list, and each card can be opened for more detail.
2. **Submit evidence.** A user can submit an evaluation card. It is saved as `pending`, so it does not immediately become public.
3. **Get a model suggestion.** A user describes a task in the Model Advisor. When Gemini is configured, the server asks Gemini to choose from models that have evaluation records in MongoDB. If Gemini cannot be used, the app makes a local score-based suggestion instead.

The admin page is the review step between submission and publication. An administrator can approve, reject, restore, search, inspect, and delete evaluation records.

## Technology choices

- **Next.js 14 and React 18** build the pages and server-side API routes in one project. This keeps the user interface and its data endpoints together.
- **TypeScript** adds type checking so common mistakes in page and API code are easier to catch.
- **MongoDB with Mongoose** stores evaluation cards and user records. Mongoose defines the evaluation shape and reuses a cached database connection during local development.
- **Gemini API** can interpret a user's task description and select among evidence-backed candidates. The API key stays on the server; browser code calls this app's API instead of Google's API directly.
- **Lucide React** provides the interface icons. The shared visual system is written in CSS.

## Project layout

```text
app/
  page.tsx                         Public evaluation board and Model Advisor
  layout.tsx                       Shared HTML shell and page metadata
  globals.css                      Shared layout, components, and responsive styles
  login/page.tsx                   Sign-in and sign-up interface
  admin/page.tsx                   Admin review console
  api/
    evaluations/route.ts           Public list, personal list, and submissions
    recommendations/route.ts       Gemini and score-based recommendations
    auth/route.ts                  Demo user sign-up and login
    admin/
      auth/route.ts                Admin login and token check
      evaluations/route.ts         Protected admin list and moderation actions
lib/
  db.ts                            MongoDB connection helper
  Evaluation.ts                    Mongoose evaluation-card schema/model
  adminAuth.ts                     Admin credential and token helpers
.env.example                       Names and examples of configuration settings
.gitignore                         Excludes generated files and local secrets
next.config.mjs                    Next.js configuration
package.json                       Dependencies and command shortcuts
tsconfig.json                      TypeScript compiler settings and @/* alias
README.md                          This guide
```

`package-lock.json` records the exact dependency versions installed by npm. Keep it with the project so other installs resolve a consistent dependency tree. `.env.local` is intentionally not part of the repository; it contains private settings and is ignored by Git.

## How information moves through the app

```text
Browser page
    │ fetch request
    ▼
Next.js API route ───────► MongoDB
    │                           │
    └── Model Advisor ──► Gemini (when configured)
```

The browser asks this app's API routes for data. Those routes connect to MongoDB through `lib/db.ts`. The Model Advisor route also calls Gemini from the server when a key is configured, then returns the recommendation to the browser. This design keeps the Gemini key out of client-side JavaScript.

For submissions, the flow is:

1. A card is submitted from the public board.
2. `POST /api/evaluations` checks the required fields and score range, then stores it with `status: "pending"`.
3. The admin console fetches all statuses through its protected API.
4. An administrator approves or rejects the card.
5. The public board lists approved cards. Older records without a status are treated as approved for compatibility.

## Run it on your computer

You need Node.js/npm and a reachable MongoDB database. MongoDB may be installed locally or hosted by a service such as MongoDB Atlas.

1. Open a terminal in the project folder.
2. Install packages:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and fill in the values. On PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Visit [http://localhost:3000](http://localhost:3000). The browser address shown in an earlier screenshot used port `3001`; Next.js may select another port if `3000` is already occupied. Use the URL printed in the terminal.

To create a production build and serve it locally:

```bash
npm run build
npm run start
```

The `lint` script is `next lint`. It can be run with `npm run lint` where the installed Next.js version supports that command.

## Environment settings

| Name | Required? | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string, including the database name. The example points to local MongoDB and the `evalcards` database. |
| `GEMINI_API_KEY` | For Gemini answers | Google AI Studio API key. Leave blank to use the local evidence-based match. |
| `GEMINI_MODEL` | No | Gemini model name. The route defaults to `gemini-3.1-flash-lite`. |
| `ADMIN_EMAIL` | Recommended | Admin login email. The example has a demo value; replace it. |
| `ADMIN_PASSWORD` | Recommended | Admin login password. The example is deliberately simple and must be changed. |
| `ADMIN_SECRET_KEY` | Recommended | Secret used by this prototype's admin token check. Use a long random value and do not reuse a real account password. |

Example local settings:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/evalcards
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-3.1-flash-lite
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=replace-this-with-a-strong-password
ADMIN_SECRET_KEY=replace-this-with-a-long-random-secret
```

Keep `.env.local` private. Do not commit it, paste keys into browser code, or share screenshots containing keys. After changing environment variables, restart `npm run dev` so the server loads the new values.

## Main pages and components

### Public board — `/`

`app/page.tsx` is the main client-side page. It fetches public evaluations and provides search, category filters, summary counts, cards/table details, and submission controls. It also contains the Model Advisor dialog. The page uses browser storage for its demo user profile and for showing that user's submissions.

### Sign in and sign up — `/login`

`app/login/page.tsx` collects an email and password and calls `/api/auth`. After a successful response it saves a user profile in browser `localStorage` and returns to the board. The Google/GitHub-looking buttons are demo shortcuts, not real provider sign-in. The forgotten-password link is a placeholder.

### Admin console — `/admin`

`app/admin/page.tsx` provides an admin login gate and a moderation console. The console shows totals by status, filters cards by status, searches card fields, opens a detail view, and provides approve, reject, restore-to-pending, and delete actions. A deleted card is removed from MongoDB; status changes update its review metadata.

### Shared layout and styling

`app/layout.tsx` defines the document shell and page metadata. `app/globals.css` contains the styles shared by the board, forms, dialogs, status badges, login page, and admin console, including responsive behavior for smaller screens.

### Database helpers

`lib/db.ts` reads `MONGODB_URI` and caches a Mongoose connection on the server. `lib/Evaluation.ts` defines the evaluation document schema. `lib/adminAuth.ts` centralizes the current prototype admin credential and token checks.

## API reference

All routes below are implemented as Next.js route handlers under `app/api/`.

| Method and path | What it does | Access / notes |
| --- | --- | --- |
| `GET /api/evaluations` | Returns up to 100 approved evaluations, newest first. | Public. Records without a status are included as legacy approved records. |
| `GET /api/evaluations?user=email` | Returns records attributed to the supplied email, including review statuses. | Prototype-only: the email is not verified against a secure session. |
| `POST /api/evaluations` | Validates and creates an evaluation with pending status. | Public in the current implementation. Required fields include model, organization, benchmark, score, metric, category, and evaluated date. Score must be between 0 and 100. |
| `POST /api/recommendations` | Uses task text to rank evaluation-backed candidates and optionally ask Gemini to choose one. | Public. Work description must be 12–1,200 characters. Requires existing evaluation data. |
| `POST /api/auth` | Creates a demo user or checks a login. | Prototype auth; see security notes. |
| `POST /api/admin/auth` | Checks admin credentials and returns the prototype admin token. | Admin login. |
| `GET /api/admin/auth` | Checks the admin token supplied in the request header. | Admin token required. |
| `GET /api/admin/evaluations` | Lists evaluations and status counts; supports a status filter. | Admin token required. |
| `PATCH /api/admin/evaluations` | Changes a card's status and editable evaluation fields. | Admin token required. |
| `DELETE /api/admin/evaluations?id=...` | Deletes an evaluation by its MongoDB id. | Admin token required. |

For admin API calls, the current client sends the token using `x-admin-token` (the helper also accepts a Bearer token). Because this is a prototype token design, it should be replaced before public deployment.

## Database structure

The MongoDB database name is taken from `MONGODB_URI`. Mongoose creates collections as needed.

### `evaluations` collection

Each evaluation card contains:

| Field | Meaning |
| --- | --- |
| `model` | Model name being evaluated. |
| `organization` | Company or organization associated with that model. |
| `benchmark` | Name of the evaluation benchmark. |
| `score` | Numeric score from 0 through 100. |
| `metric` | What the score measures, such as accuracy. |
| `category` | One of `Reasoning`, `Coding`, `Knowledge`, or `Safety`. |
| `source` | Optional URL or source description for the result. |
| `status` | `pending`, `approved`, or `rejected`. |
| `submittedBy`, `submittedByEmail` | Submitter attribution shown in the board/admin tools. |
| `reviewedAt`, `reviewedBy` | Review metadata populated by admin actions. |
| `evaluatedAt` | Date of the evaluation result. |
| `createdAt`, `updatedAt` | Mongoose timestamps. |

### `users` collection

The user route defines a small user model in `app/api/auth/route.ts`. It stores a normalized email, a password hash value, and a creation date. Its current password hashing is explicitly a demo implementation, not production-grade security.

## How the model advisor works

The Advisor is evidence constrained: Gemini receives the user's task, inferred work categories, and a shortlist generated from records in MongoDB. It is instructed to pick one supplied candidate and explain the choice using only the supplied evidence. Gemini does not search the internet or all available AI models.

The route proceeds as follows:

1. It validates the task description and reads up to 300 evaluation records.
2. It looks for task words associated with coding, reasoning, knowledge, or safety.
3. It groups records by model and computes average scores using records in the matching categories. If no category can be inferred, or a model has no matching-category record, it can use that model's available records.
4. It sorts candidates by score and sends up to eight candidates to Gemini when `GEMINI_API_KEY` is set.
5. It accepts Gemini's answer only if it is valid JSON, names one of the supplied candidates exactly, and includes a reason.
6. If Gemini is missing, unavailable, rate limited, rejects the key, or returns an unusable result, the route returns the top local candidate and an explanatory notice.

This fallback means the Advisor can still return a result without Gemini, but it is then a score-based database match, not an AI-generated response. The page indicates which mode was used. Many seeded records are labeled as demo data; their scores are examples, not verified model rankings. Benchmark scores are only a rough proxy for a particular user's task.

## Common tasks

### Add real Gemini recommendations

1. Put a valid Google AI Studio key in `.env.local` as `GEMINI_API_KEY`.
2. Confirm the selected model is available to that Google project; optionally set `GEMINI_MODEL`.
3. Restart the development server.
4. Submit a task description in the Model Advisor. A successful response should identify the Gemini model in its result; a notice explains if the local fallback was used.

The key belongs only in server environment settings. Do not add it to `NEXT_PUBLIC_*` variables.

### Review a submitted evaluation

Open `/admin`, sign in with configured admin credentials, choose **Pending Review**, and approve or reject the row. Approval publishes it on the public board; rejection keeps it out of the public list. In this prototype, the login page currently displays demo credentials, so remove or change that behavior before exposing the app.

### Inspect evaluation data in MongoDB Atlas

Open the Atlas project and cluster used by `MONGODB_URI`, then open **Browse Collections**. The database name is the path portion of the URI (for example, `evalcards`), and evaluation documents are in the Mongoose `evaluations` collection. User records are in `users`. Do not share the URI or screenshots of credentials.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| MongoDB connection error | Confirm `MONGODB_URI`, network access/IP allowlist in Atlas, database user permissions, and that MongoDB is running if using a local server. Restart Next.js after environment changes. |
| Model Advisor says Gemini is not configured | Set `GEMINI_API_KEY` in `.env.local` and restart the server. |
| Gemini rejects the key | Confirm the key is valid, the Gemini API is enabled for its Google project, and the key has no extra spaces. |
| Gemini model is unavailable | Check `GEMINI_MODEL` and whether that model is available to the API key's project. |
| Gemini quota/rate-limit notice | Check the Google AI Studio project usage and quota. The local database match remains available if the route can read MongoDB. |
| Advisor reports there are no results | Add evaluation records. The Advisor needs database evidence to build its candidate list. |
| Submitted card is not on the public board | New submissions are pending. Approve them in `/admin`. |
| Page opens on another port | Use the URL printed by `npm run dev`; Next.js can select another port when the default is busy. |

## Security and data limitations

This application was built as a small prototype. **Do not deploy it as a public production service without improving authentication and access control.** In the current code:

- User passwords use a small custom hash, not a password hashing algorithm such as Argon2id or bcrypt.
- User login is represented in browser `localStorage`; API routes do not verify a server-side user session. The personal submissions endpoint trusts an email query parameter, and submission attribution is accepted from the request body.
- The social sign-in buttons are demo shortcuts, not Google/GitHub OAuth. Password recovery is a placeholder.
- Admin authentication returns a shared secret token to the browser, and the example configuration contains weak demo defaults. The admin login page also displays default demo credentials.
- There is no rate limiting or robust session/CSRF protection in this prototype.
- Seeded/demo benchmark scores are illustrative and must not be presented as verified evaluations.

Before a real deployment, use a mature authentication approach with secure, HTTP-only sessions, strong password hashing, server-side authorization tied to verified users, rate limiting, protected configuration, and reviewed/verified evaluation data. Remove visible default credentials and change all secrets first. Keep API keys and database credentials in the deployment platform's server-side secret settings.
