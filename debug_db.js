const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('open err', err);
    process.exit(1);
  }
  console.log('DB opened at', dbPath);

  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (e, rows) => {
    console.log('tables:', e ? e.message : rows);
    db.get("SELECT sql FROM sqlite_master WHERE name='posts'", [], (se, srow) => {
      console.log('posts create sql:', se ? se.message : srow && srow.sql);
    });
    db.all("PRAGMA table_info(posts)", [], (pe2, infoRows) => {
      console.log('posts columns:', pe2 ? pe2.message : infoRows);
    });
    db.all('SELECT id,username,text,tags,image,likes,createdAt FROM posts', [], (pe, prows) => {
      console.log('posts err/rows:', pe ? pe.message : prows);
      db.all('SELECT username FROM users', [], (ue, urows) => {
        console.log('users err/rows:', ue ? ue.message : urows);
        db.all('SELECT token,username,expiresAt FROM sessions', [], (se, srows) => {
          console.log('sessions err/rows:', se ? se.message : srows);
          db.close();
        });
      });
    });
  });
});
