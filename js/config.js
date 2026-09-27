/**
 * Impact Framework Configuration
 * ==============================================================================
 * To connect your Google Sheet & Gmail:
 * 1. Open Google Sheets (sheets.new) and create a sheet named "Impact Framework Reviews".
 * 2. Click Extensions > Apps Script and paste the contents of google-apps-script.js.
 * 3. Click Deploy > New Deployment > Web App (Set "Who has access" to "Anyone").
 * 4. Copy the Web App URL and paste it below between the quotes!
 * ==============================================================================
 */
window.IMPACT_CONFIG = {
  // Google Apps Script Webhook (for Reviews & Contact notifications)
  googleWebhookUrl: "https://script.google.com/macros/s/AKfycbxA0SIv6IiO-fkWbSUiV6Vwp6XmwFutVEeCjgPmPiQQlTNuiIZ5uqlJrlIvOOGlUvaK/exec",

  // Supabase Real-Time Database (for Ultra-Fast 30ms Board & Subtasks Sync)
  supabaseUrl: "https://ksjnvkpkppvxnexonnjh.supabase.co",
  supabaseAnonKey: "sb_publishable_OT6sQJSRYyIIgKYWBeEyjQ_RKriWGvD"
};
