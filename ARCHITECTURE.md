# Jewellery ERP - System Architecture

## System Overview

This is a modern **multi-tenant SaaS ERP** for serialized jewellery inventory management built with:

- **Frontend**: Next.js 16 (App Router) + React 19
- **Backend**: Supabase (Postgres + Auth + RLS)
- **Real-time**: Supabase Realtime (optional)
- **Storage**: Supabase Storage / AWS S3

## Core Architecture Principles

### 1. **Multi-Tenancy via Company Scoping**
Every operation is scoped to a `company_id`:
```typescript
// All queries include company isolation
const { data } = await supabase
  .from('inventory_items')
  .select('*')
  .eq('company_id', appUser.company_id)  // REQUIRED
```

### 2. **Critical Operations via RPC**
State-changing operations run as Postgres functions (not HTTP requests):
- `dispatch_stock_transfer()` - Atomic state change
- `receive_stock_transfer_item()` - Transactional receipt
- `pos_confirm_sale()` - Atomic invoice + inventory update
- `close_job_bag_and_create_item()` - Manufacturing workflow

### 3. **Row-Level Security (RLS)**
All tables have RLS enabled with policies like:
```sql
-- Users see only their company data
CREATE POLICY company_isolation ON inventory_items
  FOR ALL USING (company_id IN (
    SELECT company_id FROM app_users WHERE user_id = auth.uid()
  ));
```

### 4. **Authentication via Supabase Auth**
```
User Signup → auth.users → Invite user → Create app_users mapping
                                         (user_id, company_id, role)
```

## Data Flow Diagram

### Stock Transfer Flow
```
Create Transfer (Draft)
    ↓
Add Items (Scanner)
    ↓
Dispatch (RPC) → Items marked "in_transit"
    ↓
Receive Items (Scanner) → Items marked "in_stock" at new warehouse
    ↓
Finalize (RPC) → Handle missing items
```

### POS Transaction Flow
```
Scan Item → Add to Cart
    ↓
Select Customer
    ↓
Checkout (RPC: pos_confirm_sale)
    ├─ Create sales_invoices row
    ├─ Create sales_invoice_items
    ├─ Update inventory_items status → "sold"
    ├─ Create sales_payments
    └─ Return invoice details
    ↓
Print Receipt
```

### Job Bag → Item Creation Flow
```
Create Job Bag
    ↓
Issue Materials (Gold/Diamond)
    ↓
Karigar Works
    ↓
Close Job Bag (RPC: close_job_bag_and_create_item)
    ├─ Finalize material consumption
    ├─ Calculate costs
    └─ Create inventory_items (serialized)
    ↓
Item appears in inventory (in_stock)
```

## Database Schema Organization

### Identity & Authorization
```
auth.users (Supabase managed)
├── id (UUID)
├── email
└── password_hash

app_users (Our mapping)
├── user_id → auth.users.id
├── company_id
└── role (owner|manager|sales|karigar|admin)

user_warehouse_mapping
├── user_id
└── warehouse_id[]
```

### Company Configuration
```
companies
├── legal_name, trade_name
├── tax_ids (PAN, GSTIN, CIN)
└── settings (compliance, currency, metal, financial, rate, tax)

company_addresses
├── address_type (Registered|Billing|Corporate|Warehouse)
└── location data

company_bank_accounts
├── bank_name, account_number
└── default flags
```

### Core Operations
```
warehouses
├── warehouse_code, name
├── warehouse_type (main_safe|factory|branch|transit)
└── is_active

inventory_items (Serialized)
├── barcode (UNIQUE)
├── rfid_tag_id
├── warehouse_id
├── status (in_stock|transit|sold|missing)
├── metal_type, purity, weights
├── costs (metal, stone, making)
└── created_from_job_bag_id
```

### Manufacturing
```
job_bags
├── job_bag_number
├── karigar_id
├── status (in_progress|completed)
├── expected weights

job_bag_gold_issues, job_bag_diamond_issues
├── gold_batch_id / diamond_lot_id
└── issue_weight

job_bag_gold_consumption, job_bag_diamond_consumption
├── consumed weights
└── breakage tracking

item_components
├── item_id
├── lot_reference_id (diamond_lot_id)
└── component metadata
```

