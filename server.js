
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const app = express();
const PORT = process.env.PORT || 8000;
// If running in electron/production, db might need to be in userData, but for simplicity:
const DB_FILE = path.join(__dirname, 'gemini_diary.db');

// Security & Middleware
app.disable('x-powered-by'); 
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// Initialize Database
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT,
            password TEXT,
            displayName TEXT,
            bio TEXT,
            role TEXT,
            preferences TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS entries (
            id TEXT PRIMARY KEY,
            userId TEXT,
            timestamp INTEGER,
            content TEXT,
            mode TEXT,
            analysis TEXT,
            location TEXT,
            image TEXT,
            audio TEXT
        )`);
        
        db.run(`ALTER TABLE entries ADD COLUMN audio TEXT`, (err) => {});

        db.run(`CREATE TABLE IF NOT EXISTS catalog (
            id TEXT PRIMARY KEY,
            userId TEXT,
            sourceEntryId TEXT,
            name TEXT,
            type TEXT,
            description TEXT,
            tags TEXT,
            timestamp INTEGER
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            timestamp INTEGER,
            level TEXT,
            source TEXT,
            message TEXT,
            data TEXT
        )`);

        // NEW: System Settings Table
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`);
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_entries_userid ON entries(userId)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_catalog_userid ON catalog(userId)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)`);
    });
}

// --- Helpers ---
const safeJsonParse = (str, fallback) => {
    try {
        if (!str) return fallback;
        return JSON.parse(str);
    } catch (e) {
        console.warn("JSON Parse Error:", e.message);
        return fallback;
    }
};

const parseUser = (row) => ({...row, preferences: safeJsonParse(row.preferences, {})});
const parseEntry = (row) => ({
    ...row,
    analysis: safeJsonParse(row.analysis, {}),
    location: safeJsonParse(row.location, undefined),
    images: row.image ? (row.image.startsWith('[') ? safeJsonParse(row.image, []) : [row.image]) : [],
    audio: safeJsonParse(row.audio, [])
});
const parseCatalog = (row) => ({...row, tags: safeJsonParse(row.tags, [])});
const parseLog = (row) => ({...row, data: safeJsonParse(row.data, null)});

// --- API Routes ---

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Users
app.get('/users', (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(parseUser));
    });
});

app.post('/users', (req, res) => {
    const user = req.body;
    const preferences = JSON.stringify(user.preferences || {});
    const stmt = db.prepare(`INSERT OR REPLACE INTO users (id, username, password, displayName, bio, role, preferences) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(user.id, user.username, user.password, user.displayName, user.bio || '', user.role, preferences, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User saved", id: user.id });
    });
    stmt.finalize();
});

app.delete('/users/:userId', (req, res) => {
    const userId = req.params.userId;
    db.serialize(() => {
        db.run("DELETE FROM users WHERE id = ?", userId);
        db.run("DELETE FROM entries WHERE userId = ?", userId);
        db.run("DELETE FROM catalog WHERE userId = ?", userId);
        res.json({ message: "User deleted" });
    });
});

// Entries
app.get('/entries', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId parameter" });
    db.all("SELECT * FROM entries WHERE userId = ? ORDER BY timestamp DESC", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(parseEntry));
    });
});

app.post('/entries', (req, res) => {
    const entry = req.body;
    const analysis = JSON.stringify(entry.analysis || {});
    const location = entry.location ? JSON.stringify(entry.location) : null;
    const images = JSON.stringify(entry.images || []);
    const audio = JSON.stringify(entry.audio || []);
    const stmt = db.prepare(`INSERT OR REPLACE INTO entries (id, userId, timestamp, content, mode, analysis, location, image, audio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(entry.id, entry.userId, entry.timestamp, entry.content, entry.mode, analysis, location, images, audio, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Entry saved", id: entry.id });
    });
    stmt.finalize();
});

app.delete('/entries/:entryId', (req, res) => {
    const entryId = req.params.entryId;
    db.run("DELETE FROM entries WHERE id = ?", entryId, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Entry deleted" });
    });
});

// Catalog
app.get('/catalog', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    db.all("SELECT * FROM catalog WHERE userId = ? ORDER BY name ASC", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(parseCatalog));
    });
});

app.post('/catalog', (req, res) => {
    const item = req.body;
    const tags = JSON.stringify(item.tags || []);
    const stmt = db.prepare(`INSERT OR REPLACE INTO catalog (id, userId, sourceEntryId, name, type, description, tags, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(item.id, item.userId, item.sourceEntryId, item.name, item.type, item.description, tags, item.timestamp, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Catalog item saved", id: item.id });
    });
    stmt.finalize();
});

app.delete('/catalog/:itemId', (req, res) => {
    db.run("DELETE FROM catalog WHERE id = ?", req.params.itemId, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Catalog item deleted" });
    });
});

