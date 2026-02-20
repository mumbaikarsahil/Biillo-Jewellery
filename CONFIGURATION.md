# Jewellery ERP - Configuration & Customization Guide

Guide to configure and customize the ERP system for your specific business needs.

## Environment Configuration

### Required Environment Variables

Add these to `.env.local` for development and Vercel for production:

```env
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Application Settings (Optional)
NEXT_PUBLIC_APP_NAME=Jewellery ERP
NEXT_PUBLIC_APP_VERSION=1.0.0

# Analytics (Optional)
NEXT_PUBLIC_SENTRY_DSN=https://...

# File Storage (Optional)
NEXT_PUBLIC_STORAGE_URL=https://...
NEXT_PUBLIC_STORAGE_BUCKET=invoices
```

### Environment Variable Setup in Vercel

1. Dashboard → Settings → Environment Variables
2. Add each variable (public and secret)
3. Mark `SUPABASE_SERVICE_ROLE_KEY` as secret
4. Redeploy after adding variables

## Database Configuration

### 1. Enable Row Level Security (RLS)

For each table, run in Supabase SQL Editor:

```sql
-- Core tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_bags ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE karigars ENABLE ROW LEVEL SECURITY;
ALTER TABLE memo_transactions ENABLE ROW LEVEL SECURITY;

-- ... (all other tables)
```

### 2. Create Basic RLS Policies

```sql
-- Example: Company isolation policy
CREATE POLICY "Users see their company data"
  ON inventory_items
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE user_id = auth.uid()
    )
  );

-- Repeat for each table
```

### 3. Create RPC Functions

Create these critical RPC functions in SQL Editor:

#### dispatch_stock_transfer()
```sql
CREATE OR REPLACE FUNCTION dispatch_stock_transfer(
  p_transfer_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
BEGIN
  -- Verify user exists and has permission
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update transfer status
  UPDATE stock_transfers
  SET status = 'dispatched'
  WHERE id = p_transfer_id;

  -- Mark all items as in_transit
  UPDATE inventory_items
  SET status = 'transit'
  WHERE id IN (
    SELECT item_id FROM stock_transfer_item_lines 
    WHERE transfer_id = p_transfer_id
  );

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### receive_stock_transfer_item()
```sql
CREATE OR REPLACE FUNCTION receive_stock_transfer_item(
  p_transfer_id UUID,
  p_item_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_to_warehouse_id UUID;
  v_all_received BOOLEAN;
BEGIN
  -- Get destination warehouse
  SELECT to_warehouse_id INTO v_to_warehouse_id
  FROM stock_transfers WHERE id = p_transfer_id;

  -- Update item
  UPDATE inventory_items
  SET warehouse_id = v_to_warehouse_id, status = 'in_stock'
  WHERE id = p_item_id;

  -- Mark line as received
  UPDATE stock_transfer_item_lines
  SET is_received = true, received_at = NOW(), received_by = p_user_id
  WHERE transfer_id = p_transfer_id AND item_id = p_item_id;

  -- Check if all items received
  SELECT NOT EXISTS (
    SELECT 1 FROM stock_transfer_item_lines
    WHERE transfer_id = p_transfer_id AND is_received = false
  ) INTO v_all_received;

  RETURN json_build_object('completed', v_all_received);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### close_job_bag_and_create_item()
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
)
RETURNS JSON AS $$
DECLARE
  v_item_id UUID;
  v_company_id UUID;
  v_warehouse_id UUID;
