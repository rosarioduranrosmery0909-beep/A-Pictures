const STORAGE_USER_KEY = 'apictures_user';
const STORAGE_TOKEN_KEY = 'apictures_token';

let currentUser = JSON.parse(localStorage.getItem(STORAGE_USER_KEY));
let authToken = localStorage.getItem(STORAGE_TOKEN_KEY);
let posts = [];
let users = [];

function getAuthHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function showApp() {
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadUsers();
  loadPosts();
}

function logout() {
  localStorage.removeItem(STORAGE_USER_KEY);
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  currentUser = null;
  authToken = null;
  location.reload();
}

async function register() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value.trim();

  if (!username || !password) {
    return alert('Completa usuario y contraseña');
  }

  try {
    const response = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();

    if (!response.ok) {
      return alert(data.error || 'No se pudo registrar');
    }

    alert('Usuario registrado correctamente. Inicia sesión para continuar.');
  } catch (error) {
    console.error(error);
    alert('Error al registrar');
  }
}

async function login() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value.trim();

  if (!username || !password) {
    return alert('Completa usuario y contraseña');
  }

  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();

    if (!response.ok) {
      return alert(data.error || 'Usuario o contraseña incorrectos');
    }

    currentUser = { username: data.username };
    authToken = data.token;
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(currentUser));
    localStorage.setItem(STORAGE_TOKEN_KEY, authToken);

    showApp();
  } catch (error) {
    console.error(error);
    alert('Error al iniciar sesión');
  }
}

async function loadUsers() {
  if (!authToken) return;

  try {
    const response = await fetch('/users', {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      return handleAuthError(response);
    }

    users = await response.json();
    renderUsers();
  } catch (error) {
    console.error(error);
  }
}

async function loadPosts() {
  if (!authToken) return;

  try {
    const response = await fetch('/posts', {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      return handleAuthError(response);
    }

    posts = await response.json();
    renderPosts();
  } catch (error) {
    console.error(error);
  }
}

async function addPost() {
  if (!currentUser) {
    return alert('Debes iniciar sesión');
  }

  const text = document.getElementById('text').value.trim();
  const tags = document.getElementById('tags').value.trim();
  const image = document.getElementById('imageInput').files[0];

  if (!text || !image) {
    return alert('Debes escribir una descripción y seleccionar una imagen');
  }

  const formData = new FormData();
  formData.append('text', text);
  formData.append('tags', tags);
  formData.append('image', image);

  try {
    const response = await fetch('/posts', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });
    const data = await response.json();

    if (!response.ok) {
      return alert(data.error || 'Error al publicar');
    }

    document.getElementById('text').value = '';
    document.getElementById('tags').value = '';
    document.getElementById('imageInput').value = '';

    loadPosts();
  } catch (error) {
    console.error(error);
    alert('Error al publicar');
  }
}

async function deletePost(id) {
  const confirmDelete = confirm('¿Seguro que deseas eliminar esta publicación?');
  if (!confirmDelete) return;

  try {
    const response = await fetch(`/posts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      return alert('No se pudo eliminar la publicación');
    }

    loadPosts();
  } catch (error) {
    console.error(error);
    alert('Error al eliminar');
  }
}

async function likePost(id) {
  try {
    const response = await fetch(`/posts/${id}/like`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      return alert('No se pudo actualizar el like');
    }

    loadPosts();
  } catch (error) {
    console.error(error);
  }
}

function renderPosts(filteredPosts = posts) {
  const feed = document.getElementById('feed');
  if (!feed) return;

  if (!currentUser) {
    feed.innerHTML = '';
    return;
  }

  if (!filteredPosts.length) {
    feed.innerHTML = '<div class="card"><p>No hay publicaciones aún.</p></div>';
    return;
  }

  feed.innerHTML = filteredPosts
    .map(post => `
      <div class="card post">
        <div class="post-header" style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <b>${post.user}</b><br>
            <small style="color:#94a3b8">${post.date}</small>
          </div>
          ${post.user === currentUser.username ? `
            <div class="post-menu">
              <button class="menu-btn" onclick="toggleMenu(event,this)">⋮</button>
              <div class="dropdown">
                <button onclick="deletePost(${post.id})">Eliminar</button>
              </div>
            </div>
          ` : ''}
        </div>

        <p style="margin-top:12px;white-space:pre-wrap;">${post.text}</p>
        <div class="tags">${post.tags.map(tag => '#' + tag).join(' ')}</div>
        ${post.image ? `<img src="${post.image}" alt="Imagen">` : ''}
        <div style="margin-top:10px; display:flex; gap:10px; align-items:center;">
          <button onclick="likePost(${post.id})" style="width:auto;background:#ff4db8;padding:10px 14px;border:none;border-radius:10px;color:white;">❤️ ${post.likes}</button>
        </div>
      </div>
    `)
    .join('');
}

function renderUsers() {
  const usersList = document.getElementById('usersList');
  if (!usersList) return;

  const search = document.getElementById('userSearch').value.toLowerCase();
  const filteredUsers = users.filter(user => user.username.toLowerCase().includes(search));

  usersList.innerHTML = filteredUsers
    .map(user => `
      <div class="user-item" onclick="viewProfile('${user.username}')">
        <div>
          <strong>@${user.username}</strong><br>
          <small>${user.totalPosts} publicaciones</small>
        </div>
      </div>
    `)
    .join('');
}

function viewProfile(username) {
  const feed = document.getElementById('feed');
  const userPosts = posts.filter(post => post.user === username);

  feed.innerHTML = `
    <div class="card">
      <h2>${username}</h2>
      <p>${userPosts.length} publicaciones</p>
      <button onclick="renderPosts()" style="background:#0b4dbb;">Volver al feed</button>
    </div>
  `;

  if (!userPosts.length) {
    feed.innerHTML += '<div class="card"><p>Este usuario no tiene publicaciones.</p></div>';
    return;
  }

  feed.innerHTML += userPosts
    .map(post => `
      <div class="card post">
        <div><b>@${post.user}</b></div>
        <small style="color:#94a3b8">${post.date}</small>
        <p style="margin-top:10px;white-space:pre-wrap;">${post.text}</p>
        ${post.image ? `<img src="${post.image}" alt="Imagen">` : ''}
        <div style="margin-top:10px;">❤️ ${post.likes}</div>
      </div>
    `)
    .join('');
}

function toggleMenu(event, btn) {
  event.stopPropagation();
  const menu = btn.parentElement;
  document.querySelectorAll('.post-menu').forEach(m => {
    if (m !== menu) m.classList.remove('active');
  });
  menu.classList.toggle('active');
}

window.addEventListener('click', () => {
  document.querySelectorAll('.post-menu').forEach(menu => menu.classList.remove('active'));
});

function handleAuthError(response) {
  if (response.status === 401) {
    alert('Tu sesión expiró. Inicia sesión nuevamente.');
    logout();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (currentUser && authToken) {
    showApp();
  } else {
    document.getElementById('loginBox').style.display = 'block';
    document.getElementById('app').style.display = 'none';
  }
});
