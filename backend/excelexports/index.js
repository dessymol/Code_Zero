// backend/excelexports/index.js
const express = require('express');
const router = express.Router();
const exportRoutes = require('./routes/exportRoutes');

// You can add auth middleware here if you want to protect all /api/export endpoints.
// const auth = require('../middleware/auth');
// router.use(auth);

router.use('/', exportRoutes);
module.exports = router;
