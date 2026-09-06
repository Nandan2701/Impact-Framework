# 🚀 Google Sheets & Instant Gmail Integration Guide

This guide shows you how to connect your **Impact Framework** user reviews directly to a **Google Sheet** in your Google Drive and receive **instant Gmail notifications** at `nandanbhole72@gmail.com`.

---

## 🏗️ How It Works Behind The Scenes

1. A user rates your app (e.g. 5 stars) and writes a review.
2. When they tap **"Post"**:
   - The app immediately shows: `Thank you. Your 5-star review was posted.`
   - In the background, it securely calls your **Google Apps Script Webhook**.
3. **Google Apps Script automatically does two things**:
   - 📊 **Appends a new row** to your Google Sheet with date, stars, review, and device.
   - 📧 **Sends an instant formatted email** to `nandanbhole72@gmail.com`.

---

## ⏱️ 3-Minute Setup Walkthrough

### Step 1: Create a Google Sheet
1. Open [sheets.new](https://sheets.new) in your browser.
2. Title the spreadsheet: **`Impact Framework Reviews`**.

---

### Step 2: Paste the Google Apps Script
1. In your Google Sheet, click the top menu: **Extensions** → **Apps Script**.
2. Delete any code in the editor (`myFunction() { ... }`).
3. Open the file [google-apps-script.js](file:///c:/Users/Acer/Desktop/Vibe-Coding-Guide/FocusMatrix/google-apps-script.js) from this folder, copy all its content, and paste it into the editor.
4. Click the **💾 Save** icon (or press `Ctrl + S`).

---

### Step 3: Deploy as a Web App
1. At the top right of the Apps Script page, click the blue **Deploy** button → **New deployment**.
2. Next to "Select type", click the **⚙️ gear icon** and choose **Web app**.
3. Fill in the fields:
   - **Description**: `Impact Framework Review Webhook`
   - **Execute as**: `Me (nandanbhole72@gmail.com)`
   - **Who has access**: `Anyone` *(Important: This allows visitors on your site to submit reviews without needing to sign in)*.
4. Click **Deploy**.
5. If Google asks to "Authorize Access":
   - Click **Authorize access** → Choose your Google account.
   - Click **Advanced** (at the bottom left of the modal).
   - Click **Go to Impact Framework Review Webhook (unsafe)**.
   - Click **Allow**.
6. Copy the generated **Web app URL** (starts with `https://script.google.com/macros/s/.../exec`).

---

### Step 4: Paste URL in `js/config.js`
1. Open [js/config.js](file:///c:/Users/Acer/Desktop/Vibe-Coding-Guide/FocusMatrix/js/config.js).
2. Paste your Web App URL between the quotes:
   ```javascript
   window.IMPACT_CONFIG = {
     googleWebhookUrl: "https://script.google.com/macros/s/AKfycb.../exec"
   };
   ```
3. Save and deploy! That's it!

---

## 📱 What You Will See When a User Reviews

### 1. In Your Google Sheet
| Date & Time | Rating (1-5) | Stars | Review Description | Length | Device | App Version |
|---|---|---|---|---|---|---|
| 07 Sep 2026, 00:30 | 5 | ★★★★★ | "Cleanest matrix layout I've used. Docs Silk is super smooth!" | 63 | Mobile | v1.2.0 |

### 2. In Your Gmail Inbox (`nandanbhole72@gmail.com`)
* **Subject:** `⭐ New 5-Star Review for Impact Framework`
* **Content:** Beautiful card showing:
  - Rating: ★★★★★ (5 out of 5)
  - Review text
  - Device type & timestamp
