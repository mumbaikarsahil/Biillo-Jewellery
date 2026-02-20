# Jewellery ERP - Quick Start Guide

Get the ERP system up and running in 15 minutes.

## Prerequisites
- Node.js 18+
- pnpm (or npm)
- Supabase account (free)

## 5-Minute Setup

### 1. Clone & Install (2 min)
```bash
git clone <repo-url>
cd jewellery-erp
pnpm install
```

### 2. Create Supabase Project (2 min)
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy credentials:
   - Project URL
   - Anon Key
   - Service Role Key

### 3. Configure Environment (1 min)
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 10-Minute Database Setup

### Import Schema

1. Go to Supabase → SQL Editor
2. Click "New Query"
3. Paste database schema (provided separately)
4. Click "Run"

Expected tables created:
- companies, warehouses, users
- inventory_items, gold_batches, diamond_lots
- job_bags, stock_transfers
- sales_invoices, customers, karigars
- And 30+ more

### Create RPC Functions

For each RPC listed below, create in SQL Editor:

```sql
-- Copy/paste RPC implementations from provided RPC_FUNCTIONS.sql
```

Critical RPCs needed:
- `dispatch_stock_transfer()`
- `receive_stock_transfer_item()`
- `close_job_bag_and_create_item()`
- `pos_confirm_sale()`
- `convert_memo_transaction()`
- `complete_sales_return()`

### Enable RLS

```sql
-- Run for each table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
-- ... etc
```

See `SETUP_GUIDE.md` for full RLS policy examples.

## 5-Minute First Run

### Start Dev Server
```bash
pnpm dev
```

Navigate to `http://localhost:3000`

### Create Admin User

1. Click "Sign Up"
2. Enter email and password
3. Confirm email (check inbox)

### Create Company Record

In your database SQL editor:
```sql
INSERT INTO app_users (user_id, company_id, role)
SELECT id, (SELECT id FROM companies LIMIT 1), 'owner'
FROM auth.users WHERE email = 'your-email@example.com';
```

Or use the in-app setup flow:
1. Go to `/master/company`
2. Enter company details
3. Save

### Login & Explore

1. Login with your credentials
2. You're now on the dashboard
3. Navigate to any module to explore

## Essential First Steps

### 1. Add Warehouses
```
Master Setup → Warehouses
- Add Main Safe
- Add Factory
- Add Showroom
```

### 2. Invite Team Members
```
Master Setup → Users
- Enter email addresses
- Assign roles (owner/manager/sales/karigar)
- Send invites
```

### 3. Add Karigars
```
Master Setup → Karigars
- Add artisans who do manufacturing
- Set labor rates
```

### 4. Test POS
```
1. Create a test customer (Master → Customers)
2. Create a test inventory item (manually via SQL for now)
3. Go to /pos
4. Scan items
5. Checkout
```

### 5. Test Stock Transfer
```
1. Go to /transfer
2. Create transfer between warehouses
3. Add items
4. Dispatch (triggers RPC)
5. Receive items at destination
```

## Common First-Time Issues

### Issue: "Cannot find module '@supabase/supabase-js'"
**Solution**: Run `pnpm install`

### Issue: "User profile not found"
**Solution**: 
```sql
INSERT INTO app_users (user_id, company_id, role) 
VALUES ('<your-user-id>', '<company-uuid>', 'owner');
```

### Issue: "Company ID is required"
**Solution**: Company scoping is mandatory - ensure company_id is set in app_users

### Issue: "No items in inventory"
**Solution**: Add items manually via SQL or through `/inventory` form

### Issue: "RPC function not found"
**Solution**: Create the RPC functions in Supabase SQL Editor (see Setup Guide)

## File Structure Overview

```
app/
├── layout.tsx              # Root layout
├── page.tsx                # Redirect to dashboard
├── login/                  # Auth pages
├── dashboard/              # Main dashboard
├── master/                 # Master data setup
├── inventory/              # Inventory management
├── transfer/               # Stock transfers
├── job-bags/               # Manufacturing
├── pos/                    # Point of sale
├── memo/                   # Memo transactions
├── sales/                  # Sales & returns
└── reports/                # Analytics

lib/
├── supabaseClient.ts       # Supabase setup
├── api.ts                  # Data fetchers
├── rpc.ts                  # RPC wrappers
└── validators.ts           # Zod schemas

components/
├── Navbar.tsx              # Navigation
├── DataTable.tsx           # Reusable table
├── Scanner.tsx             # Barcode scanner
└── ui/                     # Shadcn components
```

## Key Commands

```bash
# Development
pnpm dev              # Start dev server on :3000

# Production
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm db:push          # Push migrations (if using)
pnpm db:pull          # Pull schema from remote

# Linting
pnpm lint             # Run ESLint
pnpm format           # Format code
```

## Environment Variables Reference

| Variable | Example | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abc.supabase.co` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | ✅ |
| `NEXT_PUBLIC_APP_NAME` | `Jewellery ERP` | ❌ |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://...` | ❌ |

## Testing Critical Flows

### Stock Transfer Flow
1. Create transfer: `/transfer` → "Create Transfer"
2. Select from/to warehouses
3. Add items (need existing items in inventory)
4. Click "Dispatch" button
5. Verify RPC executes successfully

### POS Flow
1. Ensure customer exists
2. Ensure items exist in inventory with status `in_stock`
3. Go to `/pos`
4. Scan barcode or type barcode manually
5. Items appear in cart
6. Select customer
7. Click "Checkout"
8. Verify RPC creates invoice

### Job Bag Flow
1. Add a karigar first
2. Go to `/job-bags` → "Create Job Bag"
3. Fill in details
4. Verify created successfully
5. When ready to close, issue materials first
6. Close job bag to create inventory item

## Deployment Checklist

- [ ] Environment variables set in Vercel
- [ ] Supabase RLS policies enabled
- [ ] RPC functions created
- [ ] Database backups configured
- [ ] SMTP configured for emails
- [ ] S3 storage setup (optional)
- [ ] Security: Service role key never in client code
- [ ] Company scoping enforced everywhere
- [ ] Admin user created
- [ ] Test all critical flows once

## Getting Help

1. **Setup Issues**: See `SETUP_GUIDE.md`
2. **Architecture Questions**: See `ARCHITECTURE.md`
3. **Supabase Docs**: https://supabase.com/docs
4. **Next.js Docs**: https://nextjs.org/docs
5. **Database Issues**: Check Supabase logs and query errors

## Next Level

After basic setup, explore:
- Real-time updates: Subscribe to inventory changes
- Reports: Create custom dashboards with Recharts
- Mobile: Build React Native app using same backend
- Integration: Connect to accounting software
- Automation: Scheduled tasks for cleanup/archival

## Example Database Records

### Sample Company
```sql
INSERT INTO companies (legal_name, trade_name, company_code)
VALUES ('Jewel Arts Pvt Ltd', 'Jewel Arts', 'JA-001');
```

### Sample Warehouse
```sql
INSERT INTO warehouses (company_id, warehouse_code, name, warehouse_type)
VALUES ('<company-id>', 'WH-001', 'Main Safe', 'main_safe');
```

### Sample Customer
```sql
INSERT INTO customers (company_id, full_name, phone)
VALUES ('<company-id>', 'Rajesh Kumar', '9876543210');
```

## One-Liner Quick Start

```bash
# For truly impatient devs (still requires env setup)
git clone <repo> && cd jewellery-erp && cp .env.local.example .env.local && pnpm install && pnpm dev
```

(Then update `.env.local` with your Supabase credentials)

---

**Estimated Time**: 15-20 minutes from zero to working dashboard ⏱️
