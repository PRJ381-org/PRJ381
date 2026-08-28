const { google } = require('googleapis');
const {
  GOOGLE_SHEETS_CLIENT_EMAIL,
  GOOGLE_SHEETS_PRIVATE_KEY,
  GOOGLE_SHEETS_SPREADSHEET_ID,
} = require('../config/env');

/**
 * Different hosts store multi-line secrets differently (literal "\n",
 * real newlines, or wrapped in quotes) - normalize whatever we get into
 * a real PEM string so the OpenSSL decoder can actually parse it.
 */
function normalizePrivateKey(key) {
  if (!key) return key;
  let normalized = key.trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  if (normalized.includes('\\n')) {
    normalized = normalized.replace(/\\n/g, '\n');
  }

  return normalized;
}

let sheetsClient;
function getClient() {
  if (!sheetsClient) {
    const privateKey = normalizePrivateKey(GOOGLE_SHEETS_PRIVATE_KEY);
    const auth = new google.auth.JWT({
      email: GOOGLE_SHEETS_CLIENT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
  }
  return sheetsClient;
}

/**
 * Reads the Google Form's response sheet and returns it as an array of
 * objects keyed by column header (e.g. { "Full Name": "...", "Email": "..." }).
 */
async function readFeedbackRows() {
  if (!GOOGLE_SHEETS_CLIENT_EMAIL || !GOOGLE_SHEETS_PRIVATE_KEY || !GOOGLE_SHEETS_SPREADSHEET_ID) {
    throw new Error('Google Sheets feedback integration is not configured yet.');
  }

  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
    range: 'Form Responses 1',
  });

  const [header, ...rows] = res.data.values || [];
  if (!header) return [];

  return rows.map((row) => Object.fromEntries(header.map((col, i) => [col, row[i] || ''])));
}

module.exports = { readFeedbackRows };
