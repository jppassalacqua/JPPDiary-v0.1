
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const app = express();
const PORT = process.env.PORT || 8000;
const DB_FILE = path.join(__dirname, 'gemini_diary.db');

// --- Security Middleware ---

// 1. Basic Security Headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    app.disable('x-powered-by');
    next();
});

// 2. Simple Rate Limiter (In-Memory)
const rateLimitMap = new Map();
const rateLimiter = (windowMs, max) => (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    const requestLog = rateLimitMap.get(ip) || [];
    const requestsInWindow = requestLog.filter(time => time > windowStart);
    
    if (requestsInWindow.length >= max) {
        return res.status(429).json({ error: "Too many requests, please try again later." });
    }
    
    requestsInWindow.push(now);
    rateLimitMap.set(ip, requestsInWindow);
    next();
};

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// Initialize Database
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error('CRITICAL: Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run("PRAGMA foreign_keys = ON"); // Enable FK support
        initDb();
    }
});

// --- Promise Wrappers for SQLite ---
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

function initDb() {
    db.serialize(() => {
        // Users
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT,
            password TEXT,
            displayName TEXT,
            bio TEXT,
            role TEXT,
            preferences TEXT
        )`);

        // Entries (Enhanced with explicit columns for analytics)
        db.run(`CREATE TABLE IF NOT EXISTS entries (
            id TEXT PRIMARY KEY,
            userId TEXT,
            timestamp INTEGER,
            content TEXT,
            mode TEXT,
            mood TEXT, -- Promoted from analysis
            sentimentScore REAL, -- Promoted from analysis
            location_lat REAL, -- Promoted from location
            location_lng REAL, -- Promoted from location
            city TEXT,
            country TEXT,
            analysis TEXT, -- JSON fallback
            location TEXT, -- JSON fallback
            image TEXT, -- Legacy
            audio TEXT, -- Legacy
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        )`);
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_entries_userid ON entries(userId)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_entries_mood ON entries(mood)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_entries_city ON entries(city)`);

        // Media (Normalized)
        db.run(`CREATE TABLE IF NOT EXISTS media (
            id TEXT PRIMARY KEY,
            entryId TEXT NOT NULL,
            type TEXT NOT NULL, -- 'image' | 'video' | 'audio'
            mimeType TEXT,
            data TEXT NOT NULL, -- Base64
            timestamp INTEGER,
            FOREIGN KEY(entryId) REFERENCES entries(id) ON DELETE CASCADE
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_media_entryid ON media(entryId)`);

        // Tags (Normalized)
        db.run(`CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            name TEXT NOT NULL,
            UNIQUE(userId, name),
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Entry Tags Junction
        db.run(`CREATE TABLE IF NOT EXISTS entry_tags (
            entryId TEXT NOT NULL,
            tagId TEXT NOT NULL,
            PRIMARY KEY(entryId, tagId),
            FOREIGN KEY(entryId) REFERENCES entries(id) ON DELETE CASCADE,
            FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE
        )`);

        // Catalog (Entities)
        db.run(`CREATE TABLE IF NOT EXISTS catalog (
            id TEXT PRIMARY KEY,
            userId TEXT,
            name TEXT,
            type TEXT, -- Person, Location, Event, etc.
            description TEXT,
            sourceEntryId TEXT, -- Origin entry
            timestamp INTEGER,
            UNIQUE(userId, name, type), -- Prevent duplicates
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_catalog_userid ON catalog(userId)`);

        // Catalog Tags Junction (New)
        db.run(`CREATE TABLE IF NOT EXISTS catalog_tags (
            catalogId TEXT NOT NULL,
            tagId TEXT NOT NULL,
            PRIMARY KEY(catalogId, tagId),
            FOREIGN KEY(catalogId) REFERENCES catalog(id) ON DELETE CASCADE,
            FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE
        )`);

        // Entry Entities Junction (New - The Missing Link)
        db.run(`CREATE TABLE IF NOT EXISTS entry_entities (
            entryId TEXT NOT NULL,
            catalogId TEXT NOT NULL,
            PRIMARY KEY(entryId, catalogId),
            FOREIGN KEY(entryId) REFERENCES entries(id) ON DELETE CASCADE,
            FOREIGN KEY(catalogId) REFERENCES catalog(id) ON DELETE CASCADE
        )`);

        // Logs
        db.run(`CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            timestamp INTEGER,
            level TEXT,
            source TEXT,
            message TEXT,
            data TEXT
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)`);

        // Settings
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`);
    });
}

