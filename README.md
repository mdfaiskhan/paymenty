# Paymenty

Full-stack contributor payment engine for Tailor and Butcher businesses.

## Production URLs (Render)
- Frontend: `https://paymenty-frontend.onrender.com/login`
- Backend: `https://paymenty-backend.onrender.com`

## Project structure
- `backend/` Node.js + Express + MongoDB (JWT auth, analytics, rules, payment ledger)
- `frontend/` React + Vite + SCSS (dashboard, employees, work history, reconciliation)

## Backend Setup (Local)
1. Copy `backend/.env.example` to `backend/.env`.
2. Set environment values:
   - `NODE_ENV=development`
   - `PORT=5000`
   - `MONGO_URI=...`
   - `JWT_SECRET=...`
   - `JWT_EXPIRES_IN=7d`
   - `OWNER_MODULE_PASSWORD=...`
3. Install deps:
   - `cd backend`
   - `npm install`
4. Seed admin:
   - `npm run seed:admin`
5. Run:
   - `npm run dev`

## Frontend Setup (Local)
1. Copy `frontend/.env.example` to `frontend/.env`.
2. Set:
   - `VITE_API_BASE_URL=http://localhost:5000`
2. Install deps:
   - `cd frontend`
   - `npm install`
3. Run:
   - `npm run dev`

## Render Deployment
This repo includes `render.yaml` so Render can apply consistent backend/frontend setup, including SPA rewrites for React routes on refresh.

### Backend service (`paymenty-backend`)
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Environment variables:
  - `NODE_ENV=production`
  - `MONGO_URI=<your atlas uri>`
  - `JWT_SECRET=<strong secret>`
  - `JWT_EXPIRES_IN=7d`
  - `OWNER_MODULE_PASSWORD=<owner module password>`
  - `ANALYTICS_CACHE_TTL_MS=15000` (optional, speeds repeated analytics reads)

### Frontend service (`paymenty-frontend`)
- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variable:
  - `VITE_API_BASE_URL=https://paymenty-backend.onrender.com`
- Rewrites:
  - `/* -> /index.html` (already defined in `render.yaml`; required to avoid "file not found" on page refresh)

Notes:
- Frontend code has fallback logic for API URL:
  - local hostnames -> `http://localhost:5000`
  - non-local hostnames -> `https://paymenty-backend.onrender.com`
- Prefer setting `VITE_API_BASE_URL` explicitly in Render for clarity.

## Default seeded admin
- Email: `admin@paymenty.local`
- Password: `admin123`

## Implemented backend APIs
- `POST /api/auth/login`
- `POST /api/employees`
- `GET /api/employees?businessType=&search=`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id`
- `POST /api/work`
- `PUT /api/work/:id`
- `DELETE /api/work/:id`
- `GET /api/work?employeeId=&month=YYYY-MM`
- `GET /api/analytics/:businessType?month=YYYY-MM`
- `POST /api/rules`
- `POST /api/payments`
- `GET /api/payments/reconciliation?businessType=&month=YYYY-MM`
