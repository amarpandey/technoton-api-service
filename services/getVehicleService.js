const axios = require('axios');

const WIALON_API_URL = process.env.WIALON_API_URL || 'https://hst-api.wialon.com/wialon/ajax.html';

// TODO: remove this limit once testing is complete
const TEST_ROW_LIMIT=2000;


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

// ─── Cell normalizer ──────────────────────────────────────────────────────────
// Wialon cells are either plain strings or objects: { t: "display text", v: raw }

const cellText = (cell) => {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'object') return cell.t ?? '';
    return String(cell);
};

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

    const tables = res.data?.reportResult?.tables ?? [];
    console.log(`[REPORT] Report executed — ${tables.length} table(s) found:`);
    tables.forEach((t, i) =>
        console.log(`  [${i}] name="${t.name}" label="${t.label}" rows=${t.rows} columns=[${(t.header ?? []).join(', ')}]`)
    );

    return res.data;
};

// ─── Step 3: Fetch rows for a single table ────────────────────────────────────

const fetchTableRows = async (sid, tableIndex, rowCount) => {
    const limit = Math.min(rowCount, TEST_ROW_LIMIT);
    console.log(`[REPORT] Fetching table[${tableIndex}] — ${limit} of ${rowCount} row(s)`);

    const res = await wialonCall('GET', 'report/get_result_rows', {
        tableIndex,
        indexFrom: 0,
        indexTo: limit
    }, sid);

    if (res.data.error) {
        console.error(`[REPORT] get_result_rows failed for tableIndex=${tableIndex} — Wialon error code: ${res.data.error}`);
        throw new Error(`WIALON_ROWS_ERROR:${res.data.error}`);
    }

    console.log(`[REPORT] table[${tableIndex}] — retrieved ${res.data.length} row(s)`);
    if (res.data.length > 0) {
        console.log(`[REPORT] table[${tableIndex}] raw cells[0]:`, JSON.stringify(res.data[0].c));
    }

    return res.data;
};

// ─── Step 4: Normalize rows into named-column objects ─────────────────────────

const normalizeRows = (rawRows, headers) =>
    rawRows.map((row) => {
        const cells = (row.c || []).map(cellText);
        if (headers.length > 0) {
            return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
        }
        return cells;
    });

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

    const toIST = (unix) =>
        new Date(unix * 1000).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: true
        }) + ' IST';

    // 3. Iterate over ALL tables in the report result
    const allTables = execResult?.reportResult?.tables ?? [];

    if (allTables.length === 0) {
        console.log('[REPORT] No tables in report result.');
        return {
            status: 'SUCCESS',
            data: { from: toIST(reportFrom), to: toIST(reportTo), tables: [] }
        };
    }

    // 4. Fetch and normalize rows for each table sequentially
    const tables = [];
    for (let i = 0; i < allTables.length; i++) {
        const meta = allTables[i];
        const headers = meta.header ?? [];
        const rowCount = meta.rows ?? 0;

        if (rowCount === 0) {
            console.log(`[REPORT] table[${i}] "${meta.label}" — 0 rows, skipping fetch.`);
            tables.push({ name: meta.name, label: meta.label, headers, rows: [] });
            continue;
        }

        const rawRows = await fetchTableRows(sid, i, rowCount);
        const rows = normalizeRows(rawRows, headers);

        tables.push({ name: meta.name, label: meta.label, headers, rows });
    }

    const totalRows = tables.reduce((sum, t) => sum + t.rows.length, 0);
    console.log(`[REPORT] Done — ${tables.length} table(s), ${totalRows} total row(s) returned.`);

    return {
        status: 'SUCCESS',
        data: { from: toIST(reportFrom), to: toIST(reportTo), tables }
    };
};

module.exports = { getReportData };
