/**
 * ==============================================================================
 * Impact Framework — Multi-Device Account Sync, Google Sheets & Gmail Webhook
 * ==============================================================================
 * This script handles THREE categories of data with full visitor telemetry:
 *   1. User Accounts & Cross-Device Sync:
 *      - Register account with username + password (SHA-256 hashed).
 *      - Sign in from any device to load matrix tasks.
 *      - Bi-directional sync: pushes task changes and pulls latest tasks.
 *      - Stores data in dedicated "Accounts" tab.
 *
 *   2. User Reviews (type = "review"):
 *      - Appends to "Reviews" sheet with full visitor telemetry.
 *      - Sends instant formatted HTML email alert to nandanbhole72@gmail.com.
 *
 *   3. User Tasks (type = "task"):
 *      - Appends to "User Tasks" sheet (Date, User ID, Quadrant, Action, Task).
 *      - SILENT LOG: Does NOT send an email to preserve 100/day email quota.
 * ==============================================================================
 */

function testRun() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("✓ Successfully connected to spreadsheet: " + ss.getName());
  Logger.log("✓ Remaining daily email quota: " + MailApp.getRemainingDailyQuota());
  return "Permissions granted successfully!";
}

/**
 * One-Click Migration Tool:
 * Reconstructs all tasks from the "User Tasks" sheet for a specific User ID (e.g. usr_r5nmtq4s)
 * and updates the "Accounts" sheet Tasks JSON for the specified account (e.g. nandanbhole).
 */
function migrateUserTasksToAccount(targetUserId, targetUsername) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  targetUserId = targetUserId || "usr_r5nmtq4s";
  targetUsername = (targetUsername || "nandanbhole").toLowerCase().trim();

  var taskSheet = ss.getSheetByName("User Tasks");
  if (!taskSheet) {
    Logger.log("Error: 'User Tasks' sheet not found.");
    return { status: "error", message: "'User Tasks' sheet not found." };
  }

  var accountSheet = getAccountSheet(ss);
  var userEntry = findUserRow(accountSheet, targetUsername);
  if (!userEntry) {
    Logger.log("Error: Account '" + targetUsername + "' not found in Accounts tab.");
    return { status: "error", message: "Account '" + targetUsername + "' not found." };
  }

  var data = taskSheet.getDataRange().getValues();
  var quadrants = {
    q1: [],
    q2: [],
    q3: [],
    q4: []
  };

  function normalizeQuadrantKey(raw) {
    var str = (raw || "").toString().toLowerCase();
    if (str.indexOf("q1") !== -1 || (str.indexOf("high") !== -1 && str.indexOf("easy") !== -1)) return "q1";
    if (str.indexOf("q2") !== -1 || (str.indexOf("high") !== -1 && str.indexOf("hard") !== -1)) return "q2";
    if (str.indexOf("q3") !== -1 || (str.indexOf("low") !== -1 && str.indexOf("easy") !== -1)) return "q3";
    if (str.indexOf("q4") !== -1 || (str.indexOf("low") !== -1 && str.indexOf("hard") !== -1)) return "q4";
    return "q1";
  }

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var uid = (row[1] || "").toString().trim();
    if (uid !== targetUserId) continue;

    var quadKey = normalizeQuadrantKey(row[2]);
    var action = (row[3] || "").toString().trim().toLowerCase();
    var taskText = (row[4] || "").toString().trim();
    if (!taskText) continue;

    var list = quadrants[quadKey];
    var existingIndex = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].text === taskText) {
        existingIndex = i;
        break;
      }
    }

    if (action === "added" || action === "add") {
      if (existingIndex === -1) {
        list.push({
          id: "t_" + Utilities.getUuid().replace(/-/g, "").substring(0, 8),
          text: taskText,
          done: false
        });
      }
    } else if (action === "completed" || action === "complete") {
      if (existingIndex !== -1) {
        list[existingIndex].done = true;
      } else {
        list.push({
          id: "t_" + Utilities.getUuid().replace(/-/g, "").substring(0, 8),
          text: taskText,
          done: true
        });
      }
    } else if (action === "uncompleted" || action === "uncomplete") {
      if (existingIndex !== -1) {
        list[existingIndex].done = false;
      }
    } else if (action === "deleted" || action === "delete") {
      if (existingIndex !== -1) {
        list.splice(existingIndex, 1);
      }
    }
  }

  var nowIso = new Date().toISOString();
  var tasksJson = JSON.stringify(quadrants);

  // Column 3 = Tasks JSON, Column 4 = Last Updated
  accountSheet.getRange(userEntry.rowIndex, 3).setValue(tasksJson);
  accountSheet.getRange(userEntry.rowIndex, 4).setValue(nowIso);

  Logger.log("✓ Successfully migrated tasks for " + targetUserId + " to account " + targetUsername + "!");
  Logger.log("Reconstructed Tasks: " + tasksJson);
  return { status: "success", username: targetUsername, tasks: quadrants, updatedAt: nowIso };
}

