require('dotenv').config();
const fs = require('fs');
const https = require('https');
const http = require('http');
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

const sslKey  = process.env.SSL_KEY;
const sslCert = process.env.SSL_CERT;
const sslCa   = process.env.SSL_CA;

if (sslKey && sslCert) {
    const sslOptions = {
        key:  fs.readFileSync(sslKey),
        cert: fs.readFileSync(sslCert),
        ...(sslCa && { ca: fs.readFileSync(sslCa) })
    };

    https.createServer(sslOptions, app).listen(port, () => {
        console.log(`[SERVER] HTTPS server running on port ${port}`);
    });
} else {
    http.createServer(app).listen(port, () => {
        console.warn('[SERVER] SSL certs not found in env — running HTTP only on port ' + port);
    });
}
