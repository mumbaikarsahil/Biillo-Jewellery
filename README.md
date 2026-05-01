# Jewellery ERP - Serialized Inventory Management System

A complete Next.js + Supabase enterprise resource planning system for managing serialized jewellery inventory, including job bags, stock transfers, point-of-sale, and comprehensive reporting.

## Key Features

### 🔐 Authentication & Authorization
- Supabase Auth integration with email/password
- Role-based access control (Owner, Manager, Sales, Karigar, Admin)
- Company-scoped data isolation - strict multi-tenancy
- Warehouse assignments per user

### 📦 Inventory Management
- **Serialized Item Tracking**: Every ornament has unique barcode/RFID
- **Gold Batches**: Track precious metal inventory by purity and weight
- **Diamond Lots**: Manage stone inventory with cerxxxxtification tracking
- **Job Bags**: Manufacturing workflow with material issue and consumption
- **Stock Status Tracking**: in_stock, transit, sold, missing states

### 🚚 Stock Movement Control
- **Stock Transfers**: Create transfers between warehouses
- **Dispatch RPC**: Atomically mark items in transit
- **Receive RPC**: Scan items at destination warehouse
- **Discrepancy Handling**: Track missing/damaged items during transfer
- **RLS Protection**: Row-level security prevents unauthorized access

### 🛒 Point of Sale (POS)
- Barcode/RFID scanning for rapid checkout
- Customer selection with quick-add capability
- **pos_confirm_sale RPC**: Atomic invoice creation and inventory update
- Multiple payment modes support
- Invoice printing and receipt generation

### 📝 Manufacturing Operations
- **Job Bag Creation**: Issue materials to karigars with expected weights
- **Material Consumption**: Track actual usage vs expected
- **Job Closure RPC**: Automatically create inventory items from finished jobs
- Labor rate tracking by karigar

### 💼 Sales & Returns
- Sales invoices with tax calculation
- **Sales Return RPC**: Process returns and restocking
- Credit note generation
- Customer purchase history

### 📊 Dashboards & Reporting
- Manager Dashboard: inventory summary, transfer status
- Owner Dashboard: financial summaries, KPIs
- Sales Dashboard: revenue tracking, customer leads
- Real-time inventory views via database views

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript
- **Styling**: TailwindCSS + Shadcn UI
- **Database**: Supabase (Postgres)
- **Auth**: Supabase Auth
- **Forms**: React Hook Form + Zod validation
- **Data Fetching**: React Query / SWR compatible
- **Charts**: Recharts for KPI visualization
- **Scanning**: Camera-based barcode scanning support

## Installation & Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd jewellery-erp

# Install dependencies
pnpm install
```

### 2. Setup Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the database migrations (provided in your schema)
3. Enable RLS on all tables
4. Create the required RPC functions (dispatch, receive, close_job_bag, pos_confirm_sale, etc.)

### 3. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.local.example .env.local

# Edit with your Supabase credentials
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Start Development Server

```bash
pnpm dev
```

Navigate to `http://localhost:3000` and login with your Supabase credentials.

## Project Structure

```
app/
├── layout.tsx              # Root layout
├── page.tsx                # Redirect to dashboard
├── login/                  # Authentication
├── dashboard/              # Main dashboard
├── master/                 # Master data setup
│   ├── company/
│   ├── warehouse/
│   ├── users/
│   ├── karigar/
│   └── customer/
├── inventory/              # Inventory management
│   ├── items/
│   ├── gold-batches/
│   ├── diamond-lots/
│   └── job-bags/
├── transfer/               # Stock transfers
├── pos/                    # Point of sale
├── memo/                   # Memo transactions
├── sales/                  # Sales & returns
└── reports/                # Analytics

components/
├── Navbar.tsx              # Navigation sidebar
├── DataTable.tsx           # Reusable table component
├── Scanner.tsx             # Barcode/RFID scanner
├── forms/                  # Form components
└── ui/                     # Shadcn UI components

lib/
├── supabaseClient.ts       # Supabase client initialization
├── api.ts                  # API fetchers
├── rpc.ts                  # RPC wrapper functions
├── validators.ts           # Zod schemas
└── utils.ts                # Utility functions

hooks/
├── useAuth.ts              # Authentication hook
├── useRpc.ts               # RPC caller hook
└── use-toast.ts            # Toast notifications
```

## Critical Security Rules

### ✅ RPC-Only Operations
These MUST be called through Postgres functions, never direct table updates:

