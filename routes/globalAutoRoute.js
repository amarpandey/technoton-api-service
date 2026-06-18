const express = require('express');
const router = express.Router();
const globalAutoController = require('../controllers/globalAutoController');

router.get('/', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'GlobalAuto Vehicle Service is running.'
    });
});

router.get('/getVehicles', globalAutoController);

module.exports = router;
