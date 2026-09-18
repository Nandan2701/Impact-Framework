# 🚀 Google Sheets & Multi-Device Sync Guide

This guide explains how **Impact Framework** records user accounts, cross-device task sync, user reviews, star ratings, and user task interactions directly into your **Google Sheet** with rich visitor telemetry and sends **instant Gmail notifications** for reviews to `nandanbhole72@gmail.com`.

---

## 🏗️ How It Works Behind The Scenes

### 1. User Accounts & Multi-Device Sync (Tab: `Accounts`)
- Users can create an account with a **Username** and **Password** from the Contact drawer.
- Passwords are securely hashed with **SHA-256 + project salt** before saving.
- The latest 4-quadrant tasks matrix is stored as JSON with an ISO timestamp.
- Signing in on any other device (Device 2) automatically fetches the latest matrix.
- When any device updates tasks, changes are automatically pushed to the sheet and synced across all signed-in devices.
- **Silent Sync:** Account authentication and task sync do **NOT** send email notifications so your 100/day email quota is never consumed!

### 2. User Reviews & Stars (Tab: `Reviews` or `Sheet1`)
- When a user submits a review or gives stars:
  - The review, star rating, anonymous User ID, and complete visitor telemetry are appended to the sheet.
  - An **instant HTML email notification** is sent directly to `nandanbhole72@gmail.com` with review details, visitor analytics, network speed, and ISP.

### 3. User Tasks (Tab: `User Tasks`)
- Whenever a user adds a task (`Added`), checks it off (`Completed`), or deletes it (`Deleted`):
  - A row is appended with the task content, quadrant, action, anonymous User ID, and complete visitor telemetry.
  - **Silent Sync:** Tasks do **NOT** send email notifications.

---

## 📊 Accounts Sheet Columns (Tab: `Accounts`)

| # | Column Header | Value Captured | Purpose |
|---|---|---|---|
| **1** | `Username` | Unique user handle (lowercase matching) | Account lookup |
| **2** | `Password Hash` | SHA-256 hashed password with salt | Secure verification |
| **3** | `Tasks JSON` | Complete 4-quadrant task data string | Cross-device restoration |
| **4** | `Last Updated` | ISO timestamp of newest task change | Sync version comparison |
| **5** | `Created At` | ISO timestamp of account registration | Account age tracking |
| **6** | `Last Device` | Form factor & OS (e.g. `Desktop (Windows 10/11)`) | Active device audit |
| **7** | `Auth Token` | Random unique session token | Authenticated sync push/pull |

---

## ⏱️ Deploying / Updating Your Google Apps Script

To enable the new `Accounts` tab and multi-device synchronization:

1. Open your Google Sheet.
2. Click **Extensions** → **Apps Script**.
3. Replace all code in the script editor with the contents of [google-apps-script.js](file:///c:/Users/Acer/Desktop/Vibe-Coding-Guide/Focus-Matrix/google-apps-script.js).
4. Click **Save** (💾).
5. At the top right, click **Deploy** → **Manage deployments**.
6. Click the **✏️ pencil icon** (Edit) on your active deployment.
7. Under **Version**, select **New version**.
8. Click **Deploy**.

> [!NOTE]
> When you update to a **New version**, your Web App URL remains the exact same! No change is needed in `js/config.js`. If creating a brand new deployment, copy the Web App URL and paste it into `js/config.js`.
