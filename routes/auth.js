const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { signToken, hashPassword, sanitizeUser, authenticateToken } = require('../utils/auth');

const getUserByEmail = async (email) => {
  if (!email) return null;
  const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

const getUserById = async (id) => {
  if (!id) return null;
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// router.post('/register', async (req, res) => {
//   const { email, password, role = 'admin', name } = req.body;

//   if (!email || !password || !name) {
//     return res.status(400).json({ error: 'Email , Nama, dan password wajib diisi.' });
//   }

//   if (String(password).length < 6) {
//     return res.status(400).json({ error: 'Password minimal 6 karakter.' });
//   }

//   try {
//     const existingUser = await getUserByEmail(email);
//     if (existingUser) {
//       return res.status(409).json({ error: 'Email sudah terdaftar.' });
//     }

//     const hashedPassword = hashPassword(password);

//     const { data, error } = await supabase
//       .from('users')
//       .insert([
//         {
//           email,
//           name,
//           password: hashedPassword,
//           role,
//         },
//       ])
//       .select();

//     if (error) {
//       throw error;
//     }

//     const createdUser = data?.[0];
//     return res.status(201).json({
//       message: 'User berhasil dibuat.',
//       user: sanitizeUser(createdUser),
//     });
//   } catch (error) {
//     console.error('Register error:', error);
//     return res.status(500).json({ error: error.message || 'Registrasi gagal.' });
//   }
// });

const normalizePasswordValue = (user, password) => {
  if (!user) return null;

  const storedPassword = user.password ?? user.password_hash ?? user.hashed_password ?? null;
  if (storedPassword == null) return null;

  const hashedInput = hashPassword(password);
  return storedPassword === hashedInput || storedPassword === password;
};

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi.' });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    const passwordMatches = normalizePasswordValue(user, password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Password salah.' });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role || 'user',
    });

    return res.json({
      message: 'Login berhasil.',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: error.message || 'Login gagal.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email wajib diisi.' });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User dengan email tersebut tidak ditemukan.' });
    }

    const resetToken = signToken(
      {
        id: user.id,
        email: user.email,
        purpose: 'reset_password',
      },
      { expiresIn: '30m' },
    );

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const updatePayload = {
      reset_token: resetToken,
      reset_token_expires_at: expiresAt,
    };

    const { error: updateError } = await supabase.from('users').update(updatePayload).eq('id', user.id);

    if (updateError) {
      console.warn('Reset token storage warning:', updateError.message);
    }

    return res.json({
      message: 'Token reset password berhasil dibuat.',
      resetToken,
      expiresAt,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: error.message || 'Gagal membuat token reset password.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token dan password baru wajib diisi.' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter.' });
  }

  try {
    const decoded = require('../utils/auth').verifyToken(token);
    if (decoded.purpose !== 'reset_password') {
      return res.status(401).json({ error: 'Token reset password tidak valid.' });
    }

    const user = await getUserById(decoded.id || decoded.sub);
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan untuk reset password.' });
    }

    const normalizedPassword = hashPassword(password);
    const updatePayload = {
      password: normalizedPassword,
      password_hash: normalizedPassword,
      reset_token: null,
      reset_token_expires_at: null,
    };

    const { error: updateError } = await supabase.from('users').update(updatePayload).eq('id', user.id);

    if (updateError) {
      console.error('Reset password update error:', updateError);
      return res.status(500).json({ error: 'Gagal memperbarui password.' });
    }

    return res.json({
      message: 'Password berhasil direset.',
      user: sanitizeUser({ ...user, password: undefined, password_hash: undefined }),
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(401).json({ error: 'Token reset password tidak valid atau sudah kedaluwarsa.' });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  res.json({
    message: 'Logout berhasil. Hapus token dari client.',
    user: sanitizeUser(req.user),
  });
});

module.exports = router;