// --- Helpers ---
const safeJsonParse = (str, fallback) => {
    try {
        if (!str) return fallback;
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
};

// SECURITY: Sanitize User Object (Strip Password)
const parseUser = (row) => {
    // Destructure password out to exclude it from the returned object
    const { password, ...safeUser } = row;
    return {
        ...safeUser, 
        preferences: safeJsonParse(row.preferences, {})
    };
};

const parseLog = (row) => ({...row, data: safeJsonParse(row.data, null)});

// SECURITY: Error Masking
const handleServerErr = (res, err, context) => {
    console.error(`[SERVER ERROR] ${context}:`, err);
    // Never send raw DB errors to client
    res.status(500).json({ error: "Internal Server Error" });
};

// SECURITY: Input Validation
const isValidUUID = (uuid) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
};

// --- API Routes ---

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Users
app.get('/users', async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM users");
        // Output Sanitization applied here
        res.json(rows.map(parseUser));
    } catch (err) {
        handleServerErr(res, err, 'GET /users');
    }
});

// Apply stricter rate limit to login/creation endpoints
app.post('/users', rateLimiter(15 * 60 * 1000, 50), async (req, res) => {
    const user = req.body;
    
    // Basic Validation
    if (!user.username || !user.id) return res.status(400).json({ error: "Invalid payload" });

    const preferences = JSON.stringify(user.preferences || {});
    try {
        await dbRun(
            `INSERT OR REPLACE INTO users (id, username, password, displayName, bio, role, preferences) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user.id, user.username, user.password, user.displayName, user.bio || '', user.role, preferences]
        );
        res.json({ message: "User saved", id: user.id });
    } catch (err) {
        handleServerErr(res, err, 'POST /users');
    }
});

app.delete('/users/:userId', async (req, res) => {
    if (!isValidUUID(req.params.userId)) return res.status(400).json({ error: "Invalid User ID" });
    try {
        await dbRun("DELETE FROM users WHERE id = ?", [req.params.userId]);
        res.json({ message: "User deleted" });
    } catch (err) {
        handleServerErr(res, err, 'DELETE /users');
    }
});

// Entries
app.get('/entries', async (req, res) => {
    const userId = req.query.userId;
    // Input Validation
    if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: "Invalid or Missing userId" });

    try {
        // Fetch Entries
        const entries = await dbAll("SELECT * FROM entries WHERE userId = ? ORDER BY timestamp DESC", [userId]);
        
        if (entries.length === 0) return res.json([]);

        // Fetch Media
        const entryIds = entries.map(e => e.id);
        const placeholders = entryIds.map(() => '?').join(',');
        const mediaRows = await dbAll(`SELECT * FROM media WHERE entryId IN (${placeholders})`, entryIds);

        // Group Media
        const mediaMap = {};
        mediaRows.forEach(m => {
            if (!mediaMap[m.entryId]) mediaMap[m.entryId] = { images: [], audio: [] };
            if (m.type === 'audio') mediaMap[m.entryId].audio.push(m.data);
            else mediaMap[m.entryId].images.push(m.data);
        });

        // Construct Response
        const response = entries.map(row => {
            const entryMedia = mediaMap[row.id] || { images: [], audio: [] };
            // Legacy compat
            const legacyImages = row.image ? (row.image.startsWith('[') ? safeJsonParse(row.image, []) : [row.image]) : [];
            const legacyAudio = safeJsonParse(row.audio, []);

            return {
                ...row,
                analysis: safeJsonParse(row.analysis, {}),
                location: safeJsonParse(row.location, undefined),
                images: entryMedia.images.length > 0 ? entryMedia.images : legacyImages,
                audio: entryMedia.audio.length > 0 ? entryMedia.audio : legacyAudio
            };
        });

        res.json(response);

    } catch (err) {
        handleServerErr(res, err, 'GET /entries');
    }
});

app.post('/entries', async (req, res) => {
    const entry = req.body;
    
    if (!entry.id || !entry.userId) return res.status(400).json({ error: "Invalid Entry Data" });

    const analysis = JSON.stringify(entry.analysis || {});
    const location = entry.location ? JSON.stringify(entry.location) : null;
    const emptyJson = JSON.stringify([]);

    // Extract Promoted Columns
    const mood = entry.analysis?.mood || 'Neutral';
    const sentiment = entry.analysis?.sentimentScore || 0;
    const lat = entry.location?.lat || null;
    const lng = entry.location?.lng || null;
    const city = entry.city || entry.locationDetails?.city || null;
    const country = entry.country || entry.locationDetails?.country || null;

    try {
        await dbRun("BEGIN TRANSACTION");

        // 1. Save Entry (with new columns)
        await dbRun(
            `INSERT OR REPLACE INTO entries 
            (id, userId, timestamp, content, mode, mood, sentimentScore, location_lat, location_lng, city, country, analysis, location, image, audio) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [entry.id, entry.userId, entry.timestamp, entry.content, entry.mode, mood, sentiment, lat, lng, city, country, analysis, location, null, emptyJson]
        );

        // 2. Media Handling
        await dbRun("DELETE FROM media WHERE entryId = ?", [entry.id]);
        if (entry.images && Array.isArray(entry.images)) {
            for (const imgData of entry.images) {
                const isVideo = imgData.startsWith('data:video');
                await dbRun(`INSERT INTO media (id, entryId, type, data, timestamp) VALUES (?, ?, ?, ?, ?)`,
                    [crypto.randomUUID(), entry.id, isVideo ? 'video' : 'image', imgData, Date.now()]);
            }
        }
        if (entry.audio && Array.isArray(entry.audio)) {
            for (const audioData of entry.audio) {
                await dbRun(`INSERT INTO media (id, entryId, type, data, timestamp) VALUES (?, ?, ?, ?, ?)`,
                    [crypto.randomUUID(), entry.id, 'audio', audioData, Date.now()]);
            }
        }

        // 3. Tag Normalization
        if (entry.analysis && entry.analysis.manualTags) {
            await dbRun("DELETE FROM entry_tags WHERE entryId = ?", [entry.id]);
            for (const tagName of entry.analysis.manualTags) {
                const tagId = crypto.randomUUID();
                await dbRun(`INSERT OR IGNORE INTO tags (id, userId, name) VALUES (?, ?, ?)`, [tagId, entry.userId, tagName]);
                const tagRow = await dbGet("SELECT id FROM tags WHERE userId = ? AND name = ?", [entry.userId, tagName]);
                if (tagRow) await dbRun(`INSERT INTO entry_tags (entryId, tagId) VALUES (?, ?)`, [entry.id, tagRow.id]);
            }
        }

        // 4. Auto-Cataloging & Entity Linking
        if (entry.analysis && entry.analysis.entities) {
            await dbRun("DELETE FROM entry_entities WHERE entryId = ?", [entry.id]);
            
            for (const ent of entry.analysis.entities) {
                // Try to find existing entity for user
                let catalogRow = await dbGet("SELECT id FROM catalog WHERE userId = ? AND name = ? AND type = ?", [entry.userId, ent.name, ent.type]);
                
                // Create if missing (Auto-Catalog)
                if (!catalogRow) {
                    const newId = crypto.randomUUID();
                    await dbRun(
                        `INSERT INTO catalog (id, userId, name, type, description, sourceEntryId, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [newId, entry.userId, ent.name, ent.type, "Auto-generated from entry", entry.id, Date.now()]
                    );
                    catalogRow = { id: newId };
                }

                // Link Entry <-> Entity
                await dbRun(`INSERT OR IGNORE INTO entry_entities (entryId, catalogId) VALUES (?, ?)`, [entry.id, catalogRow.id]);
            }
        }

        await dbRun("COMMIT");
        res.json({ message: "Entry saved", id: entry.id });

    } catch (err) {
        await dbRun("ROLLBACK");
        handleServerErr(res, err, 'POST /entries');
    }
});

app.delete('/entries/:entryId', async (req, res) => {
    if (!isValidUUID(req.params.entryId)) return res.status(400).json({ error: "Invalid Entry ID" });
    try {
        await dbRun("DELETE FROM entries WHERE id = ?", [req.params.entryId]);
        res.json({ message: "Entry deleted" });
    } catch (err) {
        handleServerErr(res, err, 'DELETE /entries');
    }
});

// Catalog (Enhanced)
app.get('/catalog', async (req, res) => {
    const userId = req.query.userId;
    if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: "Invalid or Missing userId" });
    try {
        const rows = await dbAll("SELECT * FROM catalog WHERE userId = ? ORDER BY name ASC", [userId]);
        // Note: For now we return raw rows, in future we could join catalog_tags
        res.json(rows.map(row => ({...row, tags: []}))); // Todo: Fetch real tags if needed
    } catch (err) {
        handleServerErr(res, err, 'GET /catalog');
    }
});

app.post('/catalog', async (req, res) => {
    const item = req.body;
    try {
        await dbRun("BEGIN TRANSACTION");
        await dbRun(
            `INSERT OR REPLACE INTO catalog (id, userId, sourceEntryId, name, type, description, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [item.id, item.userId, item.sourceEntryId, item.name, item.type, item.description, item.timestamp]
        );
        
        // Handle Catalog Tags
        if (item.tags && Array.isArray(item.tags)) {
            await dbRun("DELETE FROM catalog_tags WHERE catalogId = ?", [item.id]);
            for (const tagName of item.tags) {
                const tagId = crypto.randomUUID();
                await dbRun(`INSERT OR IGNORE INTO tags (id, userId, name) VALUES (?, ?, ?)`, [tagId, item.userId, tagName]);
                const tagRow = await dbGet("SELECT id FROM tags WHERE userId = ? AND name = ?", [item.userId, tagName]);
                if (tagRow) await dbRun(`INSERT INTO catalog_tags (catalogId, tagId) VALUES (?, ?)`, [item.id, tagRow.id]);
            }
        }

        await dbRun("COMMIT");
        res.json({ message: "Catalog item saved", id: item.id });
    } catch (err) {
        await dbRun("ROLLBACK");
        handleServerErr(res, err, 'POST /catalog');
    }
});

app.delete('/catalog/:itemId', async (req, res) => {
    if (!isValidUUID(req.params.itemId)) return res.status(400).json({ error: "Invalid Catalog ID" });
    try {
        await dbRun("DELETE FROM catalog WHERE id = ?", [req.params.itemId]);
        res.json({ message: "Catalog item deleted" });
    } catch (err) {
        handleServerErr(res, err, 'DELETE /catalog');
    }
});

// Settings
app.get('/settings', async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM settings");
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = safeJsonParse(row.value, row.value);
        });
        res.json(settings);
    } catch (err) {
        handleServerErr(res, err, 'GET /settings');
    }
});

