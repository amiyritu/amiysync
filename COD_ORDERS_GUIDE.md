# COD Orders Reconciliation Guide

## Overview
This guide explains how Shopify COD (Cash-on-Delivery) orders are matched with Shiprocket settlement data to show you exactly what was received for each order.

---

## Data Flow: From Shopify to Shiprocket to Your Account

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SHOPIFY: Customer Places COD Order                            │
│    - Order #3272 for ₹1190                                      │
│    - Customer will pay ₹1190 at delivery                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│ 2. SHIPROCKET: Ships the order, collects payment               │
│    - Receives ₹1190 from customer                              │
│    - Deducts shipping charges: ₹100                            │
│    - Deducts COD handling fees: ₹50                            │
│    - Net amount to remit: ₹1040                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│ 3. YOUR BANK: Settlement/Remittance                             │
│    - You receive ₹1040 in your bank account                     │
│    - Shiprocket keeps ₹50 for their service                     │
│    - You keep ₹100 (shipping charges)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## COD_Orders_Settlement Sheet Columns

### Column A: Shopify Order ID
- **What it is**: Shopify's internal unique identifier for this order
- **Example**: `gid://shopify/Order/7439439872`
- **Use it for**: Technical reference, API lookups
- **Matches with Shiprocket**: See "Match Method" column (P)

### Column B: Shopify Order #
- **What it is**: Human-readable order number shown on invoices
- **Example**: `#3272`
- **Use it for**: Customer communication, invoice reference
- **Matches with Shiprocket**: Shiprocket's `channel_order_id` (without the #)

### Column C: Order Date
- **What it is**: When the order was placed on Shopify
- **Example**: `2024-01-15T10:30:00Z`
- **Use it for**: Tracking order timeline

### Column D: Customer Name
- **What it is**: Who ordered it
- **Example**: `Amiy Ritu`
- **Use it for**: Customer communication reference

### Column E: Shopify Order Total (₹)
- **What it is**: Total amount customer was supposed to pay (what you charged them)
- **Example**: `1190`
- **Use it for**: Verify what customer owed
- **Note**: For COD, this is cash that should have been collected by Shiprocket

---

## Shiprocket Settlement Details (What You Actually Received)

### Column F: Shiprocket Order Amount (₹)
- **What it is**: The amount Shiprocket says it collected from the customer
- **Example**: `1190`
- **Should match**: Shopify Order Total (Column E)
- **If different**: Customer may not have paid full amount or Shiprocket had issues

### Column G: Net Settlement (₹) ⭐ **MOST IMPORTANT**
- **What it is**: What actually hit your bank account after all deductions
- **Example**: `1040`
- **Calculation**: Order Amount - Shipping Charges - COD Charges - Adjustments - RTO
- **Use it for**: Verify how much money you actually got
- **Key fact**: For COD, this is lower than Shopify total because of Shiprocket fees

### Column H: Shipping Charges (₹)
- **What it is**: Shiprocket's cost to ship the item
- **Example**: `100`
- **Who pays it**: You, not the customer (standard for COD)
- **Deducted from**: Your settlement amount

### Column I: COD Charges (₹) ⭐ **IMPORTANT**
- **What it is**: Shiprocket's fee for collecting cash from customer
- **Example**: `50`
- **Why it exists**: Handling payment, logistics of cash flow
- **Shiprocket keeps**: This amount, you don't get it
- **Deducted from**: Your settlement amount (reduces Column G)

### Column J: Adjustments (₹)
- **What it is**: Any additional deductions or credits
- **Example**: `0` or `-10` (if Shiprocket gave you credit)
- **Reasons for deductions**: Weight overcharge, handling fees, discrepancies
- **Reasons for credits**: Refunds, corrections
- **Deducted from**: Your settlement amount

### Column K: RTO Reversal (₹)
- **What it is**: Cost if item was returned to origin
- **Example**: `0` (no return) or `150` (customer refused, returned to you)
- **Happens when**: Customer refuses delivery or is not available
- **You pay this**: This is your cost
- **Deducted from**: Your settlement amount

---

## Key Columns for Understanding Discrepancies

