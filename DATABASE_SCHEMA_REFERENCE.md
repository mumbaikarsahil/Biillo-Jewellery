# Jewellery ERP - Database Schema Reference

Quick reference guide for all database tables and their relationships.

## Identity & Authorization Tables

### `auth.users` (Supabase Managed)
Supabase-managed authentication table
```
id (UUID, primary key)
email (string)
encrypted_password (string)
email_confirmed_at (timestamp)
last_sign_in_at (timestamp)
user_metadata (JSON)
```

### `app_users`
Maps users to companies and roles
```
user_id (UUID, PK, FK → auth.users.id)
company_id (UUID, FK → companies.id) [REQUIRED - NEVER NULL]
role (enum: owner|manager|sales|karigar|admin)
created_at (timestamp)
```

**Critical**: Always set `company_id` when creating records!

### `user_warehouse_mapping`
Assigns warehouses to users (many-to-many)
```
id (UUID, PK)
user_id (UUID, FK → app_users.user_id)
warehouse_id (UUID, FK → warehouses.id)
created_at (timestamp)
```

## Company Configuration Tables

### `companies`
Main company record
```
id (UUID, PK)
legal_name (string, NOT NULL)
trade_name (string)
company_code (string, NOT NULL, UNIQUE)
pan_number (string)
cin_number (string)
gstin (string)
udyam_registration_no (string)
iec_code (string)
logo_url (string)
status (enum: active|inactive|archived, default: active)
created_at (timestamp)
updated_at (timestamp)
created_by (UUID, FK → auth.users.id)
```

### `company_addresses`
Multiple addresses per company
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK → companies.id)
address_type (enum: Registered|Billing|Corporate|Warehouse)
line1 (string, NOT NULL)
line2 (string)
city (string, NOT NULL)
state (string, NOT NULL)
country (string, default: India)
pincode (string, NOT NULL)
latitude (float)
longitude (float)
created_at (timestamp)
updated_at (timestamp)
```

### `company_bank_accounts`
Bank details for payments
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK → companies.id)
bank_name (string, NOT NULL)
account_name (string, NOT NULL)
account_number (string, NOT NULL)
ifsc_code (string, NOT NULL)
branch_name (string)
account_type (enum: CURRENT|SAVINGS|CC|OD, default: CURRENT)
is_default_for_sales (boolean, default: false)
is_default_for_purchases (boolean, default: false)
created_at (timestamp)
updated_at (timestamp)
```

### Company Settings Tables (One per company)

**`company_compliance_settings`**
```
id (UUID, PK)
company_id (UUID, NOT NULL, UNIQUE, FK)
gst_auto_calculation (boolean, default: true)
tds_enabled (boolean, default: false)
tcs_enabled (boolean, default: false)
audit_trail_mandatory (boolean, default: true)
stock_valuation_required_for_balance_sheet (boolean)
created_at, updated_at (timestamps)
```

**`company_currency_settings`**
```
id (UUID, PK)
company_id (UUID, NOT NULL, UNIQUE, FK)
allowed_currencies (text[], default: {INR})
default_currency (text, default: INR)
auto_fetch_exchange_rate (boolean)
exchange_rate_source (string)
created_at, updated_at (timestamps)
```

**`company_financial_settings`**
```
id (UUID, PK)
company_id (UUID, NOT NULL, UNIQUE, FK)
base_currency (string, default: INR)
financial_year_start_month (integer, 1-12, default: 4)
inventory_valuation_method (enum: FIFO|Weighted)
default_tax_calculation_mode (enum: inclusive|exclusive)
rounding_precision (integer: 2|3, default: 2)
allow_negative_stock (boolean, default: false)
metal_rate_update_policy (enum: manual|auto-feed, default: manual)
default_metal_rate_source (string)
created_at, updated_at (timestamps)
```

**`company_diamond_settings`**
```
id (UUID, PK)
company_id (UUID, NOT NULL, UNIQUE, FK)
diamond_inventory_mode (enum: hybrid|weighted|packet)
valuation_method (enum: packet_average|cost_per_ct)
certification_tracking_required (boolean, default: true)
allow_uncertified_sales (boolean, default: false)
max_uncertified_weight_cts (numeric, default: 0.3)
diamond_loss_tracking_enabled (boolean)
diamond_breakage_threshold_percent (numeric, default: 2.0)
default_diamond_currency (enum: USD|INR, default: USD)
auto_convert_currency (boolean, default: true)
exchange_rate_source (string)
enable_sieve_size_tracking (boolean, default: true)
created_at, updated_at (timestamps)
created_by, updated_by (UUIDs)
```

