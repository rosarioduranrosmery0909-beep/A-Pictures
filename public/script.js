// ===== USUARIOS =====
let users = JSON.parse(localStorage.getItem("apicturesUsers")) || [];

function saveUsers(){
  localStorage.setItem("apicturesUsers", JSON.stringify(users));
}

// ===== USUARIO ACTIVO (ARREGLADO) =====
let currentUser = null;

// ===== REGISTRO =====
function register(){
  const user = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value.trim();

  if(!user || !pass){
    alert("Completa usuario y contraseña");
    return;
  }

  const exists = users.find(u => u.user === user);

  if(exists){
    alert("Ese usuario ya existe");
    return;
  }

  users.push({user, pass});
  saveUsers();

  alert("Usuario registrado correctamente");
}

// ===== LOGIN (ARREGLADO) =====
function login(){
  const user = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value.trim();

  if(!user || !pass){
    alert("Completa todos los campos");
    return;
  }

  const valid = users.find(u => u.user === user);

  if(!valid){
    alert("Usuario no encontrado");
    return;
  }

  if(valid.pass !== pass){
    alert("Contraseña incorrecta");
    return;
  }

  currentUser = valid;

  localStorage.setItem("ap_user", JSON.stringify(valid));

  alert("Inicio de sesión exitoso");

  document.getElementById("loginBox").style.display = "none";
  document.getElementById("app").style.display = "block";

  render();
}

// ===== CERRAR SESIÓN =====
function logout(){
  localStorage.removeItem("ap_user");

  currentUser = null;

  alert("Sesión cerrada");

  location.reload();
}

// ===== MANTENER SESIÓN (ARREGLADO) =====
window.onload = function(){
  const savedUser = localStorage.getItem("ap_user");

  if(savedUser){
    currentUser = JSON.parse(savedUser);

    document.getElementById("loginBox").style.display = "none";
    document.getElementById("app").style.display = "block";
  }

  render();
}

// ===== POSTS =====


// ===== PUBLICAR (ARREGLADO) =====
function addPost(){

  if(!currentUser){
    alert("Debes iniciar sesión");
    return;
  }

  const user = currentUser.user;
  const text = document.getElementById("text").value.trim();
  const tagsInput = document.getElementById("tags").value.trim();
  const file = document.getElementById("imageInput").files[0];

  if(!text){
    alert("Debes escribir una descripción");
    return;
  }

  if(!file){
    alert("Debes seleccionar una imagen");
    return;
  }

  async function addPost(){

  if(!currentUser){
    alert("Debes iniciar sesión");
    return;
  }

  const text =
  document.getElementById("text").value.trim();

  const tags =
  document.getElementById("tags").value.trim();

  const image =
  document.getElementById("imageInput").files[0];

  if(!text || !image){
    alert("Completa todos los campos");
    return;
  }

  const formData =
  new FormData();

  formData.append(
    "user",
    currentUser.user
  );

  formData.append(
    "text",
    text
  );

  formData.append(
    "tags",
    tags
  );

  formData.append(
    "image",
    image
  );

  try{

    const response =
    await fetch(
      "http://localhost:3000/posts",
      {
        method:"POST",

        headers:{
          Authorization:"Bearer apictures123"
        },

        body:formData
      }
    );

    const data =
    await response.json();

    alert("Publicación creada correctamente");

    document.getElementById("text").value = "";
    document.getElementById("tags").value = "";
    document.getElementById("imageInput").value = "";

    render();

  }catch(error){

    console.log(error);

    alert("Error al publicar");

  }

}
}
posts = posts.filter(p => p.user);

