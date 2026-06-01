const express = require('express');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database(path.join(__dirname, 'database.db'), err => {
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
  db.run('INSERT INTO sessions(token, username, expiresAt) VALUES(?,?,?)', [token, username, expiresAt]);
  return token;
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
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
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
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  db.get('SELECT passwordHash FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error interno' });
    }

    if (!row || !verifyPassword(password, row.passwordHash)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = createSession(username);
    res.json({ success: true, token, username });
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

      console.log('[GET /posts] id=', row.id, 'createdAt=', row.createdAt, 'image=', row.image, 'ts=', ts, 'dateStr=', dateStr);

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
  const text = req.body.text || '';
  const tags = req.body.tags || '';
  const image = req.file ? '/uploads/' + req.file.filename : null;
  const createdAt = Date.now();

  console.log('[POST /posts] user=', req.user, 'body=', req.body, 'file=', req.file && { originalname: req.file.originalname, size: req.file.size });

  // Choose insert column names depending on detected schema
  const userCol = postUserCol;
  const createdCol = postCreatedAtCol;
  const sql = `INSERT INTO posts(${userCol}, text, tags, image, likes, ${createdCol}) VALUES(?,?,?,?,0,?)`;
  const params = [req.user, text, tags, image, createdAt];

  db.run(sql, params, function (err) {
    if (err) {
      console.error('[POST /posts] DB error:', err);
      return res.status(500).json({ error: 'No se pudo crear la publicación', detail: err.message });
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