### Material Batches
```
inventory_gold_batches
├── batch_number
├── purity_karat, purity_percent
├── total_weight_g, remaining_weight_g
├── purchase_rate, total_purchase_value
├── fine_weight calculations
└── status (in_stock|consumed|lost)

inventory_diamond_lots
├── lot_number, lot_type
├── certifications
├── total_weight_cts, remaining_weight_cts
├── purchase_rate_per_ct
└── diamond valuation method
```

### Transfers
```
stock_transfers
├── transfer_number
├── from_warehouse_id, to_warehouse_id
├── status (draft|dispatched|received)
└── discrepancy tracking

stock_transfer_item_lines
├── item_id
└── is_received
```

### Sales
```
sales_invoices
├── invoice_number
├── customer_id
├── total_amount
├── status

sales_invoice_items
├── inventory_item_id
├── rate, quantity
└── tax details

sales_payments
├── payment_mode (cash|card|bank|cheque)
├── amount, reference
└── reconciliation status

sales_returns
├── return_number
├── invoice_id
├── refund_amount
└── status (pending|completed)
```

### Transactions
```
memo_transactions
├── memo_number
├── customer_id
├── status (open|converted|closed)
└── items issued

memo_transaction_items
├── item_id
└── quantity issued
```

### Masters
```
karigars (Artisans)
├── karigar_code
├── specialization
├── labor_rate
└── is_active

customers
├── full_name, phone, email
├── birth_date, anniversary_date
├── city, notes
└── custom fields

suppliers (Optional)
├── supplier_name
├── supplier_code
└── contact details
```

### Audit & Compliance
```
audit_logs
├── table_name
├── operation (INSERT|UPDATE|DELETE)
├── user_id
├── changes
└── created_at

document_sequences
├── doc_type
├── prefix
├── current_value
└── padding
```

## API Layer Architecture

### Client-Side Data Fetching
```typescript
// SWR / React Query pattern
const { data, isLoading, error } = useSWR(
  ['/api/inventory', companyId],
  fetcher,
  { revalidateOnFocus: false }
)

// Validation with Zod
const schema = inventorySchema.parse(formData)
```

### Server-Side RPC Calls
```typescript
// Critical operations only
const { data, error } = await supabase.rpc('dispatch_stock_transfer', {
  p_transfer_id: transferId,
  p_user_id: userId,
})
```

### Route Handlers (App Router)
```
app/api/
├── auth/
│   ├── signup/
│   └── login/
├── users/
│   ├── invite/ (Admin)
│   └── [id]/role/ (Update role)
├── inventory/
│   └── export/ (CSV export)
└── uploads/
    └── [type]/ (File storage)
```

## Authentication Flow

```
1. User visits /login
   ↓
2. Sign up/Sign in with email/password
   ↓
3. Supabase Auth creates auth.users record
   ↓
4. Frontend calls API to create app_users mapping
   ↓
5. Auth hook (useAuth) fetches:
   - auth.users → email, metadata
   - app_users → company_id, role
   - user_warehouse_mapping → warehouse_ids
   ↓
6. Redirect to /dashboard
   ↓
7. All queries include company_id filter (RLS enforced)
```

## Role-Based Access Control (RBAC)

### Frontend Checks (UX)
```typescript
if (appUser.role === 'owner') {
  // Show settings panel
}
```

### Backend Enforcement (RPC)
```sql
CREATE OR REPLACE FUNCTION dispatch_stock_transfer(...)
  RETURNS JSON AS $$
BEGIN
  -- Validate user role is manager or higher
  IF (SELECT role FROM app_users WHERE user_id = p_user_id) NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  ...
END;
```

## Performance Optimization

### 1. **Database Queries**
- Use database views for complex aggregations
- Index frequently filtered columns: `company_id`, `status`, `warehouse_id`
- Use `maybeSingle()` for optional single rows