app.post('/settings', async (req, res) => {
    const settings = req.body;
    try {
        await dbRun("BEGIN TRANSACTION");
        for (const [key, value] of Object.entries(settings)) {
            const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            await dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, valStr]);
        }
        await dbRun("COMMIT");
        res.json({ message: "Settings saved" });
    } catch (err) {
        await dbRun("ROLLBACK");
        handleServerErr(res, err, 'POST /settings');
    }
});

// Logs
app.post('/logs', async (req, res) => {
    const entry = req.body;
    try {
        await dbRun(
            `INSERT INTO logs (id, timestamp, level, source, message, data) VALUES (?, ?, ?, ?, ?, ?)`,
            [entry.id, entry.timestamp, entry.level, entry.source, entry.message, entry.data ? JSON.stringify(entry.data) : null]
        );
        res.json({ success: true });
    } catch (err) {
        // Logs failing to save shouldn't crash the app or leak info
        console.error("Log Error:", err);
        res.status(500).json({ error: "Logging failed" });
    }
});

app.get('/admin/logs', async (req, res) => {
    const limit = req.query.limit || 1000;
    try {
        const rows = await dbAll("SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?", [limit]);
        res.json(rows.map(parseLog));
    } catch (err) {
        handleServerErr(res, err, 'GET /admin/logs');
    }
});

