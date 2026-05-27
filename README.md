# A-Pictures

A-Pictures es una aplicación web tipo red social donde los usuarios pueden registrarse, iniciar sesión, publicar imágenes, dar likes y eliminar publicaciones.

## Tecnologías usadas

- HTML
- CSS
- JavaScript
- Node.js
- Express
- SQLite

## Funciones principales

- Registro de usuarios
- Inicio de sesión
- Publicar imágenes
- Eliminar publicaciones
- Likes
- Buscar usuarios
- Perfil de usuarios
- Protección de rutas mediante Authorization

## Seguridad

La aplicación protege las rutas del servidor utilizando autorización mediante headers. También las imágenes se guardan en una carpeta separada llamada uploads para evitar mezclar archivos públicos con datos de usuarios.

## Base de datos

Se utiliza SQLite con el archivo:

database.db

## Instalación

Primero instalar dependencias:

```bash
npm install

``` 

Luego ejecutar:

```bash
node server.js
```

Abrir en el navegador:

```txt
http://localhost:3000
```

## Estructura del proyecto

```txt
/public
/uploads
server.js
database.db
package.json
README.md
informe.md
```