BEGIN
  -- Get job bag details
  SELECT company_id INTO v_company_id FROM job_bags WHERE id = p_job_bag_id;
  
  -- Assume warehouse is factory/main
  SELECT id INTO v_warehouse_id 
  FROM warehouses 
  WHERE company_id = v_company_id AND warehouse_type = 'factory'
  LIMIT 1;

  -- Create inventory item
  INSERT INTO inventory_items (
    company_id, barcode, gross_weight_g, net_weight_g,
    total_stone_weight_cts, mrp, huid_code, hsn_code,
    warehouse_id, status, metal_type, purity_karat, purity_percent,
    created_from_job_bag_id, created_by
  ) VALUES (
    v_company_id,
    'BAR-' || gen_random_uuid()::text,
    p_gross_weight_g,
    p_net_weight_g,
    p_stone_weight,
    p_mrp,
    p_huid_code,
    p_hsn_code,
    v_warehouse_id,
    'in_stock',
    'GOLD', -- Default, customize as needed
    '22', -- Default, customize
    91.6, -- Default, customize
    p_job_bag_id,
    p_user_id
  ) RETURNING id INTO v_item_id;

  -- Update job bag status
  UPDATE job_bags SET status = 'completed' WHERE id = p_job_bag_id;

  RETURN json_build_object('itemId', v_item_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### pos_confirm_sale()
```sql
CREATE OR REPLACE FUNCTION pos_confirm_sale(
  p_invoice_json JSON,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_invoice_id UUID;
  v_company_id UUID;
  v_invoice_number TEXT;
BEGIN
  -- Get company from user
  SELECT company_id INTO v_company_id FROM app_users WHERE user_id = p_user_id;

  -- Create invoice
  INSERT INTO sales_invoices (
    company_id, customer_id, invoice_number, status, created_by
  ) VALUES (
    v_company_id,
    (p_invoice_json::jsonb -> 'customer_id')::text::uuid,
    'INV-' || gen_random_uuid()::text,
    'completed',
    p_user_id
  ) RETURNING id, invoice_number INTO v_invoice_id, v_invoice_number;

  -- Create invoice items and update inventory
  UPDATE inventory_items
  SET status = 'sold'
  WHERE id IN (
    SELECT jsonb_array_elements(p_invoice_json::jsonb -> 'items') -> 'item_id'
  );

  RETURN json_build_object(
    'invoiceId', v_invoice_id,
    'invoiceNumber', v_invoice_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Other Required RPCs
- `finalize_transfer_with_discrepancy()`
- `convert_memo_transaction()`
- `complete_sales_return()`

See `SETUP_GUIDE.md` for complete implementations.

## Application Configuration

### 1. Customize Company Settings

Navigate to `/master/company` after login:

- **Legal Name**: Legal name per registration
- **Company Code**: Unique identifier (e.g., JA-001)
- **Tax IDs**: PAN, GSTIN, CIN for India
- **Logo**: Company branding

### 2. Configure Compliance Settings

SQL Editor → Create/Update:

```sql
INSERT INTO company_compliance_settings (
  company_id, gst_auto_calculation, tds_enabled, 
  tcs_enabled, audit_trail_mandatory
) VALUES (
  '<company-uuid>',
  true,  -- Auto-calculate GST
  false, -- TDS disabled (enable if needed)
  false, -- TCS disabled (enable if needed)
  true   -- Audit trail required
);
```

### 3. Configure Financial Settings

```sql
INSERT INTO company_financial_settings (
  company_id,
  base_currency,
  financial_year_start_month,
  inventory_valuation_method,
  default_tax_calculation_mode,
  rounding_precision,
  allow_negative_stock,
  metal_rate_update_policy
) VALUES (
  '<company-uuid>',
  'INR',        -- Base currency
  4,            -- FY starts April (India)
  'FIFO',       -- First-in-first-out
  'exclusive',  -- Tax exclusive by default
  2,            -- 2 decimal places
  false,        -- Don't allow negative stock
  'manual'      -- Manual rate updates
);
```

### 4. Configure Diamond Settings

```sql
INSERT INTO company_diamond_settings (
  company_id,
  diamond_inventory_mode,
  valuation_method,
  certification_tracking_required,
  allow_uncertified_sales,
  max_uncertified_weight_cts,
  diamond_loss_tracking_enabled,
  diamond_breakage_threshold_percent,
  default_diamond_currency,
  enable_sieve_size_tracking
) VALUES (
  '<company-uuid>',
  'hybrid',           -- Track by lot and pieces
  'packet_average',   -- Average cost per packet
  true,               -- Require certification
  false,              -- Don't allow uncertified
  0.3,                -- Max uncertified: 0.3 cts
  true,               -- Track losses
  2.0,                -- 2% breakage threshold
  'USD',              -- Diamond priced in USD
  true                -- Track sieve sizes
);
```

### 5. Configure Metal Defaults

```sql
INSERT INTO company_metal_defaults (
  company_id,
  std_gold_purity_pct,
  std_silver_purity_pct,
  consider_making_charges_in_stock_value,
  consider_stone_value_in_stock_value
) VALUES (
  '<company-uuid>',
  99.5,   -- Standard: 99.5%
  99.9,   -- Standard: 99.9%
  true,   -- Include making charges in value
  true    -- Include stone value in value
);
```

## Customization Guide

### 1. Change Color Scheme

Edit `tailwind.config.ts`:

```typescript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#your-color',
        secondary: '#your-color',
        accent: '#your-color',
      },
    },
  },
};
```

Update CSS variables in `app/globals.css`:

```css
:root {
  --primary: #your-color;
  --secondary: #your-color;
  --accent: #your-color;
}
```

### 2. Add Custom Fields

Example: Add `reference_code` to inventory items

```sql
ALTER TABLE inventory_items ADD COLUMN reference_code TEXT;

