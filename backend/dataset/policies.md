# NexusDesk E-Commerce Customer Support Policies & Service Guidelines

Welcome to NexusDesk AI Store Policies. Below are the official policies governing returns, warranties, damaged-item replacements, shipping timelines, refund procedures, and support ticket escalations.

---

## 1. 30-Day Standard Return Policy

### 1.1 Return Window & Eligibility
- **30-Day Window**: Customers can initiate a return within thirty (30) calendar days from the verified delivery date shown by carrier tracking.
- **Item Condition**:
  - Products must be in like-new, undamaged condition with all original packaging, tags, accessories, manuals, and charging cables included.
  - Consumer electronics (headphones, laptops, smartwatches, computer accessories) must be factory reset and unlinked from any personal cloud accounts (Apple iCloud, Google Account, Samsung Account).
- **Non-Returnable Items**:
  - Downloadable software licenses and digital gift cards.
  - Personal hygiene items (such as opened in-ear earbuds/ear tips) unless defective upon arrival or in original sealed, tamper-evident packaging.
  - Products showing signs of customer misuse, physical drop damage, water damage, or altered serial numbers.

### 1.2 Return Shipping Labels & Fees
- **Prepaid Return Labels**: For defective items, incorrect items shipped, or products damaged in transit, NexusDesk covers 100% of return shipping costs and issues an instant prepaid return shipping label (UPS or FedEx).
- **Buyer's Remorse / Discretionary Returns**: Returns initiated due to change of mind or personal preference within the 30-day window are subject to a flat $5.99 return shipping label deduction from the refund total, unless the customer holds an active NexusDesk Prime Support Membership.
- **Drop-Off Locations**: Packages can be dropped off at any authorized UPS Store, FedEx Office, or participating retail drop-off hub.

---

## 2. Warranty Coverage & Protection Plans

### 2.1 Standard 1-Year Limited Manufacturer Warranty
- All brand-new hardware devices sold on NexusDesk include a complimentary one (1) year limited warranty effective from the purchase date.
- **What is Covered**:
  - Mechanical and electrical failure under normal, intended use.
  - Manufacturer hardware defects in materials and craftsmanship.
  - Battery degradation exceeding 20% loss of total original capacity within the first 12 months.
  - Display defects (such as dead pixels exceeding manufacturer threshold or backlighting failure).
  - Internal audio driver malfunctions (buzzing, crackling, channel imbalance).
- **What is Excluded**:
  - Accidental physical damage (cracked screens, dented chassis, crushed enclosures).
  - Liquid spill, water submersion, corrosion, or fire exposure.
  - Unauthorized repair attempts, rooting, custom firmware flashing, or serial number removal.
  - Cosmetic wear and tear that does not affect basic device functionality.

### 2.2 Warranty Claim & RMA Process
- Customers can file a warranty claim by contacting NexusDesk Support with proof of purchase (Order ID) and a brief description of the defect.
- NexusDesk will guide the user through remote hardware diagnostics.
- If diagnostics confirm a hardware defect, a Return Merchandise Authorization (RMA) number and free return shipping label will be issued.
- Turnaround time for warranty repair or certified replacement dispatch is 3 to 5 business days upon warehouse receipt.

---

## 3. Damaged-Item Replacement Protocol

### 3.1 Reporting Window (48-Hour Guarantee)
- If an order arrives damaged, shattered, or defective right out of the box, customers must notify NexusDesk Support within **48 hours** of carrier delivery scan.
- Failure to report transit damage within 48 hours may delay claim approval with shipping couriers.

### 3.2 Proof & Documentation Required
- Customers must provide clear photographs of:
  1. The outer shipping carton showing shipping labels and carrier barcodes.
  2. The manufacturer product box.
  3. Close-up photographs showing the visible damage or defect.

### 3.3 Instant Zero-Cost Replacement Dispatch
- Once visual verification is confirmed by an agent or automated triage, an expedited replacement unit is dispatched immediately at zero additional cost.
- A prepaid return label is provided to return the damaged item. The damaged unit must be received by our fulfillment center within 21 calendar days to avoid an automatic non-return charge.

---

## 4. Shipping Timelines, Delays & Lost Packages

### 4.1 Delivery Standards & Options
- **Standard Shipping**: 3 to 5 business days (excluding federal holidays and weekends). Orders over $35 qualify for free standard shipping.
- **Expedited Shipping (2-Day)**: 2 business days guaranteed.
- **Priority Overnight Shipping**: Next business day delivery by 3:00 PM local time.

### 4.2 Transit Delays & Severe Weather Protocol
- Courier tracking updates may occasionally pause during regional weather disruptions, logistical customs scans, or peak holiday volumes.
- If an order experiences no tracking movement for more than 72 consecutive hours past the estimated delivery date, NexusDesk initiates an automatic carrier search investigation.

### 4.3 "Delivered" But Package Missing Protocol
If tracking indicates "Delivered" but the customer cannot locate the package:
1. **24-Hour Buffer Window**: Couriers frequently scan parcels 12–24 hours in advance during final route distribution. Customers are asked to allow 24 hours.
2. **Delivery Site Verification**: Check porch areas, mailrooms, rear entrances, leasing offices, or with immediate neighbors.
3. **Formal Courier Investigation & Resolution**: If still missing after 24 hours, NexusDesk files an official lost package tracer with the carrier. If not located within 48 hours of tracer opening, customer can choose between an immediate free replacement shipment or a 100% full refund.

---

## 5. Refund Timelines & Processing Methods

### 5.1 Warehouse Inspection Window
- Once the returned package is delivered to the NexusDesk Central Returns Depot, warehouse personnel perform inspection within **2 to 3 business days**.
- Inspection verifies serial numbers, product completeness, and reported condition.

### 5.2 Payment Method Refund Speeds
Upon inspection approval, the refund is authorized immediately. Depending on the financial institution:
- **Credit / Debit Cards (Visa, MasterCard, Amex, Discover)**: 5 to 7 business days for the credit to appear on the customer's bank statement.
- **PayPal / Apple Pay / Google Wallet**: 24 to 48 hours.
- **NexusDesk Store Credit / Gift Balance**: Instantaneous (available immediately for subsequent purchases).
- **Original Shipping Fees**: Non-refundable unless the return was necessitated by our warehouse error, damaged arrival, or verified defective product.

---

## 6. Escalation Protocol & Human Agent Handoff

### 6.1 Automatic Escalation Triggers
NexusDesk AI autonomously escalates customer conversations to a Tier 2 Human Support Specialist under any of the following conditions:
- User explicitly requests a human supervisor, live representative, or phone callback.
- Repeated billing disputes, chargeback threats, or double-charge reports.
- Low-confidence RAG retrieval where internal policy or catalog context cannot answer the query with at least 65% confidence.
- Damaged item claims exceeding $500 in total value requiring specialized fraud verification.
- Damaged or missing shipment reports unresolved after primary troubleshooting.

### 6.2 Service Level Agreement (SLA)
- **Live Ticket Creation**: A structured support ticket (`TICK-XXXXXXXX`) is saved immediately in the NexusDesk SQLite database.
- **Webhook Dispatch**: Ticket metadata is pushed via automated HTTP POST payload to the n8n Workflow Orchestrator (`N8N_WEBHOOK_URL`).
- **Human Agent Response Time**: Tier 2 human support responds via email or customer support portal within 2 hours during normal operating hours (Monday–Friday 8:00 AM – 8:00 PM EST), or within 12 hours during weekends/holidays.
