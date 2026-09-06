/**
 * ==============================================================================
 * Impact Framework — Unified Google Sheets & Instant Gmail Webhook
 * ==============================================================================
 * This script handles TWO types of incoming data:
 *   1. User Reviews (type = "review"):
 *      - Appends to "Reviews" sheet.
 *      - Sends instant HTML email alert to nandanbhole72@gmail.com.
 *
 *   2. User Tasks (type = "task"):
 *      - Appends to "User Tasks" sheet (Date, User ID, Quadrant, Action, Task).
 *      - SILENT LOG: Does NOT send an email to preserve your 100/day email quota!
 * ==============================================================================
 */

function testRun() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("✓ Successfully connected to spreadsheet: " + ss.getName());
  Logger.log("✓ Remaining daily email quota: " + MailApp.getRemainingDailyQuota());
  return "Permissions granted successfully!";
}

function doPost(e) {
  try {
    var rawData = e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(rawData);
    var now = new Date();
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ==========================================================================
    // HANDLER 1: USER TASKS (Silent Logging — NO Email to save quota)
    // ==========================================================================
    if (data.type === "task") {
      var taskSheet = ss.getSheetByName("User Tasks");

      // Auto-create "User Tasks" tab if it does not exist yet
      if (!taskSheet) {
        taskSheet = ss.insertSheet("User Tasks");
        taskSheet.appendRow([
          "Date & Time",
          "User ID",
          "Quadrant",
          "Action",
          "Task Content",
          "Device",
          "App Version"
        ]);
        var taskHeader = taskSheet.getRange("A1:G1");
        taskHeader.setFontWeight("bold");
        taskHeader.setBackground("#e8f0fe");
        taskHeader.setFontColor("#1a73e8");
        taskSheet.setFrozenRows(1);
      }

      taskSheet.appendRow([
        now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        data.uid || "anon",
        data.quadrant_title || data.quadrant || "Unknown Quadrant",
        data.action || "Added",
        data.task_text || "",
        data.device || "desktop",
        data.app_version || "v1.2.0"
      ]);

      return ContentService
        .createTextOutput(JSON.stringify({ status: "success", type: "task", savedAt: now.toISOString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================================================
    // HANDLER 2: USER REVIEWS (Saves to Sheet + Sends Instant Gmail Alert)
    // ==========================================================================
    var rating = data.rating || 5;
    var reviewText = data.review || "";
    var deviceType = data.device || (data.isMobile ? "mobile" : "desktop");
    var appVersion = data.app_version || "v1.2.0";
    var characterCount = data.character_count || reviewText.length;

    var reviewSheet = ss.getSheetByName("Reviews") || ss.getSheets()[0];
    if (reviewSheet.getName() === "User Tasks") {
      reviewSheet = ss.insertSheet("Reviews");
    }

    // Auto-create formatted headers if empty
    if (reviewSheet.getLastRow() === 0) {
      reviewSheet.appendRow([
        "Date & Time",
        "Rating (1-5)",
        "Stars",
        "Review Description",
        "Length",
        "Device",
        "App Version"
      ]);
      var revHeader = reviewSheet.getRange("A1:G1");
      revHeader.setFontWeight("bold");
      revHeader.setBackground("#f1f3f4");
      revHeader.setFontColor("#202124");
      reviewSheet.setFrozenRows(1);
    }

    var starSymbols = "★".repeat(rating) + "☆".repeat(5 - rating);

    reviewSheet.appendRow([
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      rating,
      starSymbols,
      reviewText || "(No review text provided)",
      characterCount,
      deviceType,
      appVersion
    ]);

    // Send Instant Email Notification to Gmail
    var recipientEmail = "nandanbhole72@gmail.com";
    var emailSubject = "⭐ New " + rating + "-Star Review for Impact Framework";

    var htmlBody =
      '<div style="font-family: \'Segoe UI\', Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e0dfd5; border-radius: 12px; padding: 24px; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">' +
        '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">' +
          '<span style="background: #e8f0fe; color: #1a73e8; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 12px; letter-spacing: 0.05em; text-transform: uppercase;">Impact Framework</span>' +
          '<span style="color: #70757a; font-size: 12px;">' + now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + '</span>' +
        '</div>' +

        '<h2 style="margin: 0 0 6px; color: #181b1e; font-size: 20px; font-weight: 700;">New User Review Posted</h2>' +
        '<p style="margin: 0 0 16px; color: #5f6368; font-size: 13px;">A user just submitted feedback through the contact drawer.</p>' +

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

        '<table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #5f6368; margin-top: 14px; border-top: 1px solid #f0eee6; padding-top: 12px;">' +
          '<tr>' +
            '<td style="padding: 6px 0;"><strong>Device Type:</strong> ' + deviceType + '</td>' +
            '<td style="padding: 6px 0; text-align: right;"><strong>App Version:</strong> ' + appVersion + '</td>' +
          '</tr>' +
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
  return ContentService
    .createTextOutput("Impact Framework Google Sheets & Gmail Webhook is Active.")
    .setMimeType(ContentService.MimeType.TEXT);
}
