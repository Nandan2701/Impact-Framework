# 🗺️ Impact Framework — Complete Project Journey & Changelog

A comprehensive, point-by-point chronological record of every feature, design decision, architecture choice, bug fix, and technical upgrade implemented from project inception to the current production release.

---

## 📌 Phase 1: Core Idea & Eisenhower Matrix Foundation

* **Concept & Problem Solved:**
  * Wanted a clean, zero-clutter decision matrix based on the Eisenhower Principle (Impact vs. Effort).
  * Avoided overly complicated task managers (Trello, Jira, Notion) in favor of a fast, distraction-free board.

* **Quadrant Design & Mental Model:**
  * **Q1: High Impact, Easy to Do** → Tag: `DO FIRST` (Emerald green accent) — Quick wins that deliver outsized results.
  * **Q2: High Impact, Hard to Do** → Tag: `SCHEDULE` (Cobalt blue accent) — Strategic priorities requiring dedicated time blocks.
  * **Q3: Low Impact, Easy to Do** → Tag: `DELEGATE` (Warm amber accent) — Busywork or routine chores to automate or hand off.
  * **Q4: Low Impact, Hard to Do** → Tag: `ELIMINATE` (Subtle rose accent) — Time sinks and low-value distractions to cut out.

* **"Docs Silk" Editorial Aesthetic:**
  * Crafted a warm, paper-like background (`#fafaf8`) instead of harsh pure white.
  * Fine 1px subtle divider lines (`#e5e3dc`) creating a 2x2 desktop grid.
  * Modern, readable typography with curated line-heights and letter-spacing.
  * Minimalist quadrant headers with uppercase badges.

* **Client-Side Storage Engine (0ms Latency):**
  * Stored all tasks in browser `localStorage` under key `focus_matrix_tasks`.
  * Pre-loaded helpful example tasks on first visit so new users instantly grasp the purpose of each quadrant.
  * Immediate synchronous reads and writes — the site opens in 0ms with zero loading spinners, no accounts, and no passwords.

---

## 📌 Phase 2: Task Interaction & Smooth Inline Editing

* **Inline Task Creation:**
  * Added `+ Add task...` inline input fields at the bottom of each quadrant.
  * Designed custom smooth blinking carets (`.smooth-caret`) for a tactile, responsive typing feel.
  * Pressing `Enter` adds the task instantly and clears the input without reloading the page.

* **Task Completion & Strikethrough UX:**
  * Custom checkbox design with SVG checkmark icons.
  * Checking off a task triggers an instantaneous strikethrough animation with subtle opacity reduction (`0.55`).
  * Checked status persists across page refreshes in `localStorage`.

* **1-Click Task Deletion:**
  * Added a discreet trash/delete button per task item that reveals cleanly on hover/focus.
  * Clicking delete immediately removes the item from the DOM and syncs the array in `localStorage`.

---

## 📌 Phase 3: Mobile Experience & Virtual Keyboard Optimization

* **Responsive Layout:**
  * Media queries (`@media (max-width: 768px)`) convert the 2x2 desktop grid into clean, full-width vertical stacked cards.
  * Optimized padding, font sizes, and touch targets to prevent accidental mis-taps on phones.

* **Virtual Keypad Management:**
  * Handled viewport height shifting when mobile keyboards appear on Android and iOS.
  * Added global `pointerdown` outside-click listener: tapping anywhere outside the active input or contact drawer automatically dismisses the mobile keypad (`active.blur()`).

---

## 📌 Phase 4: Contact Drawer & Interactive Review Modal

* **Slide-Over Contact Drawer:**
  * Added a sleek slide-over panel on the right side of the screen, triggered by the top-right **"Contact"** button.
  * Translucent scrim backdrop (`.drawer-overlay`) with backdrop blur and smooth slide-in physics.
  * Closes via close button (`×`), tapping the overlay backdrop, or pressing the `Escape` key.

* **Developer Identity & 1-Click Clipboard Copy:**
  * Displayed contact email: `nandanbhole72@gmail.com`.
  * Built a 1-click **"📋 Copy"** pill button:
    * Copies email to system clipboard using `navigator.clipboard.writeText()`.
    * Temporarily transforms button into green with text `Copied! ✓`.
    * Reverts back automatically after 1.8 seconds.
  * Displayed current application version (`v1.2.0`).

* **Interactive 5-Star Rating System:**
  * Modeled after the clean Google Play Store feedback UI: *"Rate this app — Tell others what you think"*.
  * 5 SVG star buttons with interactive hover and touch fill states.
  * Tapping any star or clicking the **"Write a review"** link triggers the review modal.

* **"Floating Focus Card" Modal Dialog:**
  * Elevated modal dialog with modal backdrop (`.focus-review-backdrop`).
  * Allows users to pick/change their star rating (1 to 5 stars).
  * Multi-line review textarea with live character counter (`0/500`).
  * Live visual warning when character count exceeds 450.
  * Optimized submit button with `pointerdown` and `click` listeners to prevent mobile keyboard blur from dropping taps.
  * Intentionally removed permanent `localStorage` rating lock so users can review repeatedly over time.

---

