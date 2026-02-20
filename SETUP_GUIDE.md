# Jewellery ERP - Complete Setup Guide

This guide will help you set up the complete ERP system from scratch.

## Prerequisites

- Node.js 18+ and pnpm installed
- A Supabase project (free tier works for development)
- Vercel account (optional, for deployment)

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be initialized
3. Copy your project credentials:
   - Project URL: Dashboard → Settings → API
   - Anonymous Key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - Service Role Key (SUPABASE_SERVICE_ROLE_KEY)

## Step 2: Setup Database Schema

### Option A: Using SQL Scripts (Recommended)

1. Go to Supabase Dashboard → SQL Editor
2. Run the provided schema SQL file:
   - Creates all tables (companies, warehouses, inventory, transfers, etc.)
   - Sets up RLS policies for multi-tenancy
   - Creates RPC functions for critical operations

3. Key tables created:
   ```
   - auth.users (Supabase managed)
   - app_users (maps users to companies)
   - companies
   - warehouses
   - inventory_items
   - inventory_gold_batches
   - inventory_diamond_lots
   - job_bags
   - stock_transfers
   - sales_invoices
   - customers
   - karigars
   - And 50+ more tables
   ```

### Option B: Using Migrations (If available)

```bash
# Apply database migrations
supabase migration up
```

## Step 3: Create RPC Functions

These critical functions must be created in your Supabase project:

### dispatch_stock_transfer()
```sql
CREATE OR REPLACE FUNCTION dispatch_stock_transfer(
  p_transfer_id UUID,
  p_user_id UUID
) RETURNS JSON AS $$
BEGIN
  -- Verify user and permissions
  -- Update transfer status to dispatched
  -- Mark all items as in_transit
  -- Return result
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### receive_stock_transfer_item()
```sql
CREATE OR REPLACE FUNCTION receive_stock_transfer_item(
  p_transfer_id UUID,
  p_item_id UUID,
  p_user_id UUID
) RETURNS JSON AS $$
BEGIN
  -- Mark item as received
  -- Update inventory warehouse
  -- Return completion status
  RETURN json_build_object('completed', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### close_job_bag_and_create_item()
```sql
CREATE OR REPLACE FUNCTION close_job_bag_and_create_item(
  p_job_bag_id UUID,
  p_gross_weight_g NUMERIC,
  p_net_weight_g NUMERIC,
  p_stone_weight NUMERIC,
  p_mrp NUMERIC,
  p_huid_code TEXT,
  p_hsn_code TEXT,
  p_user_id UUID
) RETURNS JSON AS $$
BEGIN
  -- Close job bag
  -- Create new inventory item
  -- Update material consumption
  -- Return created item ID
  RETURN json_build_object('itemId', gen_random_uuid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### pos_confirm_sale()
```sql
CREATE OR REPLACE FUNCTION pos_confirm_sale(
  p_invoice_json JSON,
  p_user_id UUID
) RETURNS JSON AS $$
BEGIN
  -- Create sales invoice atomically
  -- Create invoice items
  -- Update inventory to sold
  -- Process payments
  -- Return invoice details
  RETURN json_build_object('invoiceId', gen_random_uuid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Other Functions
- `convert_memo_transaction()`
- `complete_sales_return()`
- `finalize_transfer_with_discrepancy()`

## Step 4: Enable Row Level Security (RLS)

All tables MUST have RLS enabled:

```sql
-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
-- ... and so on

-- Create basic policies
-- Users can only see their company's data
CREATE POLICY "company_isolation" ON inventory_items
  FOR ALL USING (company_id = (
    SELECT company_id FROM app_users 
    WHERE user_id = auth.uid()
  ));
```

## Step 5: Configure Frontend

### 1. Clone Repository
```bash
git clone <your-repo>
cd jewellery-erp
pnpm install
```

### 2. Setup Environment Variables
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Start Development Server
```bash
pnpm dev
```

Visit `http://localhost:3000` in your browser.

## Step 6: Create Admin User

### Option A: Using Supabase Dashboard

1. Go to Supabase → Authentication → Users
2. Click "Invite"
3. Enter email address and send invite

### Option B: Using Auth API

```typescript
// In your app backend or Supabase SQL editor
const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail('admin@company.com')

// Then create app_users mapping
await supabase.from('app_users').insert({
  user_id: data.user.id,
  company_id: 'your-company-uuid',  // Must be set!
  role: 'owner'
})
```

## Step 7: Complete Initial Setup in App

### 1. Login
- Email: Your admin email
- Password: Set during signup

### 2. Create Company
- Navigate to `/master/company`
- Fill in company details:
  - Legal Name (required)
  - Company Code (required, unique)
  - PAN, GSTIN, CIN (for India)
  - Upload logo (optional)

### 3. Setup Locations
- Navigate to `/master/warehouse`
- Create warehouses:
  - Main Safe
  - Factory
  - Branch/Showroom
  - Transit warehouse

### 4. Add Addresses
- Navigate to `/master/company` → Addresses
- Add Registered, Billing, Corporate addresses

### 5. Configure Bank Accounts
- Navigate to `/master/bank-accounts`
- Add company bank details for payments

### 6. Invite Users
- Navigate to `/master/users`
- Invite team members
- Assign roles: owner, manager, sales, karigar
- Assign warehouse access

### 7. Setup Karigars (Artisans)
- Navigate to `/master/karigar`
- Add artisans with labor rates

### 8. Add Customers
- Navigate to `/master/customer`
- Build customer database

## Step 8: Testing Critical Flows

### Test Stock Transfer Flow
1. Create transfer in `/transfer`
2. Add items via scanner
3. Dispatch → verifies RPC execution
4. Receive items at destination

### Test POS Flow
1. Go to `/pos`
2. Scan inventory items
3. Select customer
4. Checkout → verifies pos_confirm_sale RPC

### Test Job Bag Flow
1. Create job bag in `/job-bags`
2. Issue materials
3. Close bag → creates inventory item

## Step 9: Enable Production Features

### 1. Configure SMTP for Email
```bash
# In Supabase → Settings → Email
- SMTP Host: your-smtp-host
- SMTP Port: 587
- Email: sender@company.com
```

### 2. Setup S3 for File Storage (Optional)
```bash
# Configure in Supabase → Storage
- Create bucket for invoice_files, images
- Set public access policies
```

### 3. Enable Realtime (Optional)
```sql
-- Enable realtime updates for tables
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
```

## Step 10: Deploy to Vercel

### 1. Push to GitHub
```bash
git remote add origin <github-repo>
git push origin main
```

### 2. Deploy on Vercel
```bash
vercel deploy
```

### 3. Configure Environment Variables
In Vercel Dashboard → Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Security Checklist

- [ ] RLS enabled on all tables
- [ ] Service role key NOT exposed in client code
- [ ] Company scoping enforced in all queries
- [ ] RPC functions validate user permissions
- [ ] Passwords hashed with Supabase Auth
- [ ] CORS configured correctly
- [ ] API endpoints validated server-side
- [ ] Sensitive data encrypted at rest
- [ ] Audit trail logging implemented
- [ ] Regular database backups configured

## Common Issues & Solutions

### "User profile not found"
**Cause**: `app_users` record missing
**Fix**:
```sql
INSERT INTO app_users (user_id, company_id, role)
SELECT id, 'your-company-uuid', 'owner'
FROM auth.users WHERE email = 'user@company.com';
```

### "Company ID is null"
**Cause**: app_users created without company_id
**Fix**: Always set company_id when creating app_users

### "Item not found in stock"
**Cause**: Item status is not 'in_stock'
**Fix**: Check inventory_items.status - must be 'in_stock' for POS

### RPC Permission Denied
**Cause**: RLS policy or role restriction
**Fix**: Check RPC function SECURITY DEFINER and verify user role

### Scanner Not Working
**Cause**: Camera permissions not granted
**Fix**: Click camera icon and allow camera access in browser

## Database Maintenance

### Backup Daily
```bash
# Automated via Supabase (included in free tier)
supabase db backup list
```

### Monitor Performance
```sql
-- Check slow queries
SELECT query, mean_time FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```

### Cleanup Old Data
```sql
-- Archive old invoices (example)
DELETE FROM sales_invoices WHERE created_at < NOW() - INTERVAL '1 year';
```

## Next Steps

1. **Customize branding**: Update colors and logo in company setup
2. **Add more karigars**: Build your artisan network
3. **Import customers**: Bulk upload customer database
4. **Configure reports**: Define custom KPI dashboards
5. **Train staff**: Create user guides for each role
6. **Integration**: Connect to accounting software if needed

## Support Resources

- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- Shadcn UI: https://ui.shadcn.com
- Database Issues: Check Supabase logs

## Rollback Instructions

If you need to revert to a previous state:

```bash
# Revert database to backup
supabase db push --no-seed

# Clear app cache
rm -rf .next
pnpm build
```
