/**
 * ==============================================================================
 * Impact Framework — Unified Google Sheets & Instant Gmail Webhook
 * ==============================================================================
 * This script handles FOUR types of requests:
 *   1. User Reviews (type = "review"):
 *      - Appends to "Reviews" (or "Sheet1") with full visitor analytics.
 *      - Sends instant HTML email alert to nandanbhole72@gmail.com.
 *
 *   2. User Tasks (type = "task"):
 *      - Appends to "User Tasks" (Date, User ID, Quadrant, Action, Task, Analytics).
 *      - SILENT LOG: Does NOT send an email to preserve your 100/day email quota!
 *
 *   3. Device Sync - Save Board (type = "sync_tasks"):
 *      - Upserts board state in "Device Sync" tab under 6-digit pairing code.
 *      - SILENT: NO email sent.
 *
 *   4. Device Sync - Fetch Board (type = "get_tasks" or GET ?action=get_tasks):
 *      - Retrieves latest board tasks by 6-digit pairing code for cross-device sync.
 * ==============================================================================
 */

function testRun() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("✓ Successfully connected to spreadsheet: " + ss.getName());
  Logger.log("✓ Remaining daily email quota: " + MailApp.getRemainingDailyQuota());
  return "Permissions granted successfully!";
}

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

var SYNC_HEADERS = [
  "Pairing Code",
  "Last Updated (IST)",
  "Task Count",
  "Tasks Data (JSON)",
  "Last Device",
  "User ID"
];

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

