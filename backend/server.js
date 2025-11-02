const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// ==================== Constants ====================
const USERS_FILE = path.join(__dirname, 'users.json');
const OMADA_HOST = "https://192.168.0.100:8043";
const OMADA_ID = "260c077715810bb100223cd67fe789dc";
const OP_NAME = "kiosk_op";
const OP_PASS = "soft0802Db!";
const DEFAULT_VID = 100;
const REVEAL_SECONDS = 10;
const DEBUG_LOG = true;
// ===================================================================

// State variables
let CSRF = null;
let OMADA_BASE_ACTIVE = null;
const VARIANT_CACHE = {}; // key: [clientMac, site] -> { payload, mode }
const STORE = {}; // key: [clientMac, site] -> { short_until, seat_at, long_until, seat_chosen }

// Create an axios instance that ignores self-signed certs
const S = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.PORTAL_SECRET || 'change-me',
  resave: false,
  saveUninitialized: true,
}));

// Serve static files from the Vue app
app.use(express.static(path.join(__dirname, '../frontend/dist')));


// ==================== Helper Functions ====================

const log = (...args) => {
  if (DEBUG_LOG) {
    console.log('[DEBUG]', ...args);
  }
};

const now = () => Math.floor(Date.now() / 1000);

const key_of = (ctx) => {
    if (!ctx || !ctx.clientMac) return null;
    return `${ctx.clientMac},${ctx.site || 'Default'}`;
};

const entry_of = (ctx) => {
    const k = key_of(ctx);
    if (k && !STORE[k]) {
        STORE[k] = { short_until: 0, seat_at: 0, long_until: 0, seat_chosen: false };
    }
    return k ? STORE[k] : null;
};

