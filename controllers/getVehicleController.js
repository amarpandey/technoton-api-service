const { getReportData } = require('../services/getVehicleService');

const getVehicleDetails = async (req, res) => {
    const requestId = `REQ-${Date.now()}`;
    console.log(`[${requestId}] Incoming: GET /getReport — IP: ${req.ip}`);

    try {
        const { token, reportId, resourceId, objectId, from, to } = req.query;

        // ── Input validation ───────────────────────────────────────────────────

        if (!token) {
            console.warn(`[${requestId}] Rejected — missing param: token`);
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAM',
                message: 'Missing required parameter: token'
            });
        }

        if (!reportId) {
            console.warn(`[${requestId}] Rejected — missing param: reportId`);
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAM',
                message: 'Missing required parameter: reportId'
            });
        }

        const reportIdNum = parseInt(reportId, 10);
        if (isNaN(reportIdNum) || reportIdNum <= 0) {
            console.warn(`[${requestId}] Rejected — invalid reportId: "${reportId}"`);
            return res.status(400).json({
                success: false,
                code: 'INVALID_PARAM',
                message: 'reportId must be a positive integer'
            });
        }

        if (!objectId) {
            console.warn(`[${requestId}] Rejected — missing param: objectId`);
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAM',
                message: 'Missing required parameter: objectId'
            });
        }

        if (!resourceId) {
            console.warn(`[${requestId}] Rejected — missing param: resourceId`);
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAM',
                message: 'Missing required parameter: resourceId'
            });
        }

        const resourceIdNum = parseInt(resourceId, 10);
        if (isNaN(resourceIdNum) || resourceIdNum <= 0) {
            console.warn(`[${requestId}] Rejected — invalid resourceId: "${resourceId}"`);
            return res.status(400).json({
                success: false,
                code: 'INVALID_PARAM',
                message: 'resourceId must be a positive integer'
            });
        }

        if (!from || !to) {
            console.warn(`[${requestId}] Rejected — missing param: from / to`);
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAM',
                message: 'Missing required parameters: from and to (Unix timestamps in seconds)'
            });
        }

        const reportFrom = parseInt(from, 10);
        const reportTo   = parseInt(to,   10);
        if (isNaN(reportFrom) || isNaN(reportTo) || reportFrom >= reportTo) {
            console.warn(`[${requestId}] Rejected — invalid time range: from=${from} to=${to}`);
            return res.status(400).json({
                success: false,
                code: 'INVALID_PARAM',
                message: '"from" and "to" must be valid Unix timestamps and "from" must be before "to"'
            });
        }

        console.log(`[${requestId}] Params validated — reportId=${reportIdNum} | resourceId=${resourceIdNum} | objectId=${objectId} | from=${reportFrom} | to=${reportTo}`);

        // ── Service call ───────────────────────────────────────────────────────

        const result = await getReportData(token, reportIdNum, resourceIdNum, objectId, reportFrom, reportTo);

        if (result.status === 'INVALID_TOKEN') {
            console.warn(`[${requestId}] Rejected — invalid or expired Wialon token.`);
            return res.status(401).json({
                success: false,
                code: 'INVALID_TOKEN',
                message: 'The provided token is invalid or has expired. Please re-authenticate.'
            });
        }

        if (result.status === 'ACCESS_DENIED') {
            console.warn(`[${requestId}] Rejected — token does not have access to reportId=${reportIdNum}, resourceId=${resourceIdNum}.`);
            return res.status(403).json({
                success: false,
                code: 'ACCESS_DENIED',
                message: 'You do not have permission to access this report. Please check your token and report configuration.'
            });
        }

        const totalRows = (result.data.tables ?? []).reduce((s, t) => s + t.rows.length, 0);
        console.log(`[${requestId}] Success — ${result.data.tables?.length ?? 0} table(s), ${totalRows} total row(s).`);
        return res.status(200).json({
            success: true,
            code: 'OK',
            message: 'Report generated successfully.',
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

module.exports = getVehicleDetails;
