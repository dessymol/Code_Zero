const express = require('express');
const router = express.Router();

const settingsController = require('../controllers/settingsController');
const { adminAuth } = require('../Middleware/authmiddleware');

router.get('/', adminAuth, settingsController.getAllSettings);
router.post('/', adminAuth, settingsController.createSetting);
router.put('/:id', adminAuth, settingsController.updateSetting);
router.delete('/:id', adminAuth, settingsController.deleteSetting);
router.patch('/:id/activate', adminAuth, settingsController.activateSetting);

module.exports = router;

