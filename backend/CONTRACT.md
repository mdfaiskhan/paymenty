# Paymenty Backend Contract

## Source of truth
- Work entries (`WorkEntry`) are authoritative.
- Earnings/cuts are always derived from entries + applicable rules.
- `PaymentLog.computedAmount` is server-derived at write-time.

## Collections
- `Admin`: login users, bcrypt hash, JWT auth.
- `Employee`: contributor profile, `businessType`, soft-delete support.
- `WorkEntry`: multiple entries/day, soft-delete, date-only at UTC midnight.
- `IncentiveRule`: business default and employee overrides with effective date ranges.
- `PaymentLog`: ledger-only payroll records for reconciliation.

## Key indexes
- `Employee`: `{ businessType, isActive, createdAt }`, text search index.
- `WorkEntry`: `{ employeeId, workDate, isDeleted }`, `{ businessType, workDate, isDeleted }`.
- `IncentiveRule`: `{ businessType, scope, employeeId, effectiveFrom }`.
- `PaymentLog`: `{ employeeId, periodStart, periodEnd }`, `{ businessType, status, paidAt }`.

## Rule resolution priority
1. Employee-scope rule active on `workDate`.
2. Business-scope rule active on `workDate`.
3. If none found, default fallback:
   - Tailor slab: `[3,4,5] => [300,600,1000], extraPerHour=200`
   - Butcher: `cutsPerHour=200`

## Implemented routes
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

## Edge cases handled
- Rule changes mid-month: resolved per day via rule effective range lookup.
- Deleted entries: soft-deleted rows excluded from all aggregates.
- Partial payments: reconciliation sums all `partial|paid` logs in overlapping period.
- Employee/business mismatch: blocked in payment creation.
- Rule overlap in same scope range: blocked on create.
