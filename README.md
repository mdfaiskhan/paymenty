# Paymenty

Full-stack contributor payment engine for Tailor and Butcher businesses.

## Project structure
- `backend/` Node.js + Express + MongoDB (JWT auth, analytics, rules, payment ledger)
- `frontend/` React + Vite + SCSS (dashboard, employees, work history, reconciliation)

## Backend setup
1. Copy `backend/.env.example` to `backend/.env`.
2. Install deps:
   - `cd backend`
   - `npm install`
3. Seed admin:
   - `npm run seed:admin`
4. Run:
   - `npm run dev`

## Frontend setup
1. Copy `frontend/.env.example` to `frontend/.env`.
2. Set `VITE_API_BASE_URL` if needed:
   - Local dev: `http://localhost:5000`
   - Production: `https://paymenty-backend.onrender.com`
   - If omitted, frontend auto-uses localhost on local hostname and Render backend on deployed hostname.
2. Install deps:
   - `cd frontend`
   - `npm install`
3. Run:
   - `npm run dev`

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
