const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('penyelesaian_anomali').select(`*, daftar_survei(nama_survei)`);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { id_survei, link_spreadsheet_anomali, spreadsheet_id, uploaded_by } = req.body;
  const { data, error } = await supabase.from('penyelesaian_anomali').insert([{ id_survei, link_spreadsheet_anomali, spreadsheet_id, uploaded_by }]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('penyelesaian_anomali').delete().eq('id', id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { id_survei, link_spreadsheet_anomali, spreadsheet_id, uploaded_by } = req.body;
  const { data, error } = await supabase.from('penyelesaian_anomali').update({ id_survei, link_spreadsheet_anomali, spreadsheet_id, uploaded_by }).eq('id', id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('penyelesaian_anomali').select(`*, daftar_survei(nama_survei)`).eq('id', id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// get all penyelesaian anomali by id_survei
router.get('/by-survei/:id_survei', async (req, res) => {
  const { id_survei } = req.params;
  const { data, error } = await supabase.from('penyelesaian_anomali').select(`*, daftar_survei(nama_survei)`).eq('id_survei', id_survei);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