app.delete('/admin/logs', async (req, res) => {
    try {
        await dbRun("DELETE FROM logs WHERE timestamp < ?", [req.query.before]);
        res.json({ deleted: 0 });
    } catch (err) {
        handleServerErr(res, err, 'DELETE /admin/logs');
    }
});

// Admin Export
app.get('/admin/export', async (req, res) => {
    try {
        const backup = { timestamp: Date.now(), users: [], entries: [], catalog: [], media: [], tags: [], entry_tags: [], entry_entities: [], catalog_tags: [] };
        
        // Export with password stripping
        backup.users = (await dbAll("SELECT * FROM users")).map(parseUser);
        
        backup.entries = (await dbAll("SELECT * FROM entries")).map(row => ({...row, analysis: safeJsonParse(row.analysis, {}), location: safeJsonParse(row.location, {})}));
        backup.catalog = await dbAll("SELECT * FROM catalog");
        backup.media = await dbAll("SELECT * FROM media");
        backup.tags = await dbAll("SELECT * FROM tags");
        backup.entry_tags = await dbAll("SELECT * FROM entry_tags");
        backup.entry_entities = await dbAll("SELECT * FROM entry_entities");
        backup.catalog_tags = await dbAll("SELECT * FROM catalog_tags");

        res.json(backup);
    } catch (err) {
        handleServerErr(res, err, 'GET /admin/export');
    }
});