### Column L: Difference (₹) ⭐ **DISCREPANCY CHECK**
- **What it is**: Shopify Total - Net Settlement
- **Example**: `150` (means ₹150 less than expected)
- **Calculation**: Column E - Column G
- **What it means**:
  - **0**: Perfect match, everything reconciled
  - **Positive number**: You got less than charged (due to fees/deductions)
  - **Negative number**: You got more than expected (unusual, review it)
  
**For Typical COD Order with Example Numbers:**
```
  Shopify Order Total:    ₹1190  (Column E)
  - Shipping Charges:     -₹100  (Column H)
  - COD Charges:          -₹50   (Column I)
  = Net Settlement:       ₹1040  (Column G)
  = Difference:           ₹150   (Column L) - This is expected for COD
```

---

## Tracking Columns

### Column M: AWB / Tracking #
- **What it is**: Shiprocket's shipment tracking number (Air Waybill)
- **Use it for**: Track the shipment with courier
- **If blank**: Order not yet shipped or data not received from Shiprocket

### Column N: Remittance Date
- **What it is**: When Shiprocket settled/remitted the money
- **Use it for**: Reconcile with your bank deposits
- **Match with**: Your bank statement date (usually 3-5 days after delivery)

### Column O: Batch ID
- **What it is**: Shiprocket's settlement batch reference
- **Use it for**: Group orders by settlement batch
- **Helpful for**: Understanding when money was released together

---

## Matching Column

### Column P: Match Method
- **Possible values**:
  - `channel_order_id`: Matched by Shopify order # (best match)
  - `shiprocket_order_id`: Matched by internal ID (fallback)
  - `no_match`: No Shiprocket data found yet (pending settlement)

- **What it means**:
  - ✅ `channel_order_id` = Confident match
  - ⚠️ `shiprocket_order_id` = Matched but less ideal
  - ❌ `no_match` = Shiprocket hasn't processed yet (normal for recent orders)

---

## Understanding Your Numbers: Real Example

### Order #3272 - Customer paid ₹1190 COD

| Column | Label | Value | Explanation |
|--------|-------|-------|-------------|
| A | Shopify Order ID | `gid://...7439` | Internal Shopify ID |
| B | Shopify Order # | `#3272` | The order number |
| E | Shopify Total | ₹1190 | What customer owed |
| F | Shiprocket Amount | ₹1190 | What Shiprocket collected ✓ |
| G | Net Settlement | ₹1040 | What you received |
| H | Shipping Charges | ₹100 | Your shipping cost |
| I | COD Charges | ₹50 | Shiprocket's collection fee |
| J | Adjustments | ₹0 | No additional adjustments |
| K | RTO Reversal | ₹0 | Order was delivered ✓ |
| L | Difference | ₹150 | Expected (shipping + COD fees) |
| M | AWB | `SR1234567890` | Tracking number |
| N | Remittance Date | `2024-01-18` | When you got the money |
| P | Match Method | `channel_order_id` | Matched by order number ✓ |

---

## FAQ: Why Shopify Total ≠ Net Settlement

### Common Scenarios:

**Scenario 1: COD Order (Normal)**
```
You charged customer:     ₹1000
Shiprocket deducts:
  - Shipping:            -₹100 (you pay for shipping)
  - COD Fee:             -₹50  (you pay for collection)
You receive:             ₹850
Difference:              ₹150  ✓ EXPECTED
```

**Scenario 2: Prepaid Order (No COD Fee)**
```
You charged customer:     ₹1000
Shiprocket deducts:
  - Shipping:            -₹100 (you pay for shipping)
You receive:             ₹900
Difference:              ₹100  ✓ EXPECTED
```

**Scenario 3: RTO (Return to Origin)**
```
You charged customer:     ₹1000
But customer refused!
Shiprocket deducts:
  - Shipping back:       -₹150 (return cost)
  - COD Fee:             -₹50  (they collected nothing)
You receive:             ₹800 (or even negative = you owe)
Difference:              ₹200  ⚠️ REVIEW
```

---

## How to Use This Data