- `dispatch_stock_transfer()` - Updates item status to transit
- `receive_stock_transfer_item()` - Updates warehouse location
- `finalize_transfer_with_discrepancy()` - Marks items missing/disputed
- `close_job_bag_and_create_item()` - Creates inventory items
- `pos_confirm_sale()` - Creates invoice and updates inventory
- `convert_memo_transaction()` - Changes memo status
- `complete_sales_return()` - Processes returns

### 🔒 Company Scoping
Every query MUST include `company_id` filter:

```typescript
const { data } = await supabase
  .from('inventory_items')
  .select('*')
  .eq('company_id', appUser.company_id)  // ← REQUIRED
```

### 🔐 Row Level Security (RLS)
Enable RLS on all tables with company isolation:

```sql
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company isolation"
  ON inventory_items
  FOR ALL
  USING (company_id = auth.uid()::uuid);  -- Adjust based on context
```

## Critical Data Flows

### Stock Transfer Flow
1. Create transfer header (draft)
2. Add items via scanner to transfer lines
3. **RPC: dispatch_stock_transfer()** → items marked as "transit"
4. At destination: **RPC: receive_stock_transfer_item()** per scanned item
5. **RPC: finalize_transfer_with_discrepancy()** → marks any missing items

### Job Bag to Sale Flow
1. Create job bag with expected materials
2. Issue gold/diamonds from batches
3. Karigar works and returns materials
4. Close job bag → **RPC: close_job_bag_and_create_item()** creates serialized item
5. Item appears in inventory as "in_stock"
6. Customer purchases → **RPC: pos_confirm_sale()** creates invoice, marks "sold"

### POS Transaction Flow
1. Scanner barcode → add to cart
2. Select customer
3. Checkout → **RPC: pos_confirm_sale()**
   - Creates sales_invoices record
   - Updates inventory items to "sold"
   - Creates sales_payments entry
   - Runs in transaction (atomic)
4. Print receipt

## Admin Operations

### Inviting Users

```typescript
// Use Supabase Admin API or server endpoint
const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
  'user@example.com'
)

// Then create app_users mapping
await supabase.from('app_users').insert({
  user_id: data.user.id,
  company_id: appUser.company_id,  // ← MUST SET
  role: 'sales',
})
```

### Setting Up Company
1. Navigate to `/master/company`
2. Enter legal name, tax details (PAN, GSTIN)
3. Save company configuration
4. Add addresses (Registered, Billing, etc.)
5. Register warehouses
6. Configure bank accounts

## API Routes for Admin

### User Management
- `POST /api/users/invite` - Invite new user
- `PUT /api/users/[id]/role` - Update user role
- `POST /api/users/[id]/warehouse` - Assign warehouse

## Validation & Error Handling

All forms use Zod schemas for validation:

```typescript
import { companySchema, type CompanyFormData } from '@/lib/validators'

const form = useForm<CompanyFormData>({
  resolver: zodResolver(companySchema),
})
```

Server-side RPC errors are caught and displayed as toast notifications:

```typescript
const { data, error } = await callRpc('dispatch_stock_transfer', params)
if (error) {
  toast({ title: 'Error', description: error.message })
}
```

## Performance Tips

- Use `maybeSingle()` for optional single row queries
- Implement pagination for large tables
- Cache company settings with React Query stale time
- Use database views for complex aggregations
- Enable Postgres query optimization

## Troubleshooting

### "User profile not found"
- User not in `app_users` table
- Company scoping issue - `company_id` is NULL
- Run: `INSERT INTO app_users (user_id, company_id, role) VALUES (...)`

### "Item not in stock"
- Item status is not 'in_stock'
- Item belongs to different warehouse
- Item already sold/transferred

### RPC Authorization Error
- User doesn't have required role
- Company ID mismatch in RPC parameters
- RLS policy blocking the operation

## Future Enhancements

- [ ] Offline-first POS with queue
- [ ] Mobile app for scanning
- [ ] Real-time inventory updates (Supabase Realtime)
- [ ] Advanced reporting dashboards
- [ ] Audit trail and compliance reports
- [ ] Automated backup and disaster recovery
- [ ] Integration with accounting software

## License

Proprietary - Jewellery ERP System

## Support

For issues or questions:
1. Check the database schema for table constraints
2. Verify RLS policies are correctly configured
3. Review browser console for detailed error messages
4. Check Supabase logs for RPC execution errors
