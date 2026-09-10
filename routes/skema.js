const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const supabase = require('../config/supabase');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
const bucketName = 'skema';

const getFilePath = (file) => (file ? file : null);

const uploadToStorage = async (file) => {
  if (!file) return null;

  const extension = file.originalname.includes('.') ? `.${file.originalname.split('.').pop().toLowerCase()}` : '';
  const filePath = `${new Date().getFullYear()}/${crypto.randomUUID()}${extension}`;

  const { error } = await supabase.storage.from(bucketName).upload(filePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) throw error;
  return filePath;
};

const removeFromStorage = async (filePath) => {
  if (!filePath) return;
  const { error } = await supabase.storage.from(bucketName).remove([filePath]);
  if (error) throw error;
};

const getFileUrl = (filePath) => {
  if (!filePath) return null;
  return supabase.storage.from(bucketName).getPublicUrl(filePath).data.publicUrl;
};

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('skema_survei').select(`*, daftar_survei(nama_survei)`);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map((item) => ({ ...item, file_url: getFileUrl(getFilePath(item.file)) })));
});

router.post('/', upload.single('file'), async (req, res) => {
  // Tambahkan dukungan untuk variabel `nama_skema` dari frontend[cite: 7]
  const { id_survei, name, nama_skema } = req.body;
  const finalName = name || nama_skema;

  if (!id_survei) return res.status(400).json({ error: 'id_survei wajib diisi.' });
  if (!req.file) return res.status(400).json({ error: 'File wajib diunggah.' });

  try {
    const filePath = await uploadToStorage(req.file);
    const { data, error } = await supabase
      .from('skema_survei')
      .insert([{ id_survei, file: filePath, name: finalName }])
      .select()
      .single();

    if (error) {
      await removeFromStorage(filePath);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ ...data, file_url: getFileUrl(filePath) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { data: existing, error: findError } = await supabase.from('skema_survei').select('file').eq('id', id).single();
  if (findError) return res.status(404).json({ error: findError.message });

  try {
    await removeFromStorage(getFilePath(existing.file));
    const { data, error } = await supabase.from('skema_survei').delete().eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  // Membaca `name` dan `nama_skema` dari payload agar nama bisa diperbarui[cite: 7]
  const { id_survei, name, nama_skema } = req.body;

  const { data: existing, error: findError } = await supabase.from('skema_survei').select('file').eq('id', id).single();
  if (findError) return res.status(404).json({ error: findError.message });

  try {
    const newFilePath = await uploadToStorage(req.file);
    const updateData = {};
    if (id_survei !== undefined) updateData.id_survei = id_survei;

    // Simpan pembaruan nama[cite: 7]
    const finalName = name || nama_skema;
    if (finalName) updateData.name = finalName;

    if (newFilePath) updateData.file = newFilePath;

    const { data, error } = await supabase.from('skema_survei').update(updateData).eq('id', id).select().single();
    if (error) {
      if (newFilePath) await removeFromStorage(newFilePath);
      return res.status(500).json({ error: error.message });
    }

    if (newFilePath && existing.file) await removeFromStorage(existing.file);
    res.json({ ...data, file_url: getFileUrl(data.file) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('skema_survei').select(`*, daftar_survei(nama_survei)`).eq('id', id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...data, file_url: getFileUrl(getFilePath(data.file)) });
});

router.get('/by-survei/:id_survei', async (req, res) => {
  const { id_survei } = req.params;
  const { data, error } = await supabase.from('skema_survei').select(`*, daftar_survei(nama_survei)`).eq('id_survei', id_survei);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map((item) => ({ ...item, file_url: getFileUrl(getFilePath(item.file)) })));
});

module.exports = router;