### 1. Find a Specific Order
- Sort by "Shopify Order #" (Column B)
- Find order #3272
- Check "Match Method" (Column P) - if it says `no_match`, Shiprocket hasn't settled yet

### 2. Verify You Got Paid Correctly
- Check "Net Settlement" (Column G) matches your bank deposit
- Compare with "Shopify Order Total" (Column E)
- Difference (Column L) should make sense (shipping + COD fees)

### 3. Investigate a Missing Order
- Order #3272 not in this sheet?
- Check "Reconciliation" sheet instead
- Or check Shiprocket app to see if order was shipped

### 4. Dispute a Settlement Amount
- Use "AWB" (Column M) to track with courier
- Use "Batch ID" (Column O) to contact Shiprocket support
- Have ready: Order #, Customer Name, Date, Expected vs Actual amount

---

## Common Issues & Solutions

### "No Match" in Column P
**Problem**: Shiprocket data not showing up for order #3272
**Reasons**:
1. Order recently placed (Shiprocket needs 24-48 hours)
2. Order not yet delivered (settlement comes after delivery)
3. Order canceled before shipping
**Solution**: Wait 2-3 days and run reconciliation again

### High Difference in Column L
**Problem**: Difference of ₹500+ is unexpected
**Reasons**:
1. RTO (customer refused order) - check Column K
2. Weight overcharge - check Shiprocket app
3. Missing data - check "Shiprocket_Settlements" sheet
**Solution**: 
- Contact Shiprocket support with Batch ID (Column O)
- Reference AWB number (Column M) in your communication

### Negative Difference in Column L
**Problem**: Getting more than charged (rare)
**Reasons**:
1. Data entry error
2. Shiprocket credit from previous issue
**Solution**: Contact Shiprocket to verify

---

## Field Mapping Summary: Shopify → Shiprocket

```
Shopify Order                  Shiprocket Settlement
├─ Order #3272          ──→   channel_order_id: "3272"
├─ Order Date          ──→   remittance_date
├─ Customer Name       ──→   (customer info in Shiprocket)
├─ Order Total ₹1190   ──→   order_amount: 1190
│                            └─ Deductions:
│                               - shipping_charges: 100
│                               - cod_charges: 50
│                               - rto_reversal: 0
│                               - adjustments: 0
└─ You Receive ₹1040   ──→   net_settlement: 1040
```

---

## Technical Details for Your Reference

### How the Matching Works
1. System takes Shopify order name: `#3272`
2. Removes the `#`: `3272`
3. Searches Shiprocket data for matching `channel_order_id`
4. If found, extracts all settlement details
5. If not found, searches by internal order ID (fallback)

### Order of Deductions (in Shiprocket)
```
Order Amount (what customer paid)
- Shipping Charges (your cost)
- COD Charges (Shiprocket's fee for collection)
- RTO Reversal (if returned)
- Adjustments (other deductions/credits)
= Net Settlement (what hits your account)
```

### Settlement Timeline
```
Day 0: Customer places COD order on Shopify
Day 1: Shiprocket ships package
Day 2-4: Customer receives and pays Shiprocket
Day 5-7: Shiprocket processes payment (batches multiple orders)
Day 8-10: Settlement hits your bank account (from batch)
Day 11: Reconciliation data shows in Google Sheet
```

---

## Getting Help

When contacting Shiprocket support, provide:
1. Order # (Column B): `#3272`
2. Shiprocket Order ID (Column A): Full order ID
3. AWB / Tracking # (Column M): `SR1234567890`
4. Batch ID (Column O): Settlement batch reference
5. Expected vs Actual (Columns E vs G)
6. Screenshot of the Google Sheet row

---

## Summary

**Key Takeaway**: For COD orders, the Net Settlement (Column G) will always be less than the Shopify Total (Column E) because of shipping and collection fees. The Difference (Column L) should roughly equal your shipping cost + Shiprocket's COD fee (typically ₹100-200 depending on your rates).

Every Shopify COD order now has a corresponding row in the `COD_Orders_Settlement` sheet showing exactly what you received from Shiprocket and why the amount might differ from what the customer was charged.