function render(){

  const feed = document.getElementById("feed");

  if(!feed) return;

  feed.innerHTML = "";

  if(!currentUser) return;

  posts.forEach(p => {
    

    feed.innerHTML += `
      <div class="card post">

        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="post-header">

  <div>
    <b>${p.user}</b><br>
    <small style="color:#94a3b8">
      ${p.date}
    </small>
  </div>

  <div class="post-menu">

    <button
    class="menu-btn"
    onclick="toggleMenu(event,this)">
      ⋮
    </button>

    <div class="dropdown">

      <button
      onclick="deletePost(${p.id})">
        Eliminar
      </button>

    </div>

  </div>

</div>
        </div>

        <p style="margin-top:8px">${p.text}</p>

        <div class="tags">
          ${p.tags.map(t => "#" + t.trim()).join(" ")}
        </div>

        <img src="${p.image}">

        <div style="margin-top:10px">
          ❤️ ${p.likes}
        </div>

        <button onclick="like(${p.id})">
          Me gusta
        </button>

        <div class="post-menu">

  <button
  class="menu-btn"
  onclick="toggleMenu(event,this)">
    ⋮
  </button>

  <div class="dropdown">

    <button
    onclick="deletePost(${p.id})">
      Eliminar
    </button>

  </div>

</div>

        <div style="margin-top:10px">
          ${p.comments.map(c => `<div>• ${c}</div>`).join("")}
        </div>

        <input
          placeholder="Escribe un comentario..."
          onkeydown="if(event.key==='Enter'){addComment(${p.id},this.value);this.value=''}"
        >

      </div>
    `;
  });

  renderUsers();
}

// ===== LIKE =====
function like(id){

  posts = posts.map(p => {
    if(p.id === id){
      p.likes++;
    }
    return p;
  });

  savePosts();
  render();
}

// ===== COMENTARIOS =====
function addComment(id, value){

  if(value.trim() === ""){
    alert("Escribe un comentario");
    return;
  }

  posts = posts.map(p => {
    if(p.id === id){
      p.comments.push(value);
    }
    return p;
  });

  savePosts();
  render();
}

// ===== ELIMINAR =====
function deletePost(id){

  const confirmDelete = confirm("¿Seguro que deseas eliminar esta publicación?");

  if(!confirmDelete) return;

  posts = posts.filter(p => p.id !== id);

  savePosts();

  render();
}

// ===== USUARIOS =====
function renderUsers(){

  const usersList = document.getElementById("usersList");

  if(!usersList) return;

  const search = document.getElementById("userSearch").value.toLowerCase();

  usersList.innerHTML = "";

  const filteredUsers = users.filter(u =>
    u.user.toLowerCase().includes(search)
  );

  filteredUsers.forEach(u => {

    const totalPosts = posts.filter(p => p.user === u.user).length;

    usersList.innerHTML += `
      <div class="user-item">

  <div onclick="viewProfile('${u.user}')">

    <b>${u.user}</b><br>

    <small>
      ${totalPosts} publicaciones
    </small>

  </div>

  <div class="post-menu">

    <button
    class="menu-btn"
    onclick="toggleMenu(event,this)">
      ⋮
    </button>

    <div class="dropdown">

      <button
      onclick="deleteUser('${u.user}')">
        Eliminar
      </button>

    </div>

  </div>

</div>
        <b>${u.user}</b><br>

        <small>${totalPosts} publicaciones</small>

      </div>
    `;
  });
}

// ===== PERFIL =====
function viewProfile(username){

  const feed = document.getElementById("feed");

  const userPosts = posts.filter(p => p.user === username);

  feed.innerHTML = `
    <div class="card">
      <h2>${username}</h2>
      <p>${userPosts.length} publicaciones</p>
      <button onclick="render()">Volver al inicio</button>
    </div>
  `;

  userPosts.forEach(p => {

    feed.innerHTML += `
      <div class="card post">
        <b>${p.user}</b>
        <small>${p.date}</small>
        <p>${p.text}</p>
        <img src="${p.image}">
        ❤️ ${p.likes}
      </div>
    `;
  });
}

function deleteUser(username){

  const confirmDelete = confirm("¿Seguro que deseas eliminar este usuario?");

  if(!confirmDelete) return;

  // eliminar usuario
  users = users.filter(u => u.user !== username);

  saveUsers();

  // eliminar posts de ese usuario
  posts = posts.filter(p => p.user !== username);

  localStorage.setItem("apicturesPosts", JSON.stringify(posts));

  alert("Usuario eliminado");

  render();
}

/* MENU */

function toggleMenu(event,btn){

  event.stopPropagation();

  const menu =
  btn.parentElement;

  document
  .querySelectorAll(".post-menu")
  .forEach(m=>{

    if(m !== menu){
      m.classList.remove("active");
    }

  });

  menu.classList.toggle("active");
}

window.addEventListener("click",()=>{

  document
  .querySelectorAll(".post-menu")
  .forEach(menu=>{

    menu.classList.remove("active");

  });

});