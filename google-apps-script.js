/**
 * ==============================================================================
 * Impact Framework — Google Sheets & Instant Gmail Webhook
 * ==============================================================================
 * This script runs inside your Google Sheet (Extensions > Apps Script).
 * Whenever a user clicks "Post" in the Impact Framework app, it automatically:
 *   1. Appends a new row to your Google Spreadsheet.
 *   2. Instantly sends a beautiful HTML notification email to nandanbhole72@gmail.com.
 * ==============================================================================
 */

function doPost(e) {
  try {
    var rawData = e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(rawData);

    var rating = data.rating || 5;
    var reviewText = data.review || "";
    var deviceType = data.device || (data.isMobile ? "mobile" : "desktop");
    var appVersion = data.app_version || "v1.2.0";
    var characterCount = data.character_count || reviewText.length;
    var now = new Date();

    // --------------------------------------------------------------------------
    // 1. SAVE TO GOOGLE SHEET
    // --------------------------------------------------------------------------
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Auto-create formatted headers if this is a fresh sheet
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Date & Time",
        "Rating (1-5)",
        "Stars",
        "Review Description",
        "Length",
        "Device",
        "App Version"
      ]);
      var headerRange = sheet.getRange("A1:G1");
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f1f3f4");
      headerRange.setFontColor("#202124");
      sheet.setFrozenRows(1);
    }

    var starSymbols = "★".repeat(rating) + "☆".repeat(5 - rating);

    sheet.appendRow([
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      rating,
      starSymbols,
      reviewText || "(No review text provided)",
      characterCount,
      deviceType,
      appVersion
    ]);

    // --------------------------------------------------------------------------
    // 2. SEND INSTANT NOTIFICATION EMAIL TO GMAIL
    // --------------------------------------------------------------------------
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
      .createTextOutput(JSON.stringify({ status: "success", rating: rating, savedAt: now.toISOString() }))
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