// Settings (NEW)
app.get('/settings', (req, res) => {
    db.all("SELECT * FROM settings", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = safeJsonParse(row.value, row.value);
        });
        res.json(settings);
    });
});

app.post('/settings', (req, res) => {
    const settings = req.body; // { key: value, key2: value2 }
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
        Object.entries(settings).forEach(([key, value]) => {
            const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            stmt.run(key, valStr);
        });
        stmt.finalize();
        db.run("COMMIT", (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Settings saved" });
        });
    });
});

// Admin Import/Export/Logs (Keep existing)
app.get('/admin/export', (req, res) => {
    const backup = { timestamp: Date.now(), users: [], entries: [], catalog: [] };
    db.serialize(() => {
        const p1 = new Promise((resolve) => db.all("SELECT * FROM users", [], (e, r) => { backup.users = r.map(parseUser); resolve(); }));
        const p2 = new Promise((resolve) => db.all("SELECT * FROM entries", [], (e, r) => { backup.entries = r.map(parseEntry); resolve(); }));
        const p3 = new Promise((resolve) => db.all("SELECT * FROM catalog", [], (e, r) => { backup.catalog = r.map(parseCatalog); resolve(); }));
        Promise.all([p1, p2, p3]).then(() => res.json(backup));
    });
});

app.post('/admin/import', (req, res) => {
    const data = req.body;
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        try {
            const insertUser = db.prepare(`INSERT OR REPLACE INTO users (id, username, password, displayName, bio, role, preferences) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            data.users?.forEach(u => insertUser.run(u.id, u.username, u.password, u.displayName, u.bio || '', u.role, JSON.stringify(u.preferences || {})));
            insertUser.finalize();

            const insertEntry = db.prepare(`INSERT OR REPLACE INTO entries (id, userId, timestamp, content, mode, analysis, location, image, audio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            data.entries?.forEach(e => insertEntry.run(e.id, e.userId, e.timestamp, e.content, e.mode, JSON.stringify(e.analysis), e.location?JSON.stringify(e.location):null, JSON.stringify(e.images||[]), JSON.stringify(e.audio||[])));
            insertEntry.finalize();

            const insertCat = db.prepare(`INSERT OR REPLACE INTO catalog (id, userId, sourceEntryId, name, type, description, tags, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            data.catalog?.forEach(c => insertCat.run(c.id, c.userId, c.sourceEntryId, c.name, c.type, c.description, JSON.stringify(c.tags||[]), c.timestamp));
            insertCat.finalize();

            db.run("COMMIT", () => res.json({ message: "Imported" }));
        } catch(e) {
            db.run("ROLLBACK");
            res.status(500).json({error: e.message});
        }
    });
});

app.post('/logs', (req, res) => {
    const entry = req.body;
    db.run(`INSERT INTO logs (id, timestamp, level, source, message, data) VALUES (?, ?, ?, ?, ?, ?)`, 
        [entry.id, entry.timestamp, entry.level, entry.source, entry.message, entry.data ? JSON.stringify(entry.data) : null], 
        (err) => err ? res.status(500).json({error:err}) : res.json({success:true}));
});

app.get('/admin/logs', (req, res) => {
    const limit = req.query.limit || 1000;
    db.all("SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?", [limit], (err, rows) => {
        if (err) return res.status(500).json({error: err});
        res.json(rows.map(parseLog));
    });
});

app.delete('/admin/logs', (req, res) => {
    db.run("DELETE FROM logs WHERE timestamp < ?", [req.query.before], function(err) {
        if (err) return res.status(500).json({error: err});
        res.json({deleted: this.changes});
    });
});

// Static Files
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get(/.*/, (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