app.post('/admin/import', async (req, res) => {
    const data = req.body;
    try {
        await dbRun("BEGIN TRANSACTION");
        
        // Simplified Import - Overwrites/Merges
        // In real prod, this should likely truncate tables first or handle conflicts more gracefully
        // For now, we assume simple restore.
        
        // 1. Users
        if (data.users) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO users (id, username, password, displayName, bio, role, preferences) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            data.users.forEach(u => stmt.run(u.id, u.username, u.password || 'RESET_ME', u.displayName, u.bio, u.role, JSON.stringify(u.preferences)));
            stmt.finalize();
        }

        // 2. Entries
        if (data.entries) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO entries (id, userId, timestamp, content, mode, mood, sentimentScore, location_lat, location_lng, city, country, analysis, location, image, audio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            data.entries.forEach(e => stmt.run(
                e.id, e.userId, e.timestamp, e.content, e.mode, 
                e.mood || e.analysis.mood, e.sentimentScore || e.analysis.sentimentScore, 
                e.location_lat || e.location?.lat, e.location_lng || e.location?.lng, 
                e.city, e.country, 
                JSON.stringify(e.analysis), e.location?JSON.stringify(e.location):null, null, '[]'
            ));
            stmt.finalize();
        }

        // 3. Media
        if (data.media) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO media (id, entryId, type, mimeType, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)`);
            data.media.forEach(m => stmt.run(m.id, m.entryId, m.type, m.mimeType, m.data, m.timestamp));
            stmt.finalize();
        }

        // 4. Tags & Junctions
        if (data.tags) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO tags (id, userId, name) VALUES (?, ?, ?)`);
            data.tags.forEach(t => stmt.run(t.id, t.userId, t.name));
            stmt.finalize();
        }
        if (data.entry_tags) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO entry_tags (entryId, tagId) VALUES (?, ?)`);
            data.entry_tags.forEach(et => stmt.run(et.entryId, et.tagId));
            stmt.finalize();
        }

        // 5. Catalog
        if (data.catalog) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO catalog (id, userId, sourceEntryId, name, type, description, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            data.catalog.forEach(c => stmt.run(c.id, c.userId, c.sourceEntryId, c.name, c.type, c.description, c.timestamp));
            stmt.finalize();
        }
        
        // 6. New Junctions
        if (data.entry_entities) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO entry_entities (entryId, catalogId) VALUES (?, ?)`);
            data.entry_entities.forEach(ee => stmt.run(ee.entryId, ee.catalogId));
            stmt.finalize();
        }
        if (data.catalog_tags) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO catalog_tags (catalogId, tagId) VALUES (?, ?)`);
            data.catalog_tags.forEach(ct => stmt.run(ct.catalogId, ct.tagId));
            stmt.finalize();
        }

        await dbRun("COMMIT");
        res.json({ message: "Imported successfully" });
    } catch (err) {
        await dbRun("ROLLBACK");
        handleServerErr(res, err, 'POST /admin/import');
    }
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
