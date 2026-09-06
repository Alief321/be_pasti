const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const publicRouter = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, requireAdmin } = require('../utils/auth');

const hashShareToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const getUserId = (req) => req.user?.id || req.user?.sub || null;

const handleSupabaseError = (res, error) => res.status(500).json({ error: error.message });

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('penyelesaian_anomali').select(`*, daftar_survei(nama_survei)`);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { id_survei, nama, link_spreadsheet_anomali, spreadsheet_id, uploaded_by } = req.body;
  const { data, error } = await supabase
    .from('penyelesaian_anomali')
    .insert([{ id_survei, Nama: nama, link_spreadsheet_anomali, spreadsheet_id, uploaded_by }])
    .select();
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
  const { id_survei, nama, link_spreadsheet_anomali, spreadsheet_id, uploaded_by } = req.body;
  const { data, error } = await supabase.from('penyelesaian_anomali').update({ id_survei, nama, link_spreadsheet_anomali, spreadsheet_id, uploaded_by }).eq('id', id).select();
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

// sesuaikan untuk kolom anomali dan kolom link
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { kolom_anomali, kolom_link } = req.body;
  const { data, error } = await supabase.from('penyelesaian_anomali').update({ kolom_anomali, kolom_link }).eq('id', id).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

router.get('/survei/:id/column-mapping', async (req, res) => {
  const { data, error } = await supabase.from('survei_column_mappings').select('*').eq('id_survei', req.params.id).maybeSingle();
  if (error) return handleSupabaseError(res, error);
  res.json(data || { id_survei: req.params.id, key_column: null, column_mapping: {}, key_mappings: {} });
});

router.put('/survei/:id/column-mapping', authenticateToken, requireAdmin, async (req, res) => {
  const { key_column = null, column_mapping = {}, key_mappings = {} } = req.body;
  if (!column_mapping || typeof column_mapping !== 'object' || Array.isArray(column_mapping)) {
    return res.status(400).json({ error: 'column_mapping harus berupa object.' });
  }
  if (!key_mappings || typeof key_mappings !== 'object' || Array.isArray(key_mappings)) {
    return res.status(400).json({ error: 'key_mappings harus berupa object.' });
  }

  const { data, error } = await supabase
    .from('survei_column_mappings')
    .upsert(
      {
        id_survei: req.params.id,
        key_column,
        column_mapping,
        key_mappings,
        updated_by: getUserId(req),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id_survei' },
    )
    .select()
    .single();
  if (error) return handleSupabaseError(res, error);
  res.json(data);
});

router.get('/:id/mapping', async (req, res) => {
  const { data, error } = await supabase.from('penyelesaian_mappings').select('*').eq('id_penyelesaian', req.params.id).maybeSingle();
  if (error) return handleSupabaseError(res, error);
  res.json(data || { id_penyelesaian: req.params.id, key_column: null, column_mapping: {} });
});

router.put('/:id/mapping', authenticateToken, requireAdmin, async (req, res) => {
  const { key_column = null, column_mapping = {} } = req.body;
  if (!column_mapping || typeof column_mapping !== 'object' || Array.isArray(column_mapping)) {
    return res.status(400).json({ error: 'column_mapping harus berupa object.' });
  }

  const { data, error } = await supabase
    .from('penyelesaian_mappings')
    .upsert(
      {
        id_penyelesaian: req.params.id,
        key_column,
        column_mapping,
        updated_by: getUserId(req),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id_penyelesaian' },
    )
    .select()
    .single();
  if (error) return handleSupabaseError(res, error);
  res.json(data);
});

router.post('/:id/share', authenticateToken, requireAdmin, async (req, res) => {
  const { allowed_sheets = [], expires_at = null } = req.body;
  if (!Array.isArray(allowed_sheets)) {
    return res.status(400).json({ error: 'allowed_sheets harus berupa array.' });
  }
  if (expires_at && Number.isNaN(Date.parse(expires_at))) {
    return res.status(400).json({ error: 'expires_at tidak valid.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const { data, error } = await supabase
    .from('penyelesaian_shares')
    .insert({
      id_penyelesaian: req.params.id,
      token_hash: hashShareToken(token),
      permission: 'view',
      allowed_sheets,
      expires_at,
      created_by: getUserId(req),
    })
    .select('id, id_penyelesaian, permission, allowed_sheets, expires_at, created_at')
    .single();
  if (error) return handleSupabaseError(res, error);
  res.status(201).json({ ...data, token });
});

router.get('/:id/shares', authenticateToken, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('penyelesaian_shares')
    .select('id, id_penyelesaian, permission, token_hash, allowed_sheets, expires_at, revoked_at, created_at')
    .eq('id_penyelesaian', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return handleSupabaseError(res, error);
  res.json(data);
});

router.delete('/:id/shares/:shareId', authenticateToken, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('penyelesaian_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', req.params.shareId)
    .eq('id_penyelesaian', req.params.id)
    .is('revoked_at', null)
    .select('id, revoked_at')
    .maybeSingle();
  if (error) return handleSupabaseError(res, error);
  if (!data) return res.status(404).json({ error: 'Link share tidak ditemukan atau sudah dicabut.' });
  res.json(data);
});

publicRouter.get('/:token', async (req, res) => {
  console.log('Public access with token:', req.params.token);
  const { data: share, error: shareError } = await supabase.from('penyelesaian_shares').select('id, id_penyelesaian, permission, allowed_sheets, expires_at, revoked_at').eq('token_hash', req.params.token).maybeSingle();
  // console.log('Share data:', share, 'Error:', shareError);

  if (shareError) return handleSupabaseError(res, shareError);
  if (!share || share.revoked_at || (share.expires_at && new Date(share.expires_at) <= new Date())) {
    return res.status(404).json({ error: 'Link publik tidak ditemukan atau sudah kedaluwarsa.' });
  }

  const { data, error } = await supabase.from('penyelesaian_anomali').select('*, daftar_survei(nama_survei)').eq('id', share.id_penyelesaian).maybeSingle();
  if (error) return handleSupabaseError(res, error);
  if (!data) return res.status(404).json({ error: 'Data penyelesaian tidak ditemukan.' });
  res.json({ penyelesaian: data, permission: share.permission, allowed_sheets: share.allowed_sheets || [] });
});

module.exports = router;
module.exports.publicRouter = publicRouter;
