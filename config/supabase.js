require('dotenv').config(); // Memastikan variabel dari .env terbaca
const { createClient } = require('@supabase/supabase-js');

// Ambil kredensial dari environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Validasi sederhana: Hentikan server jika kredensial belum diisi
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: SUPABASE_URL atau SUPABASE_KEY belum diisi di file .env!');
  console.error('Silakan periksa file .env Anda dan restart server.');
  process.exit(1); // Menghentikan proses Node.js
}

// Inisialisasi koneksi client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Ekspor agar bisa di-import (require) di file routes (survei.js, anomali.js, dll)
module.exports = supabase;