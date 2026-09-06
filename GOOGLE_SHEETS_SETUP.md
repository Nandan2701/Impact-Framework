# 🚀 Google Sheets & Instant Gmail Integration Guide

This guide explains how **Impact Framework** records user reviews, star ratings, and user task interactions directly into your **Google Sheet** with rich visitor telemetry and sends **instant Gmail notifications** for reviews to `nandanbhole72@gmail.com`.

---

## 🏗️ How It Works Behind The Scenes

### 1. User Reviews & Stars (Tab: `Reviews` or `Sheet1`)
- When a user submits a review or gives stars:
<<<<<<< HEAD
  - The review, star rating, anonymous User ID, and full visitor telemetry are appended to the sheet.
  - An **instant HTML email notification** is sent directly to `nandanbhole72@gmail.com` with review details and visitor analytics.
=======
  - The review, star rating, anonymous User ID, and complete visitor telemetry are appended to the sheet.
  - An **instant HTML email notification** is sent directly to `nandanbhole72@gmail.com` with review details, visitor analytics, network speed, and ISP.
>>>>>>> 5789269 (Add session duration, referral source, orientation, network speed, ISP, and country code columns)

### 2. User Tasks (Tab: `User Tasks`)
- Whenever a user adds a task (`Added`), checks it off (`Completed`), or deletes it (`Deleted`):
  - A row is appended with the task content, quadrant, action, anonymous User ID, and complete visitor telemetry.
  - **Silent Sync:** Tasks do **NOT** send email notifications so your 100/day email quota is never consumed!

---

<<<<<<< HEAD
## 📊 Complete Columns Captured in Both Sheets

Both sheets automatically track 18 detailed data points:

| # | Column Header | Description | Example |
|---|---|---|---|
| 1 | **Date & Time** | IST Timestamp | `9/7/2026, 2:45:00 AM` |
| 2 | **User ID** | Persistent anonymous user ID | `usr_9k3f2_0ab` |
| 3 | **Rating / Quadrant** | Star rating (Reviews) or Eisenhower quadrant (Tasks) | `5` or `High Impact, Easy (Do First)` |
| 4 | **Stars / Action** | `★★★★★` (Reviews) or `Added` / `Completed` / `Deleted` (Tasks) | `★★★★★` or `Completed` |
| 5 | **Review Description / Task Content** | User's feedback text or task title | `"Great productivity tool!"` |
| 6 | **Length** *(Reviews)* | Character count of the review | `26` |
| 7 | **City & State** | City and region from IP geolocation | `Nagpur, Maharashtra` |
| 8 | **Country** | Visitor country | `India` |
| 9 | **IP Address** | Public IP address | `117.205.13.254` |
| 10 | **Device** | Device form factor | `Mobile` / `Desktop` / `Tablet` |
| 11 | **Operating System** | OS name & version | `Windows 10/11`, `iOS 17.5`, `Android 14` |
| 12 | **Browser** | Browser name and major version | `Chrome 128`, `Safari 17`, `Firefox 130` |
| 13 | **Screen Resolution** | Display size and pixel ratio | `1920x1080 @1.25x`, `390x844 @3x` |
| 14 | **Timezone** | User's local timezone | `Asia/Kolkata` |
| 15 | **Language** | Browser primary language | `en-US`, `en-IN` |
| 16 | **Referrer** | Traffic source | `Direct`, `google.com`, `linkedin.com` |
| 17 | **Visit Count** | How many visits this user has made | `Visit #3` |
| 18 | **App Version** | Application release tag | `v1.2.0` |
=======
## 📊 Complete 24 Columns Captured in Both Sheets

Both sheets automatically track 24 detailed data points:

| # | Column Header | Value Captured | Example |
|---|---|---|---|
| **1** | `Date & Time` | IST timestamp formatted | `9/7/2026, 2:45:00 AM` |
| **2** | `User ID` | Persistent anonymous user ID | `usr_8x2k9_3ba` |
| **3** | `Rating / Quadrant` | 1–5 stars (Reviews) or Eisenhower quadrant (Tasks) | `5` or `High Impact, Easy (Do First)` |
| **4** | `Stars / Action` | `★★★★★` (Reviews) or `Added` / `Completed` / `Deleted` (Tasks) | `★★★★★` or `Completed` |
| **5** | `Review Description / Task Content` | Feedback text or task title | `"Great productivity matrix!"` |
| **6** | `Length` *(Reviews)* | Character count of the review | `32` |
| **7** | `City` | Geolocation city | `Nagpur` |
| **8** | `State / Region` | State or administrative region | `Maharashtra` |
| **9** | `Country` | Country name | `India` |
| **10** | `Country Code` | Two-letter ISO country code | `IN` |
| **11** | `ISP / Carrier` | Internet Service Provider / Mobile Carrier | `Bharat Sanchar Nigam Ltd`, `Jio`, `Airtel` |
| **12** | `IP Address` | Visitor's public IP address | `117.205.13.254` |
| **13** | `Device` | Device type | `Mobile`, `Desktop`, `Tablet` |
| **14** | `Operating System` | OS name & version | `Windows 10/11`, `iOS 17.5`, `Android 14` |
| **15** | `Browser` | Browser name and major version | `Chrome 128`, `Safari 17`, `Firefox 130` |
| **16** | `Screen Resolution` | Screen resolution & pixel ratio | `1920x1080 @1.25x`, `390x844 @3x` |
| **17** | `Screen Orientation` | Display orientation | `Portrait` or `Landscape` |
| **18** | `Network Speed` | Connection type, downlink & RTT | `4G • 10 Mbps • 50ms RTT` |
| **19** | `Session Duration` | Time spent on page before action | `42s`, `3m 15s` |
| **20** | `Timezone` | User's local timezone | `Asia/Kolkata` |
| **21** | `Language` | Primary browser language | `en-US`, `en-IN`, `hi` |
| **22** | `Referral Source` | Inbound traffic source | `Direct`, `google.com`, `linkedin.com` |
| **23** | `Visit Count` | How many visits this user has had | `Visit #1`, `Visit #3` |
| **24** | `App Version` | Application release tag | `v1.2.0` |
>>>>>>> 5789269 (Add session duration, referral source, orientation, network speed, ISP, and country code columns)

---

## ⏱️ Updating Your Google Apps Script Deployment

<<<<<<< HEAD
If you have already created your Web App, follow these steps to deploy the new version:
=======
To have your Google Sheet record all 24 columns:
>>>>>>> 5789269 (Add session duration, referral source, orientation, network speed, ISP, and country code columns)

1. Open your Google Sheet.
2. Click **Extensions** → **Apps Script**.
3. Replace all code in the script editor with the contents of [google-apps-script.js](file:///c:/Users/Acer/Desktop/Vibe-Coding-Guide/FocusMatrix/google-apps-script.js).
4. Click **Save** (💾).
5. At the top right, click **Deploy** → **Manage deployments**.
6. Click the **✏️ pencil icon** (Edit) on your active deployment.
7. Under **Version**, select **New version**.
8. Click **Deploy**.

> [!NOTE]
<<<<<<< HEAD
> When you update to a **New version**, your Web App URL remains the exact same! No change is required in `js/config.js`.
=======
> When you update to a **New version**, your Web App URL remains the exact same! No change is needed in `js/config.js`.
>>>>>>> 5789269 (Add session duration, referral source, orientation, network speed, ISP, and country code columns)
