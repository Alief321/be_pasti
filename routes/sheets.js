const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Setup Multer untuk simpan file sementara di folder 'uploads/'
const upload = multer({ dest: 'uploads/' });

// Auth Google API (Digunakan untuk Sheets & Drive)
const getGoogleAuth = () => {
  const oAuth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);

  // Set token agar otomatis me-refresh diri sendiri jika kedaluwarsa
  oAuth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return oAuth2Client;
};

// Pemanggilan client tetap sama persis:
const getSheetsClient = async () => google.sheets({ version: 'v4', auth: getGoogleAuth() });
const getDriveClient = async () => google.drive({ version: 'v3', auth: getGoogleAuth() });
const extractSpreadsheetId = (url) => {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

// ========================================================
// ENDPOINT 1: UPLOAD EXCEL & AUTO-CONVERT KE SPREADSHEET
// ========================================================
// Di dalam backend/routes/sheets.js (pastikan endpoint upload & inject menerima id_survei di req.body)

router.post('/upload-excel', upload.single('file'), async (req, res) => {
  const { id_survei } = req.body; // Ambil id_survei dari form-data
  if (!req.file) return res.status(400).json({ error: 'File Excel tidak ditemukan.' });
  if (!id_survei) return res.status(400).json({ error: 'Pilih survei terlebih dahulu.' });

  try {
    const drive = await getDriveClient();

    const fileMetadata = {
      name: req.file.originalname.replace('.xlsx', ''),
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [process.env.DRIVE_FOLDER_ID],
    };

    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path),
    };

    const uploadedFile = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    const spreadsheetId = uploadedFile.data.id;
    const spreadsheetUrl = uploadedFile.data.webViewLink;

    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { role: 'writer', type: 'anyone' },
    });

    fs.unlinkSync(req.file.path);
    await injectColumnsLogic(spreadsheetId);

    res.json({
      message: 'File Excel berhasil diunggah, dikonversi, dan diinjeksi!',
      spreadsheetId,
      spreadsheetUrl,
    });
  } catch (error) {
    console.error(error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Gagal memproses file Excel.' });
  }
});

// ========================================================
// ENDPOINT 2: INJECT KOLOM DARI LINK (YANG SUDAH ADA SEBELUMNYA)
// ========================================================
router.post('/inject-columns', async (req, res) => {
  const { spreadsheetUrl } = req.body;
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) return res.status(400).json({ error: 'Format link tidak valid.' });

  try {
    await injectColumnsLogic(spreadsheetId);
    res.json({ message: 'Kolom berhasil di-inject.', spreadsheetId });
  } catch (error) {
    res.status(500).json({ error: 'Pastikan email Service Account telah ditambahkan sebagai Editor di file tersebut.' });
  }
});

// ========================================================
// FUNGSI HELPER: LOGIKA INJEKSI KOLOM SPREADSHEET
// ========================================================
async function injectColumnsLogic(spreadsheetId) {
  const sheets = await getSheetsClient();
  const metaData = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheet = metaData.data.sheets[0];
  const sheetName = firstSheet.properties.title;
  const sheetId = firstSheet.properties.sheetId;

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!1:1`,
  });

  const headers = headerResponse.data.values ? headerResponse.data.values[0] : [];
  if (headers.indexOf('Status Penyelesaian') !== -1) return; // Sudah ada kolomnya

  const nextColIndex = headers.length;
  const requests = [
    {
      updateCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: nextColIndex, endColumnIndex: nextColIndex + 2 },
        rows: [{ values: [{ userEnteredValue: { stringValue: 'Status Penyelesaian' } }, { userEnteredValue: { stringValue: 'Tanggal Selesai' } }] }],
        fields: 'userEnteredValue',
      },
    },
    {
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: nextColIndex, endColumnIndex: nextColIndex + 1 },
        rule: { condition: { type: 'BOOLEAN' }, showCustomUi: true, strict: true },
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });
}

// Jangan lupa biarkan endpoint GET /data dan POST /update-row tetap ada di sini

router.get('/data/:spreadsheetId', async (req, res) => {
  const { spreadsheetId } = req.params;

  try {
    const sheets = await getSheetsClient();

    // Ambil nama sheet pertama
    const metaData = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetName = metaData.data.sheets[0].properties.title;

    // Ambil seluruh data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'`, // Tarik semua baris dan kolom
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return res.json({ data: [] });

    const headers = rows[0];
    const data = [];

    // Mulai dari indeks 1 (baris ke-2) karena indeks 0 adalah header
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      let rowData = {
        _rowIndex: i + 1, // Simpan nomor baris asli (untuk keperluan update nanti)
      };

      headers.forEach((header, index) => {
        rowData[header] = row[index] || '';
      });
      data.push(rowData);
    }

    res.json({ headers, data, sheetName });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menarik data dari Spreadsheet' });
  }
});

// Endpoint: POST /api/sheets/update-row
// Mengupdate status checkbox dan tanggal selesai pada baris tertentu
router.post('/update-row', async (req, res) => {
  const { spreadsheetId, sheetName, rowIndex, isChecked, timestampColLetter, statusColLetter } = req.body;

  try {
    const sheets = await getSheetsClient();

    const statusValue = isChecked ? 'TRUE' : 'FALSE';
    const timestampValue = isChecked ? new Date().toLocaleString('id-ID') : ''; // Kosongkan waktu jika di-uncheck

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!${statusColLetter}${rowIndex}:${timestampColLetter}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[statusValue, timestampValue]],
      },
    });

    res.json({ message: 'Baris berhasil diupdate', timestamp: timestampValue });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengupdate Spreadsheet' });
  }
});

module.exports = router;