function doPost(e) {
  try {
    var rawData = e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(rawData);
    var now = new Date();
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ==========================================================================
    // HANDLER 1: DEVICE SYNC — SAVE BOARD (Silent)
    // ==========================================================================
    if (data.type === "sync_tasks") {
      var rawCode = String(data.code || "").replace(/[^0-9A-Za-z]/g, "").trim();
      if (!rawCode) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "error", message: "Missing pairing code." }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var syncSheet = ss.getSheetByName("Device Sync");
      if (!syncSheet) {
        syncSheet = ss.insertSheet("Device Sync");
      }
      ensureHeaders(syncSheet, SYNC_HEADERS, "#e6f4ea", "#137333");

      var taskCount = 0;
      if (data.tasks && typeof data.tasks === "object") {
        for (var q in data.tasks) {
          if (Array.isArray(data.tasks[q])) taskCount += data.tasks[q].length;
        }
      }

      var payloadObj = {
        tasks: data.tasks || {},
        updatedAt: Number(data.updatedAt) || now.getTime(),
        device: data.device || "Desktop",
        uid: data.uid || "anon"
      };

      var rowData = [
        rawCode,
        now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        taskCount,
        JSON.stringify(payloadObj),
        data.device || "Desktop",
        data.uid || "anon"
      ];

      var values = syncSheet.getDataRange().getValues();
      var targetRow = -1;
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).replace(/[^0-9A-Za-z]/g, "") === rawCode) {
          targetRow = i + 1;
          break;
        }
      }

      if (targetRow > 0) {
        syncSheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
      } else {
        syncSheet.appendRow(rowData);
      }

      return ContentService
        .createTextOutput(JSON.stringify({
          status: "success",
          type: "sync_tasks",
          code: rawCode,
          updatedAt: payloadObj.updatedAt,
          taskCount: taskCount,
          savedAt: now.toISOString()
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================================================
    // HANDLER 2: DEVICE SYNC — GET BOARD (Silent)
    // ==========================================================================
    if (data.type === "get_tasks") {
      var searchCode = String(data.code || "").replace(/[^0-9A-Za-z]/g, "").trim();
      var sheetSync = ss.getSheetByName("Device Sync");

      if (sheetSync && sheetSync.getLastRow() > 1) {
        var allRows = sheetSync.getDataRange().getValues();
        for (var j = 1; j < allRows.length; j++) {
          if (String(allRows[j][0]).replace(/[^0-9A-Za-z]/g, "") === searchCode) {
            var rawContent = allRows[j][3] || "{}";
            var parsedPayload = {};
            try {
              parsedPayload = JSON.parse(rawContent);
            } catch(errJson) { parsedPayload = {}; }

            var returnTasks = parsedPayload.tasks !== undefined ? parsedPayload.tasks : parsedPayload;
            var returnUpdatedAt = parsedPayload.updatedAt || 0;

            return ContentService
              .createTextOutput(JSON.stringify({
                status: "success",
                type: "get_tasks",
                code: searchCode,
                tasks: returnTasks,
                updatedAt: returnUpdatedAt,
                lastDevice: allRows[j][4] || parsedPayload.device || "Desktop",
                lastUid: allRows[j][5] || parsedPayload.uid || "anon",
                lastUpdated: allRows[j][1],
                taskCount: allRows[j][2]
              }))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }

      return ContentService
        .createTextOutput(JSON.stringify({
          status: "not_found",
          type: "get_tasks",
          code: searchCode,
          message: "No tasks found for code " + searchCode
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Prepare shared telemetry values
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

    // ==========================================================================
    // HANDLER 3: USER TASKS (Silent Logging — NO Email to save quota)
    // ==========================================================================
    if (data.type === "task") {
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

      return ContentService
        .createTextOutput(JSON.stringify({ status: "success", type: "task", savedAt: now.toISOString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================================================
    // HANDLER 4: USER REVIEWS (Saves to Sheet + Sends Instant Gmail Alert)
    // ==========================================================================
    var rating = data.rating || 5;
    var reviewText = data.review || "";
    var characterCount = data.character_count || reviewText.length;

    var reviewSheet = ss.getSheetByName("Reviews") || ss.getSheetByName("Sheet1") || ss.getSheets()[0];
    if (reviewSheet.getName() === "User Tasks" || reviewSheet.getName() === "Device Sync") {
      reviewSheet = ss.insertSheet("Reviews");
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
            '<tr>' +
              '<td style="padding: 4px 0;"><strong>📍 Location:</strong> ' + locationSummary + ' (' + (countryCode || "") + ')</td>' +
              '<td style="padding: 4px 0; text-align: right;"><strong>🌐 IP:</strong> ' + (ip || "N/A") + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="padding: 4px 0;"><strong>📡 ISP / Carrier:</strong> ' + isp + '</td>' +
              '<td style="padding: 4px 0; text-align: right;"><strong>📶 Network Speed:</strong> ' + networkSpeed + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="padding: 4px 0;"><strong>💻 Device & OS:</strong> ' + device + ' (' + os + ')</td>' +
              '<td style="padding: 4px 0; text-align: right;"><strong>🧭 Browser:</strong> ' + browser + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="padding: 4px 0;"><strong>📐 Screen:</strong> ' + (screenRes || "N/A") + ' (' + orientation + ')</td>' +
              '<td style="padding: 4px 0; text-align: right;"><strong>⏱️ Session Duration:</strong> ' + duration + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="padding: 4px 0;"><strong>🆔 User ID:</strong> <code>' + uid + '</code> (' + visitCount + ')</td>' +
              '<td style="padding: 4px 0; text-align: right;"><strong>🔗 Referral:</strong> ' + referrer + '</td>' +
            '</tr>' +
          '</table>' +
        '</div>' +

        '<table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #5f6368; border-top: 1px solid #f0eee6; padding-top: 12px;">' +
          '<tr>' +
            '<td style="padding: 6px 0;"><strong>Characters:</strong> ' + characterCount + '/500</td>' +
            '<td style="padding: 6px 0; text-align: right;"><strong>Status:</strong> Saved to Sheet ✓</td>' +
          '</tr>' +
        '</table>' +
      '</div>';

    MailApp.sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      htmlBody: htmlBody
    });

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", type: "review", rating: rating, savedAt: now.toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === "get_tasks" && p.code) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var syncSheet = ss.getSheetByName("Device Sync");
      if (!syncSheet) {
        syncSheet = ss.insertSheet("Device Sync");
        ensureHeaders(syncSheet, SYNC_HEADERS, "#e6f4ea", "#137333");
      }
      if (syncSheet.getLastRow() > 1) {
        var cleanCode = String(p.code).replace(/[^0-9A-Za-z]/g, "").trim();
        var values = syncSheet.getDataRange().getValues();
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][0]).replace(/[^0-9A-Za-z]/g, "") === cleanCode) {
            var rawVal = values[i][3] || "{}";
            var parsed = {};
            try {
              parsed = JSON.parse(rawVal);
            } catch(errJson) { parsed = {}; }

            var tasks = parsed.tasks !== undefined ? parsed.tasks : parsed;
            var updatedAt = parsed.updatedAt || 0;

            return ContentService
              .createTextOutput(JSON.stringify({
                status: "success",
                code: cleanCode,
                tasks: tasks,
                updatedAt: updatedAt,
                lastDevice: values[i][4] || parsed.device || "Desktop",
                lastUid: values[i][5] || parsed.uid || "anon",
                lastUpdated: values[i][1],
                taskCount: values[i][2]
              }))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: "not_found", message: "Pairing code not found." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {}

  return ContentService
    .createTextOutput("Impact Framework Google Sheets & Gmail Webhook is Active.")
    .setMimeType(ContentService.MimeType.TEXT);
}