## 📌 Phase 5: Zero-Cost Backend (Google Sheets & Gmail Integration)

* **Architecture Decision:**
  * Rejected expensive database servers, monthly SaaS form tools, or Firebase auth setups.
  * Chose a direct **Google Apps Script Webhook** connected to a Google Spreadsheet in Google Drive.

* **Webhook Implementation (`google-apps-script.js`):**
  * `doPost(e)` receives JSON payloads sent via HTTP POST.
  * `doGet(e)` provides a health check status confirming the webhook is live.
  * Auto-creates the spreadsheet tab if it doesn't already exist.
  * Automatically formats row 1 headers with bold font, frozen row 1, and custom background colors.

* **Instant Gmail Alerts for Reviews:**
  * Automated email notifications sent to `nandanbhole72@gmail.com` on every review submission.
  * Formatted HTML email template featuring:
    * Star rating badge (e.g. `★★★★★ 5 out of 5`).
    * Full user review comment text.
    * Device, timestamp, and visitor telemetry overview.
  * Tested and confirmed daily quota safety: standard free Gmail accounts allow **100 emails/day** via `MailApp.sendEmail()`.

---

## 📌 Phase 6: Anonymous User Task Logging (Silent Mode)

* **Tracking User Task Actions:**
  * Wanted to see what kind of tasks people create, prioritize, and complete across the 4 quadrants.
  * Captured three discrete task actions:
    1. `Added` — Logged when user adds a task in any quadrant.
    2. `Completed` — Logged when user checks off a task.
    3. `Deleted` — Logged when user removes a task.

* **Persistent Anonymous User IDs:**
  * Needed to group tasks per user without requiring logins, passwords, or emails.
  * Built `getAnonymousUserId()`: Generates a persistent unique ID (`usr_` + random base36 + timestamp hash) saved in `localStorage`.
  * Allows analyzing user retention, session patterns, and task counts over time anonymously.

* **"User Tasks" Dedicated Sheet Tab:**
  * Created a second sheet tab in Google Sheets named **`User Tasks`**.
  * Logs: Date & Time, User ID, Quadrant Name, Action, Task Content, and Visitor Analytics.

* **Silent Mode (Quota Protection):**
  * **Critical constraint:** Tasks are logged completely silently — **NO emails are sent on task events**.
  * Ensures a user creating 20 tasks never consumes the 100/day email quota, reserving emails strictly for real user reviews.

---

## 📌 Phase 7: Mobile Beacon Drop Bug Fix

* **The Problem:**
  * Mobile Safari (iOS) and mobile Chrome were dropping background webhook calls made via `navigator.sendBeacon`.
  * Reason: `sendBeacon` silently fails or cancels requests when hitting cross-origin HTTP 302 redirects (which Google Apps Script uses internally).

* **The Solution:**
  * Replaced `sendBeacon` with standard `fetch()`:
    * `method: "POST"`
    * `mode: "no-cors"`
    * `headers: { "Content-Type": "text/plain;charset=utf-8" }`
  * Using `text/plain` bypasses CORS preflight (`OPTIONS`) requests, executing synchronously with zero drops across all mobile browsers.

---

## 📌 Phase 8: Full 24-Column Visitor Telemetry & Analytics Engine

* **Telemetry Requirements:**
  * Wanted deep visitor intelligence for **both** the `Reviews` sheet and the `User Tasks` sheet without slowing down the site.

* **Zero-Key IP Geolocation (`ipwho.is`):**
  * Integrated free, high-speed IP lookup via `https://ipwho.is/`.
  * Pre-fetched asynchronously on `DOMContentLoaded` and cached in `sessionStorage` (`impact_geo_data`).
  * **0ms Latency Guarantee:** Because geo data is cached in memory, adding, checking off, or deleting tasks happens with 0 delay.

* **Complete 24-Column Schema Across Both Sheets:**
  1. `Date & Time` — Formatted IST timestamp (`toLocaleString("en-US", { timeZone: "Asia/Kolkata" })`).
  2. `User ID` — Persistent anonymous identifier (`usr_...`).
  3. `Rating / Quadrant` — Star rating (Reviews) or Quadrant title (Tasks).
  4. `Stars / Action` — `★★★★★` symbol string (Reviews) or `Added`/`Completed`/`Deleted` (Tasks).
  5. `Review Description / Task Content` — Feedback text or task description.
  6. `Length` — Character count of review text.
  7. `City` — Visitor's detected city.
  8. `State / Region` — State or administrative region.
  9. `Country` — Full country name.
  10. `Country Code` — Two-letter ISO country code (e.g. `IN`, `US`).
  11. `ISP / Carrier` — Internet Service Provider / Mobile network operator (e.g. Jio, Airtel, BSNL).
  12. `IP Address` — Visitor's public IP address.
  13. `Device` — Device form factor (`Mobile`, `Desktop`, `Tablet`).
  14. `Operating System` — OS platform & version (`Windows 10/11`, `iOS 17.5`, `Android 14`, `macOS`).
  15. `Browser` — Browser name & major release (`Chrome 128`, `Safari 17`, `Firefox 130`, `Edge 128`).
  16. `Screen Resolution` — Viewport pixel resolution & device pixel ratio (`1920x1080 @1.25x`, `390x844 @3x`).
  17. `Screen Orientation` — Detected screen orientation (`Portrait` or `Landscape`).
  18. `Network Speed` — Connection type, downlink bandwidth, and latency (`4G • 10 Mbps • 50ms RTT`).
  19. `Session Duration` — Active time elapsed on page before action occurred (`45s`, `2m 15s`).
  20. `Timezone` — Local user timezone (`Asia/Kolkata`, `America/New_York`).
  21. `Language` — Primary browser language (`en-US`, `en-IN`, `hi`).
  22. `Referral Source` — Traffic origin (`Direct`, `google.com`, `linkedin.com`, `twitter.com`).
  23. `Visit Count` — Number of return visits by this user (`Visit #1`, `Visit #3`).
  24. `App Version` — Application release tag (`v1.2.0`).

