const express = require('express');
const cors = require('cors');
const vehicleRoutes = require('./routes/getVehicleRoute');

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200,
    methods: 'GET'
};

app.use(cors(corsOptions));
app.set('json spaces', 2);
app.use('/', vehicleRoutes);

// Global error handler — must be registered after routes
app.use((err, _req, res, _next) => {
    console.error('[GLOBAL ERROR]', err.stack);
    res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again later.'
    });
});

app.listen(port, () => {
    console.log(`[SERVER] Nigrani API running on port ${port}`);
});
