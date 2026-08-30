const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/summary', async (req, res) => {
  try {
    const [surveiCountRes, anomaliCountRes, penyelesaianCountRes, userCountRes, latestSurveiRes] = await Promise.all([
      supabase.from('daftar_survei').select('id', { count: 'exact', head: true }),
      supabase.from('daftar_anomali').select('id', { count: 'exact', head: true }),
      supabase.from('penyelesaian_anomali').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('daftar_survei').select('id, nama_survei, created_at').order('created_at', { ascending: false }).limit(5),
    ]);

    if (surveiCountRes.error) {
      return res.status(500).json({ error: surveiCountRes.error.message });
    }
    if (anomaliCountRes.error) {
      return res.status(500).json({ error: anomaliCountRes.error.message });
    }
    if (penyelesaianCountRes.error) {
      return res.status(500).json({ error: penyelesaianCountRes.error.message });
    }
    if (userCountRes.error) {
      return res.status(500).json({ error: userCountRes.error.message });
    }
    if (latestSurveiRes.error) {
      return res.status(500).json({ error: latestSurveiRes.error.message });
    }

    const surveiList = latestSurveiRes.data || [];
    let ringkasanPerSurvei = [];

    if (surveiList.length > 0) {
      const surveyIds = surveiList.map((survey) => survey.id);

      const [anomaliBySurveyRes, penyelesaianBySurveyRes] = await Promise.all([
        supabase.from('daftar_anomali').select('id, id_survei').in('id_survei', surveyIds),
        supabase.from('penyelesaian_anomali').select('id, id_survei').in('id_survei', surveyIds),
      ]);

      if (anomaliBySurveyRes.error) {
        return res.status(500).json({ error: anomaliBySurveyRes.error.message });
      }
      if (penyelesaianBySurveyRes.error) {
        return res.status(500).json({ error: penyelesaianBySurveyRes.error.message });
      }

      const anomaliBySurvey = anomaliBySurveyRes.data || [];
      const penyelesaianBySurvey = penyelesaianBySurveyRes.data || [];

      const anomaliMap = {};
      const penyelesaianMap = {};

      anomaliBySurvey.forEach((item) => {
        const key = item.id_survei;
        anomaliMap[key] = (anomaliMap[key] || 0) + 1;
      });

      penyelesaianBySurvey.forEach((item) => {
        const key = item.id_survei;
        penyelesaianMap[key] = (penyelesaianMap[key] || 0) + 1;
      });

      ringkasanPerSurvei = surveiList.map((survey) => ({
        id: survey.id,
        nama_survei: survey.nama_survei,
        created_at: survey.created_at,
        total_anomali: anomaliMap[survey.id] || 0,
        total_penyelesaian: penyelesaianMap[survey.id] || 0,
      }));
    }

    const response = {
      stats: {
        total_survei: Number(surveiCountRes.count || 0),
        total_anomali: Number(anomaliCountRes.count || 0),
        total_penyelesaian: Number(penyelesaianCountRes.count || 0),
        total_users: Number(userCountRes.count || 0),
      },
      survei_terbaru: surveiList,
      ringkasan_per_survei: ringkasanPerSurvei,
    };

    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Terjadi kesalahan pada dashboard.' });
  }
});

module.exports = router;
