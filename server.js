require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const surveiRoutes = require('./routes/survei');
const anomaliRoutes = require('./routes/anomali');
const penyelesaianRoutes = require('./routes/penyelesaian');
const sheetsRoutes = require('./routes/sheets');
const userRoutes = require('./routes/user');
const dashboardRoutes = require('./routes/dashboard');
const { authenticateToken } = require('./utils/auth');
const skemaRoutes = require('./routes/skema');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/survei', authenticateToken, surveiRoutes);
app.use('/api/anomali', authenticateToken, anomaliRoutes);
app.use('/api/penyelesaian/public', penyelesaianRoutes.publicRouter);
app.use('/api/penyelesaian', authenticateToken, penyelesaianRoutes);
app.use('/api/sheets', authenticateToken, sheetsRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/skema', authenticateToken, skemaRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
