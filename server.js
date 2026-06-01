const express = require('express');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const fs = require('fs');

const app = express();
// Security: Restrict CORS to localhost (development) or specific origins
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Database path configuration: use env var or default to local database.db
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.db');
console.log(`[DB] Using database at: ${dbPath}`);

const db = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('No se pudo abrir la base de datos', err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    expiresAt INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    text TEXT,
    tags TEXT,
    image TEXT,
    likes INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL
  )`);
  
  // Clean up expired sessions on startup
  db.run('DELETE FROM sessions WHERE expiresAt < ?', [Date.now()], (err) => {
    if (err) console.error('[DB] Error cleaning sessions:', err);
  });
});

// Detect posts table schema to remain compatible with older DB (user vs username, date vs createdAt)
let postUserCol = 'username';
let postCreatedAtCol = 'createdAt';

function detectPostsSchema(callback) {
  db.all("PRAGMA table_info(posts)", [], (err, rows) => {
    if (err || !rows) return callback();
    const cols = rows.map(r => r.name.toLowerCase());
    if (cols.includes('user') && !cols.includes('username')) postUserCol = 'user';
    if (cols.includes('date') && !cols.includes('createdat')) postCreatedAtCol = 'date';
    callback();
  });
}

// run detection at startup
detectPostsSchema(()=>{});

// Clean expired sessions every hour
setInterval(() => {
  db.run('DELETE FROM sessions WHERE expiresAt < ?', [Date.now()], (err) => {
    if (err) console.error('[Cleanup] Error cleaning expired sessions:', err);
  });
}, 60 * 60 * 1000); // 1 hour

// Utility: Sanitize HTML/XSS input
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

// Utility: Validate password strength
function validatePassword(password) {
  if (!password || typeof password !== 'string') return { valid: false, error: 'Contraseña requerida' };
  if (password.length < 6) return { valid: false, error: 'La contraseña debe tener al menos 6 caracteres' };
  if (password.length > 128) return { valid: false, error: 'La contraseña es demasiado larga' };
  return { valid: true };
}

// Utility: Validate image MIME type
function validateImageMIME(mimeType) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  return allowed.includes(mimeType);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage });

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, key] = passwordHash.split(':');
  if (!salt || !key) return false;
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO sessions(token, username, expiresAt) VALUES(?,?,?)', [token, username, expiresAt], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(token);
      }
    });
  }).catch(() => null); // Return null if error
}

function verifyToken(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;

  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  db.get('SELECT username, expiresAt FROM sessions WHERE token = ?', [token], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error interno' });
    }

    if (!row || row.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    req.user = row.username;
    next();
  });
}

app.post('/register', (req, res) => {
  const username = sanitizeInput(req.body.username);
  const password = req.body.password; // Don't sanitize passwords
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  
  if (username.length < 3 || username.length > 32) {
    return res.status(400).json({ error: 'El usuario debe tener entre 3 y 32 caracteres' });
  }
  
  const pwValidation = validatePassword(password);
  if (!pwValidation.valid) {
    return res.status(400).json({ error: pwValidation.error });
  }

  const passwordHash = hashPassword(password);

  db.run('INSERT INTO users(username, passwordHash) VALUES(?, ?)', [username, passwordHash], function (err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ error: 'El usuario ya existe' });
      }
      return res.status(500).json({ error: 'Error al crear el usuario' });
    }

    res.json({ success: true });
  });
});

app.post('/login', (req, res) => {
  const username = sanitizeInput(req.body.username);
  const password = req.body.password;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  db.get('SELECT passwordHash FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error interno' });
    }

    if (!row || !verifyPassword(password, row.passwordHash)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    try {
      const token = await createSession(username);
      if (!token) {
        return res.status(500).json({ error: 'No se pudo crear la sesión' });
      }
      res.json({ success: true, token, username });
    } catch (err) {
      res.status(500).json({ error: 'Error al crear la sesión' });
    }
  });
});

app.get('/users', verifyToken, (req, res) => {
  // Return users with post counts using detected posts user column
  const postCol = postUserCol;
  db.all('SELECT username FROM users ORDER BY username', [], (err, usersRows) => {
    if (err) return res.status(500).json({ error: 'Error al cargar usuarios' });
    const usernames = usersRows.map(r => r.username);
    if (!usernames.length) return res.json([]);
    const placeholders = usernames.map(() => '?').join(',');
    const sql = `SELECT ${postCol} as username, COUNT(id) AS totalPosts FROM posts WHERE ${postCol} IN (${placeholders}) GROUP BY ${postCol}`;
    db.all(sql, usernames, (pe, counts) => {
      if (pe) return res.status(500).json({ error: 'Error al cargar usuarios' });
      const map = {};
      (counts || []).forEach(c => { map[c.username] = c.totalPosts; });
      const result = usernames.map(u => ({ username: u, totalPosts: map[u] || 0 }));
      res.json(result);
    });
  });
});

app.get('/posts', verifyToken, (req, res) => {
  const userCol = postUserCol;
  const createdCol = postCreatedAtCol;
  const sql = `SELECT id, ${userCol} as username, text, tags, image, likes, ${createdCol} as createdAt FROM posts ORDER BY ${createdCol} DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('[GET /posts] DB error:', err);
      return res.status(500).json({ error: 'Error al cargar publicaciones' });
    }

    function extractTimestampFromString(s) {
      if (!s || typeof s !== 'string') return null;
      const m = s.match(/(\d{10,})/);
      if (!m) return null;
      const digits = m[1];
      let n = Number(digits);
      if (Number.isNaN(n)) return null;
      if (digits.length === 10) n = n * 1000; // seconds -> ms
      return n;
    }

    const posts = rows.map(row => {
      let ts = null;
      // numeric timestamps (ms)
      if (typeof row.createdAt === 'number' && row.createdAt > 0) ts = row.createdAt;
      else {
        const asNum = Number(row.createdAt);
        if (!Number.isNaN(asNum) && asNum > 0) {
          // adjust if appears to be seconds
          ts = String(row.createdAt).length === 10 ? asNum * 1000 : asNum;
        } else {
          // try extracting digits from createdAt string
          ts = extractTimestampFromString(String(row.createdAt));
          // if still not found, try extracting from image filename
          if (!ts && row.image) ts = extractTimestampFromString(row.image);
          // fallback to current time
          if (!ts) ts = Date.now();
        }
      }

      const dateStr = new Date(ts).toISOString();

      return {
        id: row.id,
        user: row.username,
        text: row.text,
        tags: row.tags ? row.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
        image: row.image,
        likes: row.likes,
        date: dateStr,
        comments: []
      };
    });

    res.json(posts);
  });
});