**`company_metal_defaults`**
```
id (UUID, PK)
company_id (UUID, NOT NULL, UNIQUE, FK)
std_gold_purity_pct (numeric, default: 99.5)
std_silver_purity_pct (numeric, default: 99.9)
consider_making_charges_in_stock_value (boolean, default: true)
consider_stone_value_in_stock_value (boolean, default: true)
created_at, updated_at (timestamps)
```

## Core Operational Tables

### `warehouses`
Physical or logical storage locations
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK → companies.id)
warehouse_code (string, NOT NULL)
name (string, NOT NULL)
warehouse_type (enum: main_safe|factory|branch|transit)
is_active (boolean, default: true)
created_at, updated_at (timestamps)
```

### `karigars`
Artisans and laborers
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK → companies.id)
karigar_code (string, NOT NULL)
full_name (string, NOT NULL)
phone (string)
specialization (string)
default_labor_rate (numeric)
labor_type (enum: hourly|piece_rate|monthly)
is_active (boolean, default: true)
created_at, updated_at (timestamps)
```

### `customers`
Customer master database
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK → companies.id)
full_name (string, NOT NULL)
phone (string, NOT NULL)
email (string)
birth_date (date)
anniversary_date (date)
city (string)
notes (text)
created_at, updated_at (timestamps)
```

## Inventory Tables

### `inventory_items`
Serialized finished ornaments (THE core table)
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK → companies.id)
barcode (string, NOT NULL, UNIQUE) ← Core identifier
rfid_tag_id (string, UNIQUE)
sku_reference (string)
warehouse_id (UUID, NOT NULL, FK → warehouses.id)
status (enum: in_stock|transit|sold|missing, default: in_stock)
last_status_change_at (timestamp)

metal_type (string, NOT NULL)
purity_karat (string, NOT NULL)
purity_percent (numeric, 0-100)
gross_weight_g (numeric, > 0)
net_weight_g (numeric, > 0)
total_stone_weight_cts (numeric, ≥ 0, default: 0)
total_stone_pieces (integer, ≥ 0, default: 0)

cost_metal (numeric, default: 0)
cost_stone (numeric, default: 0)
cost_making (numeric, default: 0)
cost_total (numeric, computed: metal + stone + making)

mrp (numeric)
pricing_strategy (enum: AUTO|MANUAL|FORMULA, default: AUTO)
huid_code (string, UNIQUE)
hsn_code (string)
image_url (string)

created_from_job_bag_id (UUID, FK → job_bags.id)
quantity (integer, > 0, default: 1)

created_at, updated_at (timestamps)
created_by, updated_by (UUIDs)
```

### `inventory_gold_batches`
Raw gold inventory
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK)
batch_number (string, NOT NULL)
warehouse_id (UUID, NOT NULL, FK)

purity_karat (string, NOT NULL)
purity_percent (numeric, 0-100)
total_weight_g (numeric, > 0)
remaining_weight_g (numeric)

purchase_rate_per_g (numeric, > 0)
total_purchase_value (numeric)
status (enum: in_stock|consumed|lost, default: in_stock)

fine_total_weight_g (computed: total_weight_g * purity_percent/100)
fine_remaining_weight_g (computed: remaining_weight_g * purity_percent/100)

supplier_id (UUID, FK → suppliers.id)
purchase_invoice_id (UUID)
created_at, updated_at (timestamps)
```

### `inventory_diamond_lots`
Raw diamond/stone inventory
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK)
lot_number (string, NOT NULL)
warehouse_id (UUID, NOT NULL, FK)

lot_type (enum: certified|uncertified|mixed)
stone_type (string, default: DIAMOND)
shape (string)
color (string)
clarity (string)
sieve_size (string)

total_pieces (integer)
remaining_pieces (integer)
total_weight_cts (numeric, > 0)
remaining_weight_cts (numeric)

purchase_currency (enum: USD|INR)
purchase_rate_per_ct (numeric, > 0)
total_purchase_value (numeric)
valuation_method (enum: packet_average|cost_per_ct)

certificate_number (string)
certificate_agency (string)
certificate_file_url (string)

status (enum: in_stock|consumed|lost, default: in_stock)
supplier_id (UUID)
purchase_invoice_id (UUID)

created_at, updated_at (timestamps)
created_by, updated_by (UUIDs)
```

### `item_components`
What materials make up an item
```
id (UUID, PK)
item_id (UUID, NOT NULL, FK → inventory_items.id)
component_type (enum: GOLD|DIAMOND|SILVER|STONE)
lot_reference_id (UUID, FK → inventory_diamond_lots.id)
description (string)
quantity_pieces (integer)
weight_cts (numeric)
cost_rate (numeric)
total_cost_value (numeric)
created_at (timestamp)
```

## Manufacturing Tables

### `job_bags`
Manufacturing work orders
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK)
job_bag_number (string, NOT NULL)
product_category (string, NOT NULL)
design_code (string)
karigar_id (UUID, NOT NULL, FK → karigars.id)

status (enum: in_progress|completed|on_hold, default: in_progress)

gold_expected_weight_g (numeric)
diamond_expected_weight_cts (numeric)
issue_date (date)
expected_return_date (date)

created_at, updated_at (timestamps)
```

### `job_bag_gold_issues`
Gold issued to karigar
```
id (UUID, PK)
job_bag_id (UUID, NOT NULL, FK)
gold_batch_id (UUID, NOT NULL, FK)
issued_weight_g (numeric, > 0)
issue_date (date)
created_at (timestamp)
```

### `job_bag_diamond_issues`
Diamonds issued to karigar
```
id (UUID, PK)
job_bag_id (UUID, NOT NULL, FK)
diamond_lot_id (UUID, NOT NULL, FK)
issued_weight_cts (numeric, > 0)
issued_pieces (integer)
issue_date (date)
created_at (timestamp)
```

### `job_bag_gold_consumption`
Actual gold used
```
id (UUID, PK)
job_bag_id (UUID, NOT NULL, FK)
gold_batch_id (UUID, NOT NULL, FK)
consumed_weight_g (numeric, > 0)
wastage_weight_g (numeric, default: 0)
created_at (timestamp)
```

### `job_bag_diamond_consumption`
Actual diamonds used
```
id (UUID, PK)
job_bag_id (UUID, NOT NULL, FK)
diamond_lot_id (UUID, NOT NULL, FK)
consumed_weight_cts (numeric, > 0)
consumed_pieces (integer)
breakage_weight_cts (numeric, default: 0)
created_at (timestamp)
```

## Stock Transfer Tables

### `stock_transfers`
Transfer headers
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK)
transfer_number (string, NOT NULL)
from_warehouse_id (UUID, NOT NULL, FK)
to_warehouse_id (UUID, NOT NULL, FK)
status (enum: draft|dispatched|received|partial, default: draft)
notes (text)
created_at, updated_at (timestamps)
```

### `stock_transfer_item_lines`
Items in each transfer
```
id (UUID, PK)
transfer_id (UUID, NOT NULL, FK)
item_id (UUID, NOT NULL, FK → inventory_items.id)
is_received (boolean, default: false)
received_at (timestamp)
received_by (UUID)
created_at (timestamp)
```

## Sales Tables

### `sales_invoices`
Sale transactions
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK)
invoice_number (string, NOT NULL, UNIQUE)
customer_id (UUID, NOT NULL, FK → customers.id)
total_amount (numeric)
total_tax (numeric)
final_amount (numeric)
status (enum: pending|completed|cancelled, default: completed)
created_at, updated_at (timestamps)
created_by (UUID)
```

### `sales_invoice_items`
Individual items sold
```
id (UUID, PK)
invoice_id (UUID, NOT NULL, FK)
inventory_item_id (UUID, NOT NULL, FK)
rate (numeric, NOT NULL)
quantity (integer, default: 1)
tax_percent (numeric, default: 0)
tax_amount (numeric)
created_at (timestamp)
```

### `sales_payments`
Payment records
```
id (UUID, PK)
invoice_id (UUID, NOT NULL, FK)
company_id (UUID, NOT NULL, FK)
payment_mode (enum: cash|card|bank|cheque|credit)
amount (numeric, > 0)
reference_no (string)
bank_account_id (UUID, FK)
status (enum: pending|completed|failed, default: completed)
created_at (timestamp)
```

### `sales_returns`
Return transactions
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK)
return_number (string, NOT NULL)
invoice_id (UUID, NOT NULL, FK)
status (enum: pending|completed|credited, default: pending)
refund_amount (numeric)
created_at, updated_at (timestamps)
```

