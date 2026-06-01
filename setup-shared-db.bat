@echo off
REM Script para configurar A-Pictures con BD compartida
REM Uso: setup-shared-db.bat \\SERVER\shared\folder

if "%1"=="" (
    echo.
    echo Uso: setup-shared-db.bat "\\SERVIDOR\carpeta\compartida"
    echo.
    echo Ejemplo:
    echo setup-shared-db.bat "\\DESKTOP-PC\shared\apictures"
    echo.
    exit /b 1
)

setlocal enabledelayedexpansion

set SHARED_PATH=%1

REM Verificar que la carpeta existe
if not exist "%SHARED_PATH%" (
    echo Error: La carpeta %SHARED_PATH% no existe o no es accesible
    pause
    exit /b 1
)

REM Crear archivo .env con la configuración
(
    echo # Database Path Configuration
    echo DATABASE_PATH=%SHARED_PATH%\database.db
    echo.
    echo # CORS Configuration
    echo CORS_ORIGIN=http://localhost:3000
) > .env

echo.
echo ✓ Configuración guardada en .env
echo ✓ Base de datos: %SHARED_PATH%\database.db
echo.
echo Ahora ejecuta: node server.js
echo.
pause