* **Dynamic Header Upgrading (`ensureHeaders`):**
  * Added auto-migration logic in Apps Script: checks if row 1 has fewer columns than the 24-column specification and automatically upgrades row 1 headers with styling without overwriting user data.

---

## 📌 Phase 9: Vercel Cloud Deployment & Security Hardening

* **Git-Driven CI/CD:**
  * Linked GitHub repository `https://github.com/Nandan2701/Impact-Framework.git` (`main` branch) to Vercel.
  * Every `git push origin main` triggers an automatic global edge deployment in ~15 seconds.
  * Live URL: `https://impact-framework.vercel.app`.

* **Content Security Policy (CSP) & Header Security (`vercel.json`):**
  * Configured CSP `connect-src` to allow:
    * `'self'`
    * `https://script.google.com`
    * `https://script.googleusercontent.com`
    * `https://ipwho.is`
  * Set `Referrer-Policy: strict-origin-when-cross-origin` to preserve inbound traffic attribution.
  * Added `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`.

* **Native Vercel Web Analytics & Speed Insights:**
  * Added lightweight client tracking scripts to `index.html`:
    * `/_vercel/insights/script.js` (Web Analytics — tracks real-time unique visitors, views, referrers, countries).
    * `/_vercel/speed-insights/script.js` (Speed Insights — tracks Core Web Vitals and load speeds).
  * Zero-npm setup tailored for pure static HTML/CSS/JS applications.

---

## 📌 Phase 10: Codebase Sanitization & Conflict Resolution

* **Git Merge Conflict Resolution:**
  * Detected and resolved git merge conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`) that occurred during rapid branch updates.
  * Sanitized `google-apps-script.js`, `js/app.js`, `index.html`, and `GOOGLE_SHEETS_SETUP.md`.
  * Verified 0 errors / 0 syntax problems in VS Code.

---

## 📌 Phase 11: Custom Visual Assets & Optical Alignment

* **Custom Email Logo Integration:**
  * Retrieved user's custom envelope icon from `D:\Downloads\gmail logo.jpg`.
  * Automated copying directly into project assets via PowerShell.

* **Whitespace Removal & Aspect Ratio Balancing:**
  * Analyzed source image: original 659×360px JPG contained over 42% empty white margins, making the envelope appear miniature (~12px) in the UI.
  * Automated image cropping: trimmed empty margins down to the exact 389×278px envelope bounding box.
  * Converted to a transparent PNG (`gmail-logo.png`).
  * Balanced optical scale in `style.css`: set `.info-icon-img` to `21px × 16px` with `margin-top: 3px`, matching the visual weight and alignment of the adjacent 20px circle "Latest Version" icon.

---

## 📌 Phase 12: Device Sync Prototype & Clean Rollback

* **The Requirement & Exploration:**
  * Explored zero-login cross-device task sync via 6-digit pairing codes and real-time streaming.
  * Tested multi-device synchronization using Google Apps Script and Server-Sent Events.
* **Decision & Rollback:**
  * To ensure 100% rock-solid stability and prevent edge cases with cleared caches or deleted sheet tabs, the feature was cleanly removed from the UI and codebase.
  * Restored the clean, fast, zero-dependency baseline. Cross-device sync will be revisited in a future dedicated milestone.
  * Ensured the core app always auto-loads 2 high-value sample tasks per quadrant for first-time visitors.

---

## 🏁 Current Project Architecture Overview

```
Impact-Framework/
├── index.html               # Main application layout, contact drawer, and review modal
├── style.css                # Docs Silk design system, responsive grid, and animations
├── js/
│   ├── app.js               # Matrix state, 24-column telemetry engine, and touch handlers
│   └── config.js            # Google Apps Script Webhook URL configuration
├── google-apps-script.js    # 24-Column Google Sheets & instant Gmail webhook script
├── gmail-logo.png           # Cropped transparent custom email icon
├── matrix-image.png         # Quadrant preview graphic
├── vercel.json              # Edge routing, security headers, and CSP whitelist
├── GOOGLE_SHEETS_SETUP.md   # Deployment walkthrough for Google Sheets backend
├── JOURNEY.md               # Complete chronological changelog and build documentation
└── README.md                # Project overview and introduction
```