var SALT = "_impact_framework_salt_v1_";

var ACCOUNT_HEADERS = [
  "Username",
  "Password Hash",
  "Tasks JSON",
  "Last Updated",
  "Created At",
  "Last Device",
  "Auth Token"
];

var REVIEW_HEADERS = [
  "Date & Time",
  "User ID",
  "Rating (1-5)",
  "Stars",
  "Review Description",
  "Length",
  "City",
  "State / Region",
  "Country",
  "Country Code",
  "ISP / Carrier",
  "IP Address",
  "Device",
  "Operating System",
  "Browser",
  "Screen Resolution",
  "Screen Orientation",
  "Network Speed",
  "Session Duration",
  "Timezone",
  "Language",
  "Referral Source",
  "Visit Count",
  "App Version"
];

var TASK_HEADERS = [
  "Date & Time",
  "User ID",
  "Quadrant",
  "Action",
  "Task Content",
  "City",
  "State / Region",
  "Country",
  "Country Code",
  "ISP / Carrier",
  "IP Address",
  "Device",
  "Operating System",
  "Browser",
  "Screen Resolution",
  "Screen Orientation",
  "Network Speed",
  "Session Duration",
  "Timezone",
  "Language",
  "Referral Source",
  "Visit Count",
  "App Version"
];

function hashPassword(password) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    (password || "") + SALT,
    Utilities.Charset.UTF_8
  );
  var out = "";
  for (var i = 0; i < raw.length; i++) {
    var byteVal = raw[i];
    if (byteVal < 0) byteVal += 256;
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = "0" + byteHex;
    out += byteHex;
  }
  return out;
}

function ensureHeaders(sheet, headers, headerBg, headerColor) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setFontWeight("bold");
    range.setBackground(headerBg);
    range.setFontColor(headerColor);
    sheet.setFrozenRows(1);
  } else {
    var currentCols = sheet.getLastColumn();
    if (currentCols < headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      var r = sheet.getRange(1, 1, 1, headers.length);
      r.setFontWeight("bold");
      r.setBackground(headerBg);
      r.setFontColor(headerColor);
      sheet.setFrozenRows(1);
    }
  }
}

function getAccountSheet(ss) {
  var sheet = ss.getSheetByName("Accounts");
  if (!sheet) {
    sheet = ss.insertSheet("Accounts");
  }
  ensureHeaders(sheet, ACCOUNT_HEADERS, "#fce8e6", "#c5221f");
  return sheet;
}