app.post('/posts', verifyToken, upload.single('image'), (req, res) => {
  const text = sanitizeInput((req.body.text || '').trim());
  const tags = sanitizeInput((req.body.tags || '').trim());
  
  // Validation
  if (!text || text.length === 0) {
    return res.status(400).json({ error: 'El texto de la publicación es requerido' });
  }
  if (text.length > 5000) {
    return res.status(400).json({ error: 'El texto es demasiado largo (máximo 5000 caracteres)' });
  }
  if (tags.length > 500) {
    return res.status(400).json({ error: 'Las etiquetas son demasiado largas' });
  }

  // Validate image if uploaded
  let image = null;
  if (req.file) {
    if (!validateImageMIME(req.file.mimetype)) {
      // Delete invalid file
      const fs = require('fs');
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Formato de imagen no permitido. Use JPEG, PNG, GIF o WebP' });
    }
    if (req.file.size > 10 * 1024 * 1024) { // 10MB limit
      const fs = require('fs');
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'La imagen es demasiado grande (máximo 10MB)' });
    }
    image = '/uploads/' + req.file.filename;
  }

  const createdAt = Date.now();

  // Choose insert column names depending on detected schema
  const userCol = postUserCol;
  const createdCol = postCreatedAtCol;
  const sql = `INSERT INTO posts(${userCol}, text, tags, image, likes, ${createdCol}) VALUES(?,?,?,?,0,?)`;
  const params = [req.user, text, tags, image, createdAt];

  db.run(sql, params, function (err) {
    if (err) {
      return res.status(500).json({ error: 'No se pudo crear la publicación' });
    }

    res.json({ success: true, id: this.lastID });
  });
});

app.delete('/posts/:id', verifyToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userCol = postUserCol;

  db.get(`SELECT ${userCol} as username FROM posts WHERE id = ?`, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error interno' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    if (row.username !== req.user) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta publicación' });
    }

    db.run('DELETE FROM posts WHERE id = ?', [id], function (err) {
      if (err) {
        return res.status(500).json({ error: 'No se pudo eliminar la publicación' });
      }
      res.json({ success: true });
    });
  });
});

app.post('/posts/:id/like', verifyToken, (req, res) => {
  const id = parseInt(req.params.id, 10);

  db.run('UPDATE posts SET likes = likes + 1 WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error al actualizar likes' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }
    res.json({ success: true });
  });
});

app.post('/logout', verifyToken, (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  db.run('DELETE FROM sessions WHERE token = ?', [token], err => {
    if (err) {
      return res.status(500).json({ error: 'No se pudo cerrar sesión' });
    }
    res.json({ success: true });
  });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(3000, () => {
  console.log('Servidor funcionando en http://localhost:3000');
});