### `sales_return_items`
Items being returned
```
id (UUID, PK)
return_id (UUID, NOT NULL, FK)
invoice_item_id (UUID, NOT NULL, FK)
inventory_item_id (UUID, NOT NULL, FK)
quantity (integer)
refund_rate (numeric)
created_at (timestamp)
```

## Memo Tables

### `memo_transactions`
Temporary item tracking
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK)
memo_number (string, NOT NULL)
customer_id (UUID, NOT NULL, FK)
status (enum: open|converted|closed, default: open)
total_amount (numeric, default: 0)
created_at, updated_at (timestamps)
```

### `memo_transaction_items`
Items in memo
```
id (UUID, PK)
memo_id (UUID, NOT NULL, FK)
inventory_item_id (UUID, NOT NULL, FK)
quantity (integer, > 0)
rate (numeric)
created_at (timestamp)
```

## CRM Tables

### `customer_leads`
Sales leads
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK)
warehouse_id (UUID, NOT NULL, FK)
customer_id (UUID, FK)
lead_source (string)
interested_category (string)
budget_range (string)
status (enum: open|follow_up|converted|lost, default: open)
next_followup_date (date)
notes (text)
created_by (UUID)
created_at, updated_at (timestamps)
```

### `customer_lead_activities`
Interactions with leads
```
id (UUID, PK)
lead_id (UUID, NOT NULL, FK)
activity_type (string)
remarks (text)
next_followup_date (date)
created_by (UUID)
created_at (timestamp)
```

## Audit & Utility Tables

### `audit_logs`
Comprehensive audit trail
```
id (UUID, PK)
company_id (UUID, FK)
table_name (string, NOT NULL)
operation (enum: INSERT|UPDATE|DELETE)
user_id (UUID)
old_values (JSON)
new_values (JSON)
created_at (timestamp)
```

### `document_sequences`
Auto-numbering for documents
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK)
doc_type (string, NOT NULL) ← e.g., "INVOICE", "TRANSFER"
prefix (string, NOT NULL)
current_year (integer)
current_value (integer)
padding_length (integer, default: 5)
```

## Movement Tracking Tables

### `gold_lot_movements`
Gold batch history
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK)
gold_batch_id (UUID, NOT NULL, FK)
movement_type (enum: ISSUE|CONSUMPTION|LOSS|RETURN)
movement_weight_g (numeric, ≠ 0)
reference_type (string) ← e.g., "JOB_BAG", "TRANSFER"
reference_id (UUID)
notes (text)
created_at (timestamp)
```

### `diamond_lot_movements`
Diamond batch history
```
id (UUID, PK)
company_id (UUID, NOT NULL, FK)
diamond_lot_id (UUID, NOT NULL, FK)
movement_type (enum: ISSUE|CONSUMPTION|LOSS|BREAKAGE|RETURN)
movement_weight_cts (numeric, ≠ 0)
movement_pieces (integer)
reference_type (string)
reference_id (UUID)
notes (text)
created_at (timestamp)
created_by (UUID)
```

## Key Relationships

```
companies
├── app_users (1:N)
├── warehouses (1:N)
├── inventory_items (1:N)
├── stock_transfers (1:N)
├── sales_invoices (1:N)
├── job_bags (1:N)
└── customers (1:N)

warehouses
├── user_warehouse_mapping (1:N)
├── inventory_items (1:N)
├── inventory_gold_batches (1:N)
└── inventory_diamond_lots (1:N)

job_bags
├── inventory_items (1:N)
├── job_bag_gold_issues (1:N)
├── job_bag_diamond_issues (1:N)
└── job_bag_*_consumption (1:N)

stock_transfers
└── stock_transfer_item_lines (1:N)

sales_invoices
├── sales_invoice_items (1:N)
├── sales_payments (1:N)
└── sales_returns (1:N)
```

## RLS Policies

All tables should have RLS enabled with policy like:

```sql
CREATE POLICY "company_isolation"
ON inventory_items
FOR ALL
USING (company_id IN (
  SELECT company_id FROM app_users WHERE user_id = auth.uid()
));
```

---

**Last Updated**: 2026-02-16