-- Update in TypeScript:
interface InventoryItem {
  // ... existing fields
  reference_code?: string;
}
```

### 3. Create Custom Pages

Add new page in `app/` directory:

```typescript
// app/custom-reports/page.tsx
'use client'

import { Navbar } from '@/components/Navbar'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'

export default function CustomReportsPage() {
  const { appUser, loading } = useAuth()
  
  if (loading || !appUser) return <div>Loading...</div>
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar appUser={appUser} companyName="Custom Reports" />
      {/* Your content */}
    </div>
  )
}
```

### 4. Add Custom Validators

Edit `lib/validators.ts`:

```typescript
export const customSchema = z.object({
  reference_code: z.string().min(1, 'Code required'),
  custom_field: z.number().positive(),
})

export type CustomFormData = z.infer<typeof customSchema>
```

### 5. Extend API

Add route handler in `app/api/`:

```typescript
// app/api/custom/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function POST(request: NextRequest) {
  const data = await request.json()
  
  // Your logic here
  
  return NextResponse.json({ success: true })
}
```

## Integration Configuration

### Email Configuration

In Supabase → Settings → Email:

```
SMTP Configuration:
- Host: smtp.mailgun.org (or your provider)
- Port: 587
- Username: postmaster@...
- Password: (from provider)
- From Email: noreply@company.com
```

### File Storage

Create Supabase Storage bucket:

```sql
-- Via dashboard or:
INSERT INTO storage.buckets (id, name)
VALUES ('invoices', 'invoices');

-- Create RLS policy:
CREATE POLICY "Users upload to company folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'invoices');
```

### Backup Configuration

In Supabase → Settings → Backups:

- Enable daily backups (automatic)
- Set retention policy (30 days)
- Test restore monthly

## Performance Configuration

### Database Indexes

Create for frequently queried columns:

```sql
CREATE INDEX idx_inventory_company_status ON inventory_items(company_id, status);
CREATE INDEX idx_transfers_company_created ON stock_transfers(company_id, created_at);
CREATE INDEX idx_invoices_company_customer ON sales_invoices(company_id, customer_id);
```

### Query Optimization

In `lib/api.ts`, use `maybeSingle()` for optional:

```typescript
const { data: company } = await supabase
  .from('companies')
  .select('*')
  .eq('id', companyId)
  .maybeSingle()  // Better than .limit(1).single()
```

### Caching

Set React Query stale time:

```typescript
const { data } = useSWR(
  '/api/companies',
  fetcher,
  { revalidateOnFocus: false, dedupingInterval: 60000 }
)
```

## Security Configuration

### API Rate Limiting

Add in route handlers:

```typescript
import { Ratelimit } from '@upstash/ratelimit'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 h'),
})

export async function POST(request: NextRequest) {
  const { success } = await ratelimit.limit(request.ip || 'anonymous')
  
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  
  // Your logic
}
```

### JWT Configuration

Supabase settings → JWT expires (default 1 hour):

```typescript
// In .env.local
NEXT_PUBLIC_JWT_EXPIRY=3600  # 1 hour
```

### CORS Configuration

In Supabase → Settings → CORS:

```
Allowed Origins:
- http://localhost:3000
- https://yourdomain.com
- https://www.yourdomain.com
```

## Monitoring Configuration

### Error Tracking (Sentry)

1. Create Sentry account
2. Get DSN from project settings
3. Add to `.env.local`:

```env
NEXT_PUBLIC_SENTRY_DSN=https://...
```

### Analytics

Enable Vercel Analytics:

```bash
npm install @vercel/analytics
```

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

## Regional Configuration

### Currency

Change in company settings:

```sql
UPDATE company_currency_settings
SET default_currency = 'USD'
WHERE company_id = '<company-uuid>';
```

### Date Format

Add to company settings table and format display:

```typescript
const formatDate = (date: string, format: string) => {
  // Implement locale-specific formatting
  return new Intl.DateTimeFormat('en-IN').format(new Date(date))
}
```

### Language/Localization

Add i18n support:

```bash
npm install next-intl
```

---

**Last Updated**: 2026-02-16
