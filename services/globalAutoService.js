const axios = require('axios');

const WIALON_API_URL = process.env.WIALON_API_URL || 'https://hst-api.wialon.com/wialon/ajax.html';

// Data flags for core/search_items on avl_unit:
//   1    — general properties (includes unit name `nm`)
//   256  — advanced properties (includes unique ID / IMEI `uid`)
//   1024 — last message/position data (`pos`)
// Combined: 1 + 256 + 1024 = 1281
const UNIT_DATA_FLAGS = 1281;

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

// ─── Step 2: Search avl_unit items ────────────────────────────────────────────

const searchUnits = async (sid) => {
    console.log(`[UNITS] Searching avl_unit items (flags=${UNIT_DATA_FLAGS})...`);

    const res = await wialonCall('GET', 'core/search_items', {
        spec: {
            itemsType: 'avl_unit',
            propName: 'sys_name',
            propValueMask: '*',
            sortType: 'sys_name'
        },
        force: 1,
        flags: UNIT_DATA_FLAGS,
        from: 0,
        to: 0
    }, sid);

    if (res.data.error) {
        console.error(`[UNITS] search_items failed — Wialon error code: ${res.data.error}`);
        if (res.data.error === 7) {
            return { status: 'ACCESS_DENIED' };
        }
        throw new Error(`WIALON_SEARCH_ERROR:${res.data.error}`);
    }

    const items = res.data?.items ?? [];
    console.log(`[UNITS] search_items returned ${items.length} unit(s) (totalItemsCount=${res.data?.totalItemsCount ?? 0}).`);
    // DEBUG: dump raw keys + uid for the first unit to confirm what Wialon actually returns
    if (items.length > 0) {
        console.log(`[UNITS][DEBUG] first item keys: [${Object.keys(items[0]).join(', ')}]`);
        console.log(`[UNITS][DEBUG] first item uid="${items[0].uid}" (type: ${typeof items[0].uid})`);
    }
    return { status: 'SUCCESS', items };
};

// ─── Step 3: Normalize a single unit ──────────────────────────────────────────
// pos: { t: time (unix), y: latitude, x: longitude, z: altitude, s: speed, c: course, sc: satellites }

const toIST = (unix) =>
    new Date(unix * 1000).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true
    }) + ' IST';

const normalizeUnit = (item) => {
    const pos = item.pos ?? null;

    return {
        id: item.id,
        name: item.nm ?? '',
        uid: item.uid ?? '',          // unique ID / IMEI
        position: pos
            ? {
                latitude: pos.y ?? null,
                longitude: pos.x ?? null,
                altitude: pos.z ?? null,
                speed: pos.s ?? null,
                course: pos.c ?? null,
                satellites: pos.sc ?? null,
                time: pos.t ?? null,
                timeFormatted: pos.t ? toIST(pos.t) : null
            }
            : null
    };
};

// ─── Main service function ────────────────────────────────────────────────────

const getUnitsData = async (wialonToken) => {
    // 1. Authenticate — fetch SID from the token
    const { valid, sid } = await authenticateToken(wialonToken);
    if (!valid) {
        return { status: 'INVALID_TOKEN', data: null };
    }

    // 2. Search avl_unit items with name + uid + last position
    const searchResult = await searchUnits(sid);
    if (searchResult.status === 'ACCESS_DENIED') {
        console.warn('[UNITS] Access denied while searching units.');
        return { status: 'ACCESS_DENIED', data: null };
    }

    // 3. Normalize each unit into a clean shape
    const units = searchResult.items.map(normalizeUnit);

    console.log(`[UNITS] Done — ${units.length} unit(s) returned.`);
    return {
        status: 'SUCCESS',
        data: { count: units.length, units }
    };
};

module.exports = { getUnitsData };