### 2. **Frontend Caching**
- React Query with stale-while-revalidate
- Revalidate on focus or after mutations

### 3. **RLS Policy Performance**
- Cache role lookups in RPC functions
- Use JOINs instead of subqueries

### 4. **Real-time Updates (Optional)**
```typescript
// Subscribe to inventory changes
supabase
  .channel('inventory')
  .on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'inventory_items' },
    (payload) => {
      // Update UI
    }
  )
  .subscribe()
```

## Error Handling & Logging

### Client-Side
```typescript
try {
  const { data, error } = await callRpc(...)
  if (error) {
    toast({ title: 'Error', description: error.message })
  }
} catch (err) {
  // Handle network errors
  toast({ title: 'Error', description: 'Network error' })
}
```

### Server-Side (RPC)
```sql
BEGIN
  -- Transactional error handling
  RAISE EXCEPTION 'User % not found', p_user_id;
EXCEPTION WHEN OTHERS THEN
  -- Log to audit table
  INSERT INTO audit_logs (...) VALUES (...)
  RAISE;
END;
```

### Audit Trail
```sql
-- Trigger automatic logging
CREATE TRIGGER audit_inventory_items_changes
  AFTER INSERT OR UPDATE OR DELETE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();
```

## Scalability Considerations

### Horizontal Scaling
- Stateless Next.js frontend (deploy on Vercel)
- Postgres connection pooling via Supabase
- CDN for static assets (automatic with Vercel)

### Vertical Scaling
- Database indexes on `(company_id, created_at)` for range queries
- Archive old data to separate tables
- RLS policies optimized for fast permission checks

### Data Volume Handling
- Pagination for large tables (100 items per page default)
- Real-time subscriptions only on active transfers
- Batch operations for bulk updates

## Security Architecture

### Network Security
```
┌─────────────────────────────┐
│   Client (Browser)          │
│  - Anon Key (Public)        │
│  - Uses auth.uid()          │
└──────────┬──────────────────┘
           │ TLS/SSL
           ↓
┌─────────────────────────────┐
│  Supabase (Secure)          │
│  - RLS Policies             │
│  - Auth verified            │
│  - Service role (Server)    │
└─────────────────────────────┘
```

### Data Protection
- Row-level security (RLS) on all tables
- Encryption in transit (TLS)
- Passwords hashed with Supabase Auth (bcrypt)
- Sensitive data encrypted in database if needed

### Access Control
- Anon key: Read-only, limited scope
- Service role key: Server-side only (never client)
- JWT tokens with short expiry
- API rate limiting on critical endpoints

## Deployment Architecture

### Development
```
Local → git push → GitHub
                       ↓
                  Vercel Preview
```

### Staging
```
main branch → Vercel Deploy → Staging environment
             (with test data)
```

### Production
```
Release Tag → Vercel Production Deploy
            ├─ Next.js frontend
            ├─ API routes
            └─ Environment vars
                 ↓
            Supabase (Production)
            ├─ Primary DB
            ├─ Automated backups
            └─ RLS enforced
```

## Monitoring & Maintenance

### Health Checks
```typescript
// Periodic health check
setInterval(async () => {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    // Re-authenticate
  }
}, 5 * 60 * 1000)
```

### Database Monitoring
```sql
-- Slow query log
SELECT query, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Cache hit ratio
SELECT 
  sum(heap_blks_read) as heap_read, 
  sum(heap_blks_hit) as heap_hit, 
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio;
```

### Backup Strategy
- Daily automated snapshots (Supabase included)
- Weekly full backups
- Point-in-time recovery enabled
- Test restores monthly

## Future Architecture Enhancements

1. **API GraphQL Layer**
   - GraphQL API for complex queries
   - Automatic subscription support

2. **Event-Driven Architecture**
   - Event bus for state changes
   - Webhook integrations

3. **Advanced Analytics**
   - Separate analytics warehouse
   - BI tool integration

4. **Offline-First**
   - Local SQLite cache
   - Sync when online

5. **Mobile Apps**
   - React Native for iOS/Android
   - Same backend APIs
