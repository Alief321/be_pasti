const { google } = require('googleapis');

async function cleanServiceAccountDrive() {
  console.log('Menghubungkan ke Service Account...');
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, 
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth: await auth.getClient() });

  try {
    // Cari semua file yang dimiliki oleh Service Account
    const res = await drive.files.list({
      pageSize: 100, // Ambil 100 file sekaligus
      fields: 'files(id, name)',
    });

    const files = res.data.files;
    if (files.length === 0) {
      console.log('Drive Service Account sudah kosong.');
      
      // Jika kosong tapi masih error quota, kosongkan juga Trash (Sampah)
      console.log('Mengosongkan Trash...');
      await drive.files.emptyTrash();
      console.log('Trash berhasil dikosongkan!');
      return;
    }

    console.log(`Ditemukan ${files.length} file. Mulai menghapus...`);
    for (const file of files) {
      console.log(`Menghapus: ${file.name} (${file.id})`);
      await drive.files.delete({ fileId: file.id });
    }

    console.log('Selesai menghapus file! Mengosongkan Trash...');
    await drive.files.emptyTrash();
    console.log('Pembersihan selesai! Silakan coba upload lagi.');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

cleanServiceAccountDrive();