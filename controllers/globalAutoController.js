const { getUnitsData } = require('../services/globalAutoService');

const getGlobalAutoVehicles = async (req, res) => {
    const requestId = `REQ-${Date.now()}`;
    console.log(`[${requestId}] Incoming: GET /globalauto/getVehicles — IP: ${req.ip}`);

    try {
        const { token } = req.query;

        // ── Input validation ───────────────────────────────────────────────────

        if (!token) {
            console.warn(`[${requestId}] Rejected — missing param: token`);
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAM',
                message: 'Missing required parameter: token'
            });
        }

        console.log(`[${requestId}] Params validated — fetching vehicle units.`);

        // ── Service call ───────────────────────────────────────────────────────

        const result = await getUnitsData(token);

        if (result.status === 'INVALID_TOKEN') {
            console.warn(`[${requestId}] Rejected — invalid or expired Wialon token.`);
            return res.status(401).json({
                success: false,
                code: 'INVALID_TOKEN',
                message: 'The provided token is invalid or has expired. Please re-authenticate.'
            });
        }

        if (result.status === 'ACCESS_DENIED') {
            console.warn(`[${requestId}] Rejected — token does not have access to unit data.`);
            return res.status(403).json({
                success: false,
                code: 'ACCESS_DENIED',
                message: 'You do not have permission to access vehicle units. Please check your token.'
            });
        }

        console.log(`[${requestId}] Success — ${result.data.count} unit(s) returned.`);
        return res.status(200).json({
            success: true,
            code: 'OK',
            message: 'Vehicle units retrieved successfully.',
            data: result.data
        });

    } catch (err) {
        console.error(`[${requestId}] Unhandled error: ${err.message}`);
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred. Please try again later.'
        });
    }
};

module.exports = getGlobalAutoVehicles;