const human_exit = (ctx) => {
    const ssid = (ctx.ssidName || "").trim();
    if (ssid.toLowerCase().startsWith("exit_")) {
        try {
            const n = parseInt(ssid.split("_")[1], 10);
            if (!isNaN(n)) {
                return [`${n}번 비상구`, n];
            }
        } catch (e) {
            // ignore
        }
    }
        return ["비상구(위치 식별 불가)", null];
    };
    
    // ==================== Omada API Functions ====================
    
    async function try_hotspot_login(base) {
        for (const user_key of ["name", "username"]) {
            const url = `${base}/api/v2/hotspot/login`;
            try {
                const r = await S.post(url, { [user_key]: OP_NAME, password: OP_PASS }, { timeout: 5000 });
                log("login try:", url, "status:", r.status, "text:", r.data ? JSON.stringify(r.data).substring(0, 200) : '');
                if (r.status === 200) {
                    const js = r.data;
                    if ((js.errorCode === 0 || js.errorCode === undefined) && js.result && js.result.token) {
                        return js.result.token;
                    }
                }
            } catch (e) {
                log("login exception at", url, "=>", e.message);
            }
        }
        return null;
    }
    
    async function omada_login() {
        global.CSRF = null;
        global.OMADA_BASE_ACTIVE = null;
        const candidates = [];
        if (OMADA_ID) {
            candidates.push(`${OMADA_HOST}/omada/${OMADA_ID}`); // Type A
            candidates.push(`${OMADA_HOST}/${OMADA_ID}`);        // Type B
        }
        candidates.push(OMADA_HOST);                            // Type C
    
        for (const base of candidates) {
            const token = await try_hotspot_login(base);
            if (token) {
                global.CSRF = token;
                global.OMADA_BASE_ACTIVE = base;
                log("login OK. active base =", global.OMADA_BASE_ACTIVE, "csrf =", global.CSRF);
                return true;
            }
        }
    
        throw new Error("핫스팟 로그인 실패: /omada/<ID> 또는 /<ID> 유무, 계정/주소 확인 필요");
    }
    
    function ensure_login() {
        if (! (global.CSRF && global.OMADA_BASE_ACTIVE)) {
            return omada_login();
        }
        return Promise.resolve(true);
    }
    
    async function ext_auth_once(payload) {
        const url = `${global.OMADA_BASE_ACTIVE}/api/v2/hotspot/extPortal/auth`;
        try {
            const r = await S.post(url, payload, { headers: { "Csrf-Token": global.CSRF }, timeout: 5000 });
            const txt = JSON.stringify(r.data);
            const ok = (r.status === 200 && (r.data.errorCode === 0 || r.data.errorCode === undefined));
            log("ext_auth call:", url, "status:", r.status, "ok:", ok,
                "resp:", txt.substring(0, 200),
                "payload:", Object.keys(payload).reduce((acc, key) => {
                    if (!["time", "duration"].includes(key)) acc[key] = payload[key];
                    return acc;
                }, {}));
            return [ok, txt];
        } catch (e) {
            log("ext_auth exception at", url, "=>", e.message);
            return [false, e.message];
        }
    }
    
    function* build_payload_variants(ctx) {
        const clientMac = ctx.clientMac;
        const clientIp = ctx.clientIp;
        const apMac = ctx.apMac || ctx.gatewayMac;
        const gwMac = ctx.gatewayMac || ctx.apMac;
        const site = ctx.site || "Default";
        const ssidName = ctx.ssidName;
        const radioId = ctx.radioId;
        const vid_raw = ctx.vid;
        const vid = (vid_raw && !isNaN(parseInt(vid_raw, 10))) ? parseInt(vid_raw, 10) : DEFAULT_VID;
    
        const mac_sets = [
            { apMac: apMac },
            { gatewayMac: gwMac },
            { apMac: apMac, gatewayMac: gwMac },
        ];
        const extra_sets = [
            { vid: vid },
            ssidName ? { ssidName: ssidName } : {},
            {}, // Nothing extra
        ];
        const auth_types = [4, 8, 1];
    
        for (const mac_set of mac_sets) {
            for (const extra_set of extra_sets) {
                for (const a of auth_types) {
                    let base = { clientMac: clientMac, site: site, authType: a };
                    if (clientIp) base.clientIp = clientIp;
                    if (radioId) {
                        try { base.radioId = parseInt(radioId, 10); } catch (e) { /* ignore */ }
                    }
                    const merged = { ...base, ...Object.fromEntries(Object.entries(mac_set).filter(([, v]) => v)), ...Object.fromEntries(Object.entries(extra_set).filter(([, v]) => v)) };
                    if (!merged.clientMac || !merged.site) {
                        continue;
                    }
                    yield merged;
                }
            }
        }
    }
    
    async function ext_auth_with_fallbacks(ctx, seconds, prefer_duration = false) {
        await ensure_login();
        const key = key_of(ctx);
        const now_ts = now();
    
        // 0) Try cached variant first
        if (key && VARIANT_CACHE[key]) {
            const { p, mode } = VARIANT_CACHE[key];
            const payload = { ...p };
            if (mode === "time") {
                payload.time = (now_ts + seconds) * 1_000_000;
            } else {
                payload.duration = seconds;
            }
            const [ok, txt] = await ext_auth_once(payload);
            if (ok) {
                log("cache hit auth OK for", key, "mode", mode, "payload", p);
                if (prefer_duration && mode !== "duration") {
                    const payload2 = { ...p, duration: seconds };
                    const [ok2, txt2] = await ext_auth_once(payload2);
                    if (ok2) {
                        VARIANT_CACHE[key] = { p, mode: "duration" };
                        log("switched cache to duration for", key);
                    }
                    return [true, (ok2 ? txt2 : txt)];
                }
                return [true, txt];
            } else {
                log("cache hit failed, fallback to brute force", key);
            }
        }
    
        // 1) Brute force
        let last_txt = "";
        for (const p of build_payload_variants(ctx)) {
            const pairs = [["duration", seconds], ["time", (now_ts + seconds) * 1_000_000]];
            if (!prefer_duration) {
                pairs.reverse(); // Try time first
            }
    
            for (const [mode, val] of pairs) {
                const payload = { ...p, [mode]: val };
                const [ok, txt] = await ext_auth_once(payload);
                if (ok) {
                    VARIANT_CACHE[key] = { p, mode };
                    log("learned variant for", key, "mode", mode, "payload", p);
                    return [true, txt];
                }
                last_txt = txt;
            }
        }
    
        return [false, last_txt || "no_variant_matched"];
    }
    
    async function authorize(seconds, prefer_duration = false, req) {
        const ctx = req.session.portal_ctx || {};
        if (!ctx.clientMac) {
            return [false, "no_ctx"];
        }
        return ext_auth_with_fallbacks(ctx, seconds, prefer_duration);
    }