function findUserRow(sheet, username) {
  var data = sheet.getDataRange().getValues();
  var target = (username || "").toString().trim().toLowerCase();
  for (var r = 1; r < data.length; r++) {
    var u = (data[r][0] || "").toString().trim().toLowerCase();
    if (u === target) {
      return { rowIndex: r + 1, rowData: data[r] };
    }
  }
  return null;
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==============================================================================
// MAIN REQUEST HANDLER (Supports both POST and GET)
// ==============================================================================
function processRequest(data) {
  var now = new Date();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var type = (data.type || data.action || "").toString();

  // ----------------------------------------------------------------------------
  // AUTH: REGISTER ACCOUNT
  // ----------------------------------------------------------------------------
  if (type === "auth_register" || type === "register") {
    var username = (data.username || "").toString().trim();
    var password = (data.password || "").toString();

    if (!username || username.length < 3) {
      return jsonOutput({ status: "error", message: "Username must be at least 3 characters." });
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(username)) {
      return jsonOutput({ status: "error", message: "Username can only contain letters, numbers, hyphens, and underscores." });
    }
    if (!password || password.length < 4) {
      return jsonOutput({ status: "error", message: "Password must be at least 4 characters long." });
    }

    var accountSheet = getAccountSheet(ss);
    var existing = findUserRow(accountSheet, username);
    if (existing) {
      return jsonOutput({ status: "error", message: "Username '" + username + "' is already taken. Please choose another or sign in." });
    }

    var pwdHash = hashPassword(password);
    var token = "tok_" + Utilities.getUuid().replace(/-/g, "");
    var tasks = data.tasks || { q1: [], q2: [], q3: [], q4: [] };
    var tasksJson = typeof tasks === "string" ? tasks : JSON.stringify(tasks);
    var device = data.device || (data.isMobile ? "Mobile" : "Desktop");
    var os = data.os || "Unknown";
    var deviceInfo = device + " (" + os + ")";
    var timestamp = now.toISOString();

    accountSheet.appendRow([
      username,
      pwdHash,
      tasksJson,
      timestamp,
      timestamp,
      deviceInfo,
      token
    ]);

    return jsonOutput({
      status: "success",
      action: "register",
      username: username,
      token: token,
      tasks: typeof tasks === "string" ? JSON.parse(tasks) : tasks,
      updatedAt: timestamp
    });
  }

  // ----------------------------------------------------------------------------
  // AUTH: SIGN IN / LOGIN
  // ----------------------------------------------------------------------------
  if (type === "auth_login" || type === "login") {
    var loginUser = (data.username || "").toString().trim();
    var loginPass = (data.password || "").toString();

    if (!loginUser || !loginPass) {
      return jsonOutput({ status: "error", message: "Please provide both username and password." });
    }

    var accountSheet = getAccountSheet(ss);
    var userEntry = findUserRow(accountSheet, loginUser);
    if (!userEntry) {
      return jsonOutput({ status: "error", message: "Account '" + loginUser + "' not found. Check spelling or create an account." });
    }

    var storedHash = userEntry.rowData[1];
    var computedHash = hashPassword(loginPass);
    if (storedHash && storedHash !== computedHash) {
      return jsonOutput({ status: "error", message: "Incorrect password. Please try again." });
    }
    // Auto-bind password if row was created via sync_push
    if (!storedHash) {
      accountSheet.getRange(userEntry.rowIndex, 2).setValue(computedHash);
    }

    var storedTasksJson = userEntry.rowData[2] || '{"q1":[],"q2":[],"q3":[],"q4":[]}';
    var parsedTasks;
    try {
      parsedTasks = JSON.parse(storedTasksJson);
    } catch (e) {
      parsedTasks = { q1: [], q2: [], q3: [], q4: [] };
    }

    var storedUpdatedAt = userEntry.rowData[3] || now.toISOString();
    var storedToken = userEntry.rowData[6] || ("tok_" + Utilities.getUuid().replace(/-/g, ""));
    if (!userEntry.rowData[6]) {
      accountSheet.getRange(userEntry.rowIndex, 7).setValue(storedToken);
    }

    // Update last device info if provided
    var device = data.device || (data.isMobile ? "Mobile" : "Desktop");
    var os = data.os || "Unknown";
    accountSheet.getRange(userEntry.rowIndex, 6).setValue(device + " (" + os + ")");

    return jsonOutput({
      status: "success",
      action: "login",
      username: loginUser,
      token: storedToken,
      tasks: parsedTasks,
      updatedAt: storedUpdatedAt
    });
  }

  // ----------------------------------------------------------------------------
  // SYNC: PUSH LOCAL CHANGES TO CLOUD
  // ----------------------------------------------------------------------------
  if (type === "sync_push" || type === "push") {
    var syncUser = (data.username || "").toString().trim();
    var token = (data.token || "").toString();

    if (!syncUser) {
      return jsonOutput({ status: "error", message: "Missing username for sync." });
    }

    var accountSheet = getAccountSheet(ss);
    var userEntry = findUserRow(accountSheet, syncUser);
    if (!userEntry) {
      // Auto-upsert account if not registered yet so active tasks are never lost!
      var initTasks = data.tasks || { q1: [], q2: [], q3: [], q4: [] };
      var initTasksJson = typeof initTasks === "string" ? initTasks : JSON.stringify(initTasks);
      var initTimestamp = now.toISOString();
      accountSheet.appendRow([
        syncUser,
        "",
        initTasksJson,
        initTimestamp,
        initTimestamp,
        (data.device || "Device") + " (" + (data.os || "OS") + ")",
        token || ("tok_" + Utilities.getUuid().replace(/-/g, ""))
      ]);
      return jsonOutput({
        status: "success",
        action: "push",
        updatedAt: initTimestamp
      });
    }

    var tasks = data.tasks || { q1: [], q2: [], q3: [], q4: [] };
    var tasksJson = typeof tasks === "string" ? tasks : JSON.stringify(tasks);
    var timestamp = now.toISOString();

    // Column 3 = Tasks JSON, Column 4 = Last Updated, Column 6 = Last Device, Column 7 = Token
    accountSheet.getRange(userEntry.rowIndex, 3).setValue(tasksJson);
    accountSheet.getRange(userEntry.rowIndex, 4).setValue(timestamp);
    if (data.device) {
      accountSheet.getRange(userEntry.rowIndex, 6).setValue(data.device + " (" + (data.os || "OS") + ")");
    }
    if (token) {
      accountSheet.getRange(userEntry.rowIndex, 7).setValue(token);
    }

    return jsonOutput({
      status: "success",
      action: "push",
      updatedAt: timestamp
    });
  }

  // ----------------------------------------------------------------------------
  // SYNC: PULL CLOUD CHANGES
  // ----------------------------------------------------------------------------
  if (type === "sync_pull" || type === "pull") {
    var syncUser = (data.username || "").toString().trim();
    var clientUpdatedAt = data.lastSyncedAt || "";
    var force = data.force === true || !clientUpdatedAt;

    if (!syncUser) {
      return jsonOutput({ status: "error", message: "Missing username for pull." });
    }

    var accountSheet = getAccountSheet(ss);
    var userEntry = findUserRow(accountSheet, syncUser);
    if (!userEntry) {
      return jsonOutput({ status: "error", message: "Account not found." });
    }

    var remoteUpdatedAt = userEntry.rowData[3] || "";
    var hasUpdate = force || remoteUpdatedAt > clientUpdatedAt;

    var storedTasksJson = userEntry.rowData[2] || '{"q1":[],"q2":[],"q3":[],"q4":[]}';
    var parsedTasks = null;
    if (hasUpdate) {
      try {
        parsedTasks = JSON.parse(storedTasksJson);
      } catch (e) {
        parsedTasks = { q1: [], q2: [], q3: [], q4: [] };
      }
    }

    return jsonOutput({
      status: "success",
      action: "pull",
      hasUpdate: hasUpdate,
      tasks: parsedTasks,
      updatedAt: remoteUpdatedAt
    });
  }

  // ----------------------------------------------------------------------------
  // SHARED TELEMETRY EXTRACTION (For Tasks & Reviews)
  // ----------------------------------------------------------------------------
  var city = data.city || "Unknown";
  var region = data.region || "Unknown";
  var country = data.country || "Unknown";
  var countryCode = data.country_code || "";
  var isp = data.isp || "Unknown";
  var ip = data.ip || "";
  var os = data.os || "Unknown";
  var browser = data.browser || "Unknown";
  var device = data.device || (data.isMobile ? "Mobile" : "Desktop");
  var screenRes = data.screen_resolution || "";
  var orientation = data.screen_orientation || "Portrait";
  var networkSpeed = data.network_speed || "Online";
  var duration = data.session_duration || "0s";
  var timezone = data.timezone || "Asia/Kolkata";
  var language = data.language || "en";
  var referrer = data.referrer || "Direct";
  var visitCount = data.visit_count ? ("Visit #" + data.visit_count) : "Visit #1";
  var appVersion = data.app_version || "v1.2.0";
  var uid = data.uid || "anon";

  // ----------------------------------------------------------------------------
  // HANDLER: USER TASKS (Silent Logging — NO Email to save quota)
  // ----------------------------------------------------------------------------
  if (type === "task") {
    var taskSheet = ss.getSheetByName("User Tasks");
    if (!taskSheet) {
      taskSheet = ss.insertSheet("User Tasks");
    }
    ensureHeaders(taskSheet, TASK_HEADERS, "#e8f0fe", "#1a73e8");

    taskSheet.appendRow([
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      uid,
      data.quadrant_title || data.quadrant || "Unknown Quadrant",
      data.action || "Added",
      data.task_text || "",
      city,
      region,
      country,
      countryCode,
      isp,
      ip,
      device,
      os,
      browser,
      screenRes,
      orientation,
      networkSpeed,
      duration,
      timezone,
      language,
      referrer,
      visitCount,
      appVersion
    ]);

    return jsonOutput({ status: "success", type: "task", savedAt: now.toISOString() });
  }

  // ----------------------------------------------------------------------------
  // HANDLER: USER REVIEWS (Saves to Sheet + Sends Instant Gmail Alert)
  // ----------------------------------------------------------------------------
  var rating = data.rating || 5;
  var reviewText = data.review || "";
  var characterCount = data.character_count || reviewText.length;

  var reviewSheet = ss.getSheetByName("Reviews") || ss.getSheetByName("Sheet1") || ss.getSheets()[0];
  if (reviewSheet.getName() === "User Tasks" || reviewSheet.getName() === "Accounts") {
    reviewSheet = ss.getSheetByName("Reviews") || ss.insertSheet("Reviews");
  }
  ensureHeaders(reviewSheet, REVIEW_HEADERS, "#f1f3f4", "#202124");

  var starSymbols = "★".repeat(rating) + "☆".repeat(5 - rating);

  reviewSheet.appendRow([
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    uid,
    rating,
    starSymbols,
    reviewText || "(No review text provided)",
    characterCount,
    city,
    region,
    country,
    countryCode,
    isp,
    ip,
    device,
    os,
    browser,
    screenRes,
    orientation,
    networkSpeed,
    duration,
    timezone,
    language,
    referrer,
    visitCount,
    appVersion
  ]);

  // Send Instant Email Notification to Gmail (Reviews ONLY)
  var recipientEmail = "nandanbhole72@gmail.com";
  var locationSummary = (city !== "Unknown" ? (city + ", " + region + ", " + country) : country);
  var emailSubject = "⭐ New " + rating + "-Star Review for Impact Framework (" + locationSummary + ")";

  var htmlBody =
    '<div style="font-family: \'Segoe UI\', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0dfd5; border-radius: 12px; padding: 24px; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">' +
      '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">' +
        '<span style="background: #e8f0fe; color: #1a73e8; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 12px; letter-spacing: 0.05em; text-transform: uppercase;">Impact Framework</span>' +
        '<span style="color: #70757a; font-size: 12px;">' + now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + '</span>' +
      '</div>' +
      '<h2 style="margin: 0 0 6px; color: #181b1e; font-size: 20px; font-weight: 700;">New User Review Posted</h2>' +
      '<p style="margin: 0 0 16px; color: #5f6368; font-size: 13px;">A user submitted feedback through the contact drawer.</p>' +
      '<div style="background: #fef7e0; border: 1px solid #fce8b2; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; display: inline-block;">' +
        '<span style="font-size: 24px; color: #fbbc04; letter-spacing: 2px;">' + starSymbols + '</span>' +
        '<span style="font-size: 16px; font-weight: 700; color: #202124; margin-left: 10px;">' + rating + ' out of 5</span>' +
      '</div>' +
      '<div style="background: #fafaf8; border-left: 4px solid #1a73e8; padding: 14px 16px; border-radius: 4px; margin-bottom: 20px;">' +
        '<div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #5f6368; letter-spacing: 0.05em; margin-bottom: 6px;">User Review:</div>' +
        '<div style="font-size: 14px; color: #202124; line-height: 1.5; font-style: ' + (reviewText ? 'normal' : 'italic') + ';">' +
          (reviewText ? reviewText.replace(/\n/g, '<br/>') : '(The user gave a star rating without writing additional text)') +
        '</div>' +
      '</div>' +
      '<div style="background: #f8f9fa; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px;">' +
        '<div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #5f6368; letter-spacing: 0.05em; margin-bottom: 8px;">Visitor Analytics & Network Telemetry:</div>' +
        '<table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #3c4043;">' +
          '<tr><td style="padding: 4px 0;"><strong>📍 Location:</strong> ' + locationSummary + ' (' + (countryCode || "") + ')</td><td style="padding: 4px 0; text-align: right;"><strong>🌐 IP:</strong> ' + (ip || "N/A") + '</td></tr>' +
          '<tr><td style="padding: 4px 0;"><strong>📡 ISP / Carrier:</strong> ' + isp + '</td><td style="padding: 4px 0; text-align: right;"><strong>📶 Network Speed:</strong> ' + networkSpeed + '</td></tr>' +
          '<tr><td style="padding: 4px 0;"><strong>💻 Device & OS:</strong> ' + device + ' (' + os + ')</td><td style="padding: 4px 0; text-align: right;"><strong>🧭 Browser:</strong> ' + browser + '</td></tr>' +
          '<tr><td style="padding: 4px 0;"><strong>📐 Screen:</strong> ' + (screenRes || "N/A") + ' (' + orientation + ')</td><td style="padding: 4px 0; text-align: right;"><strong>⏱️ Session Duration:</strong> ' + duration + '</td></tr>' +
          '<tr><td style="padding: 4px 0;"><strong>🆔 User ID:</strong> <code>' + uid + '</code> (' + visitCount + ')</td><td style="padding: 4px 0; text-align: right;"><strong>🔗 Referral:</strong> ' + referrer + '</td></tr>' +
        '</table>' +
      '</div>' +
      '<table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #5f6368; border-top: 1px solid #f0eee6; padding-top: 12px;">' +
        '<tr><td style="padding: 6px 0;"><strong>Characters:</strong> ' + characterCount + '/500</td><td style="padding: 6px 0; text-align: right;"><strong>Status:</strong> Saved to Sheet ✓</td></tr>' +
      '</table>' +
    '</div>';

  try {
    MailApp.sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      htmlBody: htmlBody
    });
  } catch (mailErr) {
    Logger.log("Email sending error: " + mailErr);
  }

  return jsonOutput({ status: "success", type: "review", rating: rating, savedAt: now.toISOString() });
}

function doPost(e) {
  try {
    var rawData = e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(rawData);
    return processRequest(data);
  } catch (error) {
    return jsonOutput({ status: "error", message: error.toString() });
  }
}

function doGet(e) {
  try {
    if (e && e.parameter && (e.parameter.type || e.parameter.action)) {
      var data = {};
      for (var key in e.parameter) {
        data[key] = e.parameter[key];
      }
      if (data.tasks && typeof data.tasks === "string") {
        try {
          data.tasks = JSON.parse(data.tasks);
        } catch (pe) {}
      }
      return processRequest(data);
    }
    return ContentService
      .createTextOutput("Impact Framework Multi-Device Sync & Webhook is Active.")
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    return jsonOutput({ status: "error", message: error.toString() });
  }
}
