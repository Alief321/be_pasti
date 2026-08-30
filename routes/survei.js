const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase'); // Buat file config untuk inisialisasi client supabase

// GET semua survei
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('daftar_survei').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST survei baru
router.post('/', async (req, res) => {
  const { nama_survei, deskripsi_survei } = req.body;
  const { data, error } = await supabase.from('daftar_survei').insert([{ nama_survei, deskripsi_survei }]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// PUT update survei
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nama_survei, deskripsi_survei } = req.body;
  const { data, error } = await supabase.from('daftar_survei').update({ nama_survei, deskripsi_survei }).eq('id', id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// DELETE survei
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('daftar_survei').delete().eq('id', id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// GET survei by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('daftar_survei').select('*').eq('id', id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