// ==================== User Data Helpers ====================
const readUsers = () => {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        log('Error reading users file:', error);
    }
    return [];
};

const writeUsers = (users) => {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
        log('Error writing users file:', error);
    }
};

// ==================== API Routes ====================

app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }

    const users = readUsers();
    const existingUser = users.find(u => u.username === username);

    if (existingUser) {
        return res.status(409).json({ message: "Username already exists." });
    }

    users.push({ username, password });
    writeUsers(users);

    res.status(201).json({ message: "User created successfully." });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }

    const users = readUsers();
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ message: "Invalid credentials." });
    }

    // User is authenticated, now try to authorize with Omada
    const [ok, msg] = await authorize(86400, true, req);
    if (!ok) {
        // For development, bypass auth if context is missing
        if (msg === "no_ctx") {
            log("DEV MODE: Bypassing Omada auth because no portal context was found.");
        } else {
            log("LONG AUTH FAIL after login:", msg);
            return res.status(500).json({ message: "Authentication successful, but failed to connect to the network." });
        }
    }
    
    const ent = entry_of(req.session.portal_ctx);
    if (ent) {
        ent.long_until = now() + 86400;
    }
    
    req.session.user = { username: user.username }; // Mark user as logged in in the session
    res.json({ message: "Login and network authorization successful." });
});

