const axios = require('axios');

const WIALON_API_URL = 'https://hst-api.wialon.com/wialon/ajax.html';


// ─── Wialon API helper ────────────────────────────────────────────────────────

const wialonCall = (method, svc, params, sid) =>
    axios({
        method,
        url: WIALON_API_URL,
        params: {
            svc,
            params: JSON.stringify(params),
            ...(sid && { sid })
        }
    });

// ─── Step 1: Authenticate ─────────────────────────────────────────────────────

const authenticateToken = async (wialonToken) => {
    console.log('[AUTH] Initiating Wialon token authentication...');

    const res = await wialonCall('POST', 'token/login', {
        token: wialonToken,
        operateAs: '',
        appName: '',
        checkService: ''
    });

    if (res.data.error || !res.data.eid) {
        console.warn(`[AUTH] Authentication failed — Wialon error code: ${res.data.error ?? 'no eid returned'}`);
        return { valid: false, sid: null };
    }

    console.log('[AUTH] Authentication successful — SID acquired.');
    return { valid: true, sid: res.data.eid };
};

// ─── Step 2: Execute report ───────────────────────────────────────────────────

const executeReport = async (sid, reportId, resourceId, objectId, reportFrom, reportTo) => {
    console.log(`[REPORT] Executing report (templateId=${reportId}, resourceId=${resourceId}, objectId=${objectId}) | from=${reportFrom} to=${reportTo}`);

    const res = await wialonCall('GET', 'report/exec_report', {
        reportResourceId: resourceId,
        reportTemplateId: reportId,
        reportTemplate: null,
        reportObjectId: objectId,
        reportObjectSecId: 0,
        reportObjectIdList: [],
        interval: { from: reportFrom, to: reportTo, flags: 0 }
    }, sid);

    if (res.data.error) {
        console.error(`[REPORT] exec_report failed — Wialon error code: ${res.data.error}`);
        if (res.data.error === 7) {
            return { status: 'ACCESS_DENIED' };
        }
        throw new Error(`WIALON_EXEC_ERROR:${res.data.error}`);
    }

    console.log('[REPORT] Report executed successfully.');
    return res.data;
};

// ─── Step 3: Fetch result rows ────────────────────────────────────────────────

const fetchResultRows = async (sid, tableIndex) => {
    console.log(`[REPORT] Fetching rows for tableIndex=${tableIndex}`);

    const res = await wialonCall('GET', 'report/get_result_rows', {
        tableIndex,
        indexFrom: 0,
        indexTo: 100
    }, sid);

    if (res.data.error) {
        console.error(`[REPORT] get_result_rows failed for tableIndex=${tableIndex} — Wialon error code: ${res.data.error}`);
        throw new Error(`WIALON_ROWS_ERROR:${res.data.error}`);
    }

    console.log(`[REPORT] Retrieved ${res.data.length} row(s) from tableIndex=${tableIndex}`);
    return res.data;
};

// ─── Main service function ────────────────────────────────────────────────────

const getReportData = async (wialonToken, reportId, resourceId, objectId, reportFrom, reportTo) => {
    // 1. Authenticate
    const { valid, sid } = await authenticateToken(wialonToken);
    if (!valid) {
        return { status: 'INVALID_TOKEN', data: null };
    }

    console.log(`[REPORT] Processing reportId=${reportId}, resourceId=${resourceId}`);

    // 2. Execute the report on Wialon
    const execResult = await executeReport(sid, reportId, resourceId, objectId, reportFrom, reportTo);
    if (execResult?.status === 'ACCESS_DENIED') {
        console.warn(`[REPORT] Access denied for reportId=${reportId}, resourceId=${resourceId}`);
        return { status: 'ACCESS_DENIED', data: null };
    }

    // 3. Fetch result rows
    const table0 = await fetchResultRows(sid, 0);

    const toIST = (unix) =>
        new Date(unix * 1000).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: true
        }) + ' IST';

    console.log(`[REPORT] Data ready — ${table0.length} row(s) returned.`);
    return {
        status: 'SUCCESS',
        data: { from: toIST(reportFrom), to: toIST(reportTo), rows: table0 }
    };
};

module.exports = { getReportData };
