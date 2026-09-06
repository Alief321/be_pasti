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
  const { spreadsheetUrl, resolveOnly = false } = req.body;
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) return res.status(400).json({ error: 'Format link tidak valid.' });

  if (resolveOnly === true) return res.json({ spreadsheetId });

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
  const requests = [];

  for (const sheet of metaData.data.sheets) {
    const { sheetId, title: sheetName } = sheet.properties;
    const escapedSheetName = sheetName.replace(/'/g, "''");
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${escapedSheetName}'!1:1`,
    });

    const headers = headerResponse.data.values ? headerResponse.data.values[0] : [];
    const columnsToAdd = ['Status Penyelesaian', 'Tanggal Selesai', 'Catatan'].filter((column) => !headers.includes(column));
    if (columnsToAdd.length === 0) continue;

    const nextColIndex = headers.length;
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: nextColIndex,
          endColumnIndex: nextColIndex + columnsToAdd.length,
        },
        rows: [{ values: columnsToAdd.map((column) => ({ userEnteredValue: { stringValue: column } })) }],
        fields: 'userEnteredValue',
      },
    });

    if (!headers.includes('Status Penyelesaian')) {
      requests.push({
        setDataValidation: {
          range: { sheetId, startRowIndex: 1, startColumnIndex: nextColIndex, endColumnIndex: nextColIndex + 1 },
          rule: { condition: { type: 'BOOLEAN' }, showCustomUi: true, strict: true },
        },
      });
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });
  }
}

// Jangan lupa biarkan endpoint GET /data dan POST /update-row tetap ada di sini

router.get('/data/:spreadsheetId', async (req, res) => {
  const { spreadsheetId } = req.params;

  try {
    const sheets = await getSheetsClient();

    const metaData = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetData = await Promise.all(
      metaData.data.sheets.map(async (sheet) => {
        const { sheetId, title: sheetName } = sheet.properties;
        const escapedSheetName = sheetName.replace(/'/g, "''");
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${escapedSheetName}'`,
        });

        const rows = response.data.values || [];
        const headers = rows[0] || [];
        const data = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rowData = {
            _rowIndex: i + 1,
            sheetRowIndex: i + 1,
          };

          headers.forEach((header, index) => {
            rowData[header] = row[index] || '';
          });
          data.push(rowData);
        }

        return { sheetId, sheetName, headers, data };
      }),
    );

    const firstSheet = sheetData[0] || { sheetName: null, headers: [], data: [] };
    res.json({
      sheets: sheetData,
      sheetName: firstSheet.sheetName,
      headers: firstSheet.headers,
      data: firstSheet.data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menarik data dari Spreadsheet' });
  }
});

// Endpoint: POST /api/sheets/update-row
// Mengupdate status checkbox dan tanggal selesai pada baris tertentu
router.post('/update-row', async (req, res) => {
  const { spreadsheetId, sheetName, rowIndex, sheetRowIndex, isChecked, timestampColLetter, statusColLetter, noteColLetter, noteValue, note, catatan } = req.body;

  try {
    const targetRowIndex = Number(sheetRowIndex ?? rowIndex);
    if (!spreadsheetId || !sheetName || !Number.isInteger(targetRowIndex) || targetRowIndex < 1 || !statusColLetter || !timestampColLetter) {
      return res.status(400).json({ error: 'Data update baris tidak lengkap' });
    }

    const sheets = await getSheetsClient();

    const checked = isChecked === true || isChecked === 'true';
    const statusValue = checked;
    const timestampValue = checked ? new Date().toLocaleString('id-ID') : '';
    const resolvedNote = noteValue ?? note ?? catatan;
    const data = [
      {
        range: `'${sheetName}'!${statusColLetter}${targetRowIndex}`,
        values: [[statusValue]],
      },
      {
        range: `'${sheetName}'!${timestampColLetter}${targetRowIndex}`,
        values: [[timestampValue]],
      },
    ];

    if (noteColLetter && resolvedNote !== undefined) {
      data.push({
        range: `'${sheetName}'!${noteColLetter}${targetRowIndex}`,
        values: [[String(resolvedNote)]],
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {
        data,
        valueInputOption: 'USER_ENTERED',
      },
    });

    res.json({
      message: 'Baris berhasil diupdate',
      sheetRowIndex: targetRowIndex,
      updatedRanges: data.map((item) => item.range),
      timestamp: timestampValue,
      status: statusValue,
      note: resolvedNote,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengupdate Spreadsheet' });
  }
});

module.exports = router;
