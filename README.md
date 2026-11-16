# DeniBook — Tap-First Credit & Debt Ledger

DeniBook is a fast, mobile-first web application built for shop owners and vendors to track customer credit (*deni*), split shared purchases across multiple buyers in seconds, record cash/mobile payments, and send pre-filled WhatsApp payment reminders with one tap.

---

## Table of Contents
1. [Getting Started (Shop Owner Setup)](#1-getting-started-shop-owner-setup)
2. [Daily User Manual](#2-daily-user-manual)
   - [Adding Customers](#adding-customers)
   - [Recording a Single-Customer Credit Sale](#recording-a-single-customer-credit-sale)
   - [Splitting a Sale Across Multiple Customers](#splitting-a-sale-across-multiple-customers)
   - [Recording a Payment (Partial or Full)](#recording-a-payment-partial-or-full)
   - [Sending a One-Tap WhatsApp Reminder](#sending-a-one-tap-whatsapp-reminder)
   - [Fixing a Mistake (Voiding an Entry)](#fixing-a-mistake-voiding-an-entry)
   - [Managing Items & Prices](#managing-items--prices)
3. [Installing as a Mobile App (PWA)](#3-installing-as-a-mobile-app-pwa)
4. [Frequently Asked Questions (FAQs)](#4-frequently-asked-questions-faqs)
5. [Developer Deployment & Architecture](#5-developer-deployment--architecture)

---

## 1. Getting Started (Shop Owner Setup)

1. **Create Your Account:** Open the app link and switch to **Sign Up**. Enter your **Shop / Business Name**, **Email**, and **Password**.
2. **Automatic Workspace Provisioning:** Your private ledger is isolated to your login. By default, your catalog is pre-loaded with **Fert @ 50** (editable anytime in Settings).
3. **Multi-Device Access:** You can log in with the same email and password from your phone, tablet, or laptop—all customers, balances, and timestamps sync automatically via the cloud.

---

## 2. Daily User Manual

### Adding Customers
1. Tap **+ Add Client** at the top of the home screen.
2. Enter the customer's **Name** and **WhatsApp Phone Number** (e.g., `0712345678` or `+254712345678`—the app formats country codes automatically).
3. Tap **Save**. The customer immediately appears on your main tap grid.

### Recording a Single-Customer Credit Sale
*Example: Client X takes 2 Ferts @ 50 each (Total: 100).*
1. Tap **Client X's** card once to highlight them.
2. On the bottom action bar, tap **Fert (+1)** twice (`2x`).
3. Verify the total (`100`) and tap **Save Debt**.
4. Client X's balance increases by `100` with the exact date and time logged.

### Splitting a Sale Across Multiple Customers
*Example: Client X and Client Y share 3 Ferts @ 50 each (Total: 150 → 75 each).*
1. Tap **Client X's** card, then tap **Client Y's** card. **Split Mode** activates automatically and displays the number of selected buyers.
2. Tap **Fert (+1)** three times (`3x`). The live preview displays: `Total: 150 → 75 each`.
3. Tap **Save Debt**.
4. Both Client X and Client Y have `75` added to their respective ledgers with a note indicating a 2-way split.

### Recording a Payment (Partial or Full)
1. Open the customer's profile by tapping their profile/details icon.
2. Tap **Record Payment**.
3. Choose a quick preset (**Full Balance**, **Half**, `50`, `100`, `200`, `500`) or type a custom amount.
4. Tap **Save Payment**. Their outstanding balance updates immediately, and the payment is recorded in their history.

### Sending a One-Tap WhatsApp Reminder
1. Open the customer's profile (or tap the **Bell / Notify** icon on their card).
2. Tap **Notify on WhatsApp**.
3. DeniBook automatically calculates their current total owed and latest debt date, generates a polite reminder script, and opens WhatsApp directly to their chat with the message pre-filled.
4. Press **Send** inside WhatsApp.

### Fixing a Mistake (Voiding an Entry)
1. Open the customer's profile and scroll to their **Transaction History**.
2. Locate the erroneous entry and tap **Void / Delete**, then confirm.
3. The entry is removed and the customer's total balance recalculates automatically.

### Managing Items & Prices
1. Open **Settings** (gear icon).
2. Under **Products & Pricing**, edit the price of **Fert** or add new items you sell on credit.
3. Customize your default **WhatsApp Reminder Message** template and **Currency** code.

---

## 3. Installing as a Mobile App (PWA)

For the fastest one-thumb experience at the counter:
* **Android (Chrome / Brave):** Tap the **⋮ (three dots)** menu → **Add to Home screen** / **Install app**.
* **iPhone (Safari):** Tap the **Share** icon → **Add to Home Screen**.

---

## 4. Frequently Asked Questions (FAQs)

**Q: If I log out or switch phones, will I lose my customers' debt records?**  
**A:** No. All customers, balances, and transaction timestamps are saved securely in the cloud database under your account. Log in on any device with your email and password to access your full ledger.

**Q: Can another shop owner using the same website see my customers?**  
**A:** No. Every account is protected by database-level Row Level Security (RLS). Your login can only read and modify records belonging to your user ID.

**Q: What happens if a split sale doesn't divide evenly (e.g., 100 split 3 ways)?**  
**A:** DeniBook rounds cleanly to 2 decimal places (`33.33` each) and shows the exact per-person breakdown on the confirmation bar before you save.

**Q: Why didn't WhatsApp open when I clicked Notify?**  
**A:** Check that the customer's phone number is saved with valid digits (e.g., `07XXXXXXXX` or `2547XXXXXXXX`) and that WhatsApp is installed on your device (or WhatsApp Web is active on desktop).

**Q: Can I back up my debt book to Excel?**  
**A:** Yes. Go to **Settings → Export CSV** to download a spreadsheet of all customers, balances, and transaction logs anytime.

