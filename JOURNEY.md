# 🗺️ Impact Framework — Project Journey & Build Log

This document records everything we built, improved, and evolved from the very beginning.

---

### Step 1: The Core Foundation (Eisenhower Matrix)
* **What we wanted:** A fast, distraction-free productivity matrix based on the Eisenhower model.
* **4 Quadrants built:**
  * **Q1:** High Impact, Easy to Do (*Do First*)
  * **Q2:** High Impact, Hard to Do (*Schedule*)
  * **Q3:** Low Impact, Easy to Do (*Delegate*)
  * **Q4:** Low Impact, Hard to Do (*Eliminate*)
* **Design & Feel:** Clean "Docs Silk" aesthetic — minimal lines, warm paper tone, custom blinking carets, strike-through task completion, and 1-click delete.
* **Instant speed:** 100% client-side storage using `localStorage` — loads in 0ms with zero login or password friction.

---

### Step 2: Mobile & Touch Optimizations
* Made the 2x2 desktop grid collapse into smooth, swipeable vertical cards on mobile phones.
* Fixed mobile keyboard issues: tapping outside an input or pressing Enter automatically dismisses the on-screen keypad.
* Added smooth slide-over animations for side panels.

---

### Step 3: Contact Drawer & Interactive Review System
* Added the **Contact** slide-over drawer from the top-right button.
* Added developer contact email with a **1-Click "📋 Copy" button**.
* Built an interactive **5-star rating bar** + **"Write a review"** trigger.
* Created the **"Floating Focus Card" review modal** with:
  * 1 to 5 clickable stars.
  * Review textarea with live character counter (up to 500 characters).
  * Fast submission handling optimized for touch (`pointerdown`) so mobile virtual keyboard blurs don't cancel button taps.

---

### Step 4: Connecting Google Sheets & Instant Gmail Alerts
* Connected user reviews to Google Drive without expensive backend servers or third-party paid tools.
* Created a custom **Google Apps Script Webhook** (`google-apps-script.js`).
* Setup an instant HTML email alert to `nandanbhole72@gmail.com` whenever a user submits a review or rates stars.
* Verified email limits (Gmail free accounts get 100 email notifications/day).

---

### Step 5: Anonymous User Task Logging (Silent Mode)
* Decided to track what tasks users create, complete, or delete so we can learn how people use the matrix.
* Created persistent anonymous User IDs (`usr_...` stored in `localStorage`) to recognize returning users without forcing signups.
* Added a dedicated **"User Tasks"** sheet tab in Google Sheets.
* Tracked actions:
  * `Added` (when user adds a new task)
  * `Completed` (when user ticks a checkbox)
  * `Deleted` (when user deletes a task)
* **Silent Mode:** Engineered task logging to **never send emails**, saving all 100 daily email quotas strictly for real user reviews.

---

### Step 6: Full 24-Column Visitor Telemetry & Analytics
* Decided to capture rich visitor insights across **both** sheets (`Reviews` and `User Tasks`).
* Setup zero-key geolocation via `ipwho.is` with background prefetching and `sessionStorage` caching (0ms delay on task clicks).
* Expanded both sheets to record **24 dedicated columns**:
  1. `Date & Time` (IST)
  2. `User ID` (`usr_...`)
  3. `Rating / Quadrant`
  4. `Stars / Action`
  5. `Review Description / Task Content`
  6. `Length`
  7. `City`
  8. `State / Region`
  9. `Country`
  10. `Country Code`
  11. `ISP / Carrier` (e.g. Jio, Airtel, BSNL)
  12. `IP Address`
  13. `Device` (Mobile, Desktop, Tablet)
  14. `Operating System` (Windows, iOS, Android, macOS)
  15. `Browser` & version
  16. `Screen Resolution` & pixel ratio
  17. `Screen Orientation` (Portrait / Landscape)
  18. `Network Speed` (4G, downlink speed, latency)
  19. `Session Duration` (active time on site: e.g. `45s`, `3m 15s`)
  20. `Timezone`
  21. `Language`
  22. `Referral Source` (Direct, Google, Twitter, LinkedIn)
  23. `Visit Count` (`Visit #1`, `Visit #3`)
  24. `App Version` (`v1.2.0`)
* Updated the Google Apps Script to auto-detect and update headers safely.

---

### Step 7: Vercel Cloud Deployment & Security
* Connected the GitHub repository (`Nandan2701/Impact-Framework`) to Vercel for automatic global edge deployments.
* Live production URL: `https://impact-framework.vercel.app`.
* Updated `vercel.json` with strict Content Security Policy (CSP) to allow Google Apps Script and Geolocation endpoints.
* Added native Vercel Web Analytics & Speed Insights for real-time visitor traffic and performance monitoring.

---

### Step 8: Code Cleanups & Custom Visuals
* Cleaned up Git merge conflict markers across the codebase to ensure 0 syntax errors in Google Apps Script.
* Replaced the generic SVG mail icon with the custom envelope logo (`gmail-logo.png`).
* Cropped outer white padding from the logo and optically balanced its size (`21px × 16px`) and alignment to match the adjacent 20px circle icon.

---

### 🏁 Current State
* **Website:** Fast, responsive, and deployed live on Vercel.
* **Backend:** Automated Google Sheets integration with full 24-column telemetry and instant Gmail notifications for reviews.
* **Codebase:** Clean, version-controlled on GitHub `main` branch.
