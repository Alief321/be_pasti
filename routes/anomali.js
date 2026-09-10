const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET semua anomali beserta nama survei-nya
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('daftar_anomali').select(`*, daftar_survei(nama_survei)`);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST anomali baru
router.post('/', async (req, res) => {
  const { id_survei, jenis_anomali, sql_query } = req.body;
  const { data, error } = await supabase.from('daftar_anomali').insert([{ id_survei, jenis_anomali, sql_query }]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { id_survei, jenis_anomali, sql_query } = req.body;
  const { data, error } = await supabase.from('daftar_anomali').update({ id_survei, jenis_anomali, sql_query }).eq('id', id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('daftar_anomali').delete().eq('id', id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('daftar_anomali').select(`*, daftar_survei(nama_survei)`).eq('id', id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