app.get('/api/me', (req, res) => {
    if (req.session.user) {
        const ctx = req.session.portal_ctx || {};
        const [, loc_num] = human_exit(ctx);
        res.json({
            username: req.session.user.username,
            startNode: `E${loc_num || 1}` // Default to E1 if not found
        });
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

    // ==================== API Routes ====================
    
    app.get('/portal', (req, res) => {
        const keys = [
            "clientMac","clientIp","gatewayMac","apMac","ssidName","radioId",
            "site","portalId","omadaId","t","vid","redirectUrl"
        ];
        req.session.portal_ctx = {};
        keys.forEach(key => {
            if (req.query[key]) {
                req.session.portal_ctx[key] = req.query[key];
            }
        });
        log("Portal context received:", req.session.portal_ctx);
    
        // Redirect to the root of the Vue app.
        // The Vue app will handle the UI and make API calls.
        res.redirect('/');
    });
    
    app.get('/api/status', (req, res) => {
        const ctx = req.session.portal_ctx || {};
        const ent = entry_of(ctx);
        let [loc_text, loc_num] = human_exit(ctx);
    
        // If no valid exit number, default to 1 for testing
        if (!loc_num) {
            loc_num = 1;
            loc_text = "비상구(위치 식별 불가, 기본 E1)";
        }
    
        if (ent && ent.long_until > now()) {
            res.json({
                status: 'authorized',
                location: loc_text,
                expires: ent.long_until,
                exit_param: loc_num
            });
        } else {
            res.json({
                status: 'unauthorized',
                location: loc_text,
                exit_param: loc_num || ''
            });
        }
    });
    
    app.post('/api/connect-long', async (req, res) => {
        const [ok, msg] = await authorize(86400, true, req);
        if (!ok) {
            log("LONG AUTH FAIL at /api/connect-long:", msg);
            return res.status(500).json({ message: "Authorization failed." });
        }
        const ent = entry_of(req.session.portal_ctx);
        if (ent) {
            ent.long_until = now() + 86400;
        }
        res.json({ message: "Authorization successful." });
    });
    
    app.post('/api/kiosk/seat', (req, res) => {
        const { seat } = req.body;
        if (!seat) {
            return res.status(400).json({ message: "Seat number is required." });
        }
        req.session.seat = seat;
        const ent = entry_of(req.session.portal_ctx);
        if (ent) {
            ent.seat_chosen = true;
            ent.seat_at = now();
            log("Kiosk seat chosen:", seat, "at", ent.seat_at);
            res.json({ message: "Seat chosen successfully." });
        } else {
            res.status(400).json({ message: "No client context found." });
        }
    });
    
    app.get('/api/ready', (req, res) => {
        const ent = entry_of(req.session.portal_ctx);
        let left = REVEAL_SECONDS;
        if (ent && ent.seat_at > 0) {
            const elapsed = now() - ent.seat_at;
            left = Math.max(0, REVEAL_SECONDS - elapsed);
        }
        res.json({ left });
    });
    
    
    // ==================== Kiosk Data Helpers ====================
const RESERVATIONS_FILE = path.join(__dirname, 'reservations.json');
const SVG_PATH = path.join(__dirname, '../frontend/public/route.svg');

const readReservations = () => {
    try {
        if (fs.existsSync(RESERVATIONS_FILE)) {
            const data = fs.readFileSync(RESERVATIONS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        log('Error reading reservations file:', error);
    }
    return [];
};

const writeReservations = (reservations) => {
    try {
        fs.writeFileSync(RESERVATIONS_FILE, JSON.stringify(reservations, null, 2));
    } catch (error) {
        log('Error writing reservations file:', error);
    }
};

// ==================== Kiosk API Routes ====================

// Get all reservations
app.get('/api/reservations', (req, res) => {
    const reservations = readReservations();
    const now = new Date().getTime();
    
    // Filter out expired reservations
    const activeReservations = reservations.filter(r => r.expiresAt > now);
    if (activeReservations.length < reservations.length) {
        writeReservations(activeReservations); // Clean up expired ones
    }

    res.json(activeReservations);
});

// Create a new reservation
app.post('/api/reservations', (req, res) => {
    const { seatId, plan, username } = req.body;

    if (!seatId || !plan || !username) {
        return res.status(400).json({ message: 'Seat, plan, and username are required.' });
    }

    const reservations = readReservations();
    const now = new Date().getTime();

    // Check for existing, active reservation for this seat
    const existing = reservations.find(r => r.seatId === seatId && r.expiresAt > now);
    if (existing) {
        return res.status(409).json({ message: 'This seat is already taken.' });
    }

    const newReservation = {
        seatId,
        username,
        startTime: now,
        expiresAt: now + (plan.hours * 60 * 60 * 1000)
    };

    const updatedReservations = reservations.filter(r => r.expiresAt > now); // Clean up expired
    updatedReservations.push(newReservation);
    writeReservations(updatedReservations);

    res.status(201).json({ message: 'Reservation successful.', reservation: newReservation });
});

// Find shortest path
app.post('/api/find-path', (req, res) => {
    let { startNode, endNode } = req.body;
    if (!startNode || !endNode) {
        return res.status(400).json({ message: 'Start and end nodes are required.' });
    }

    // Map N* seat IDs to D* destination nodes
    const seatToDestinationMap = {
        'N1': 'D1',
        'N2': 'D2',
        'N3': 'D3',
        'N4': 'D4',
        'N5': 'D5',
        'N6': 'D6',
        'N7': 'D7',
        'N8': 'D8',
    };

    // Map E* exit nodes to S* pathfinding start nodes
    const exitToPathStartMap = {
        'E1': 'S1',
        'E2': 'S2',
    };

    if (endNode.startsWith('N')) {
        endNode = seatToDestinationMap[endNode];
    }

    if (startNode.startsWith('E')) {
        startNode = exitToPathStartMap[startNode];
    }

    // Ensure startNode and endNode are valid after mapping
    if (!startNode || !endNode) {
        return res.status(400).json({ message: 'Invalid start or end node after mapping.' });
    }

    try {
        // Hardcoded graph edges based on user's input
        const graphEdges = [
            { edgeId: 'DL1', nodes: ['D1', 'd1'] },
            { edgeId: 'DL2', nodes: ['D2', 'd2'] },
            { edgeId: 'DL3', nodes: ['D3', 'd3'] },
            { edgeId: 'DL4', nodes: ['D4', 'd4'] },
            { edgeId: 'DL5', nodes: ['D5', 'd7'] },
            { edgeId: 'DL6', nodes: ['D6', 'd8'] },
            { edgeId: 'DL7', nodes: ['D7', 'd9'] },
            { edgeId: 'DL8', nodes: ['D8', 'd0'] },
            { edgeId: 'DL12', nodes: ['d1', 'd2'] },
            { edgeId: 'DL23', nodes: ['d2', 'd3'] },
            { edgeId: 'DL34', nodes: ['d3', 'd4'] },
            { edgeId: 'DL45', nodes: ['d4', 'd5'] },
            { edgeId: 'DL67', nodes: ['d6', 'd7'] },
            { edgeId: 'DL78', nodes: ['d7', 'd8'] },
            { edgeId: 'DL89', nodes: ['d8', 'd9'] },
            { edgeId: 'DL90', nodes: ['d9', 'd0'] },
            { edgeId: 'DL15', nodes: ['d1', 'd5'] },
            { edgeId: 'DL48', nodes: ['d4', 'd8'] },
            { edgeId: 'SD1', nodes: ['d1', 'S1'] },
            { edgeId: 'SD2', nodes: ['d0', 'S2'] },
            // Add connections for E* to S* nodes
            { edgeId: 'E1_S1', nodes: ['E1', 'S1'] }, // Assuming E1 connects to S1
            { edgeId: 'E2_S2', nodes: ['E2', 'S2'] }, // Assuming E2 connects to S2
        ];

        // 1. Build Graph (Adjacency List) and Edge Map
        const adj = new Map();
        const edgeMap = new Map(); // Map: node1-node2 -> edgeId

        const addConnection = (u, v, edgeId) => {
            if (!adj.has(u)) adj.set(u, []);
            if (!adj.has(v)) adj.set(v, []);
            adj.get(u).push(v);
            adj.get(v).push(u);
            edgeMap.set(`${u}-${v}`, edgeId);
            edgeMap.set(`${v}-${u}`, edgeId);
        };

        graphEdges.forEach(edge => {
            addConnection(edge.nodes[0], edge.nodes[1], edge.edgeId);
        });

        // 2. BFS for shortest path
        const queue = [[startNode, [startNode]]]; // [currentNode, pathArray]
        const visited = new Set([startNode]);

        let foundPath = null;

        while (queue.length > 0) {
            const [currentNode, path] = queue.shift();

            if (currentNode === endNode) {
                foundPath = path;
                break;
            }

            const neighbors = adj.get(currentNode) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    const newPath = [...path, neighbor];
                    queue.push([neighbor, newPath]);
                }
            }
        }

        if (!foundPath) {
            return res.status(404).json({ message: 'Path not found.' });
        }

        // 3. Convert node path to element IDs (nodes + edges)
        const pathElements = new Set(foundPath);
        for (let i = 0; i < foundPath.length - 1; i++) {
            const u = foundPath[i];
            const v = foundPath[i + 1];
            const edgeId = edgeMap.get(`${u}-${v}`);
            if (edgeId) {
                pathElements.add(edgeId);
            }
        }

        res.json({ path: Array.from(pathElements) });

    } catch (error) {
        log('Error in pathfinding:', error);
        res.status(500).json({ message: 'Failed to calculate path.' });
    }
});


    // Catch-all to serve the Vue app's index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
    
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`EgressEasy backend listening on port ${PORT}`);
    });
