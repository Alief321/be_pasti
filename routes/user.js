// user.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET semua user
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST user baru
router.post('/', async (req, res) => {
  const { name, email, role, password } = req.body;
  const { data, error } = await supabase.from('users').insert([{ name, email, role, password }]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// PUT update user
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password } = req.body;

  // Buat payload dinamis: Hanya masukkan password jika ada isinya
  const updatePayload = { name, email, role };
  if (password) {
    updatePayload.password = password;
  }

  const { data, error } = await supabase.from('users').update(updatePayload).eq('id', id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// DELETE user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('users').delete().eq('id', id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// GET user by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
