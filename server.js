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
app.use('/api/survei', surveiRoutes);
app.use('/api/anomali', authenticateToken, anomaliRoutes);
app.use('/api/public/penyelesaian', penyelesaianRoutes.publicRouter);
app.use('/api/penyelesaian', penyelesaianRoutes);
app.use('/api/sheets', sheetsRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/skema', authenticateToken, skemaRoutes);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
}

module.exports = app;
