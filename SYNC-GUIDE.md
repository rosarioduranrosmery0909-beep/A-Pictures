# 🔄 Guía: Sincronizar A-Pictures entre múltiples PCs

Sigue estos pasos para que las publicaciones se vean en tiempo real entre diferentes computadoras.

## Opción 1: Carpeta Compartida en Windows (Recomendado)

### Paso 1: Crear carpeta compartida en una PC (servidor)

1. En la PC principal, crea una carpeta: `C:\Compartido\apictures`
2. Haz clic derecho → **Propiedades** → **Compartir**
3. Comparte con tus usuarios locales
4. Anota la ruta de red: `\\NOMBRE-PC\Compartido\apictures`

### Paso 2: Configurar en cada PC cliente

En **cada computadora** que tenga A-Pictures:

```bash
# Opción A: Ejecutar script (más fácil)
setup-shared-db.bat "\\NOMBRE-PC\Compartido\apictures"

# Opción B: Manual
# Crear archivo .env con:
DATABASE_PATH=\\NOMBRE-PC\Compartido\apictures\database.db
CORS_ORIGIN=http://localhost:3000
```

### Paso 3: Iniciar servidor

```bash
node server.js
```

Verás en consola:
```
[DB] Using database at: \\NOMBRE-PC\Compartido\apictures\database.db
```

---

## Opción 2: Carpeta Compartida en Linux/Mac (NFS o Samba)

### Paso 1: Montar carpeta compartida

```bash
# Crear punto de montaje
mkdir -p /mnt/shared

# Montar carpeta SMB (Samba)
sudo mount -t cifs //SERVIDOR/shared /mnt/shared -o username=usuario
```

### Paso 2: Configurar base de datos

```bash
./setup-shared-db.sh /mnt/shared/apictures
node server.js
```

---

## Verificación

1. Abre 2 navegadores (o 2 PCs) en `http://localhost:3000`
2. Registra usuarios diferentes
3. Publica una foto desde una PC
4. **En la otra PC, deberías ver la publicación aparecer automáticamente en 5 segundos** ✓

Si no aparece:
- Verifica que ambas PCs accedan a la misma carpeta compartida
- Asegúrate de que `database.db` se actualiza en tiempo real
- Comprueba permisos de lectura/escritura en la carpeta compartida

---

## Solución de problemas

### "Error: carpeta no accesible"
- Verifica la ruta de red con `\\SERVIDOR\carpeta`
- Asegúrate de estar conectado a la red local
- Comprueba permisos: clic derecho carpeta → **Compartir con**

### Las publicaciones no sincronizarán
- Confirma que todas las PCs usan el mismo `DATABASE_PATH`
- Reinicia el servidor en todas las máquinas
- Borra `database.db` local si existe conflicto

### Performance lento con BD remota
- Usa una carpeta compartida en la red local, no en internet
- SQLite no es ideal para acceso remoto; considera PostgreSQL para producción

---

## Configuración de Producción

Para un entorno de producción con múltiples usuarios:

```bash
# Usar PostgreSQL en lugar de SQLite
# npm install pg

# Configurar en server.js para usar PostgreSQL
# DATABASE_URL=postgresql://usuario:contraseña@servidor:5432/apictures
```

Esto permite mejor concurrencia y confiabilidad.
