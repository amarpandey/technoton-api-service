const express = require('express');
const router = express.Router();
const getVehicleController = require('../controllers/getVehicleController');

router.get('/', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'Vehicle Report Service is running.'
    });
});

router.get('/getReport', getVehicleController);

module.exports = router;
