@echo off
chcp 65001 >nul
title Control Horario Mistereia - Lanzador
cd /d "%~dp0"

echo ============================================
echo   Control Horario Mistereia
echo   Iniciando tu aplicacion...
echo ============================================
echo.

REM --- Comprobar que las dependencias estan instaladas (primera vez) ---
if not exist "node_modules" (
    echo [1/4] Primera vez: instalando dependencias... esto puede tardar un par de minutos.
    call npm install
    if errorlevel 1 (
        echo.
        echo Ha ocurrido un error instalando las dependencias. Revisa el mensaje de arriba.
        pause
        exit /b 1
    )
) else (
    echo [1/4] Dependencias ya instaladas.
)

REM --- Arrancar la base de datos (PocketBase) en su propia ventana ---
echo [2/4] Arrancando la base de datos...
start "Control Horario - Base de datos (PocketBase)" /min cmd /k "pocketbase\pocketbase.exe serve --http 127.0.0.1:8090 --dir pocketbase\pb_data --migrationsDir pocketbase\pb_migrations"

REM --- Esperar a que la base de datos responda ---
echo [3/4] Esperando a que la base de datos este lista...
set INTENTOS=0
:ESPERAR_BD
set /a INTENTOS+=1
curl -s -o nul -w "%%{http_code}" http://127.0.0.1:8090/api/health > "%TEMP%\ch_health.txt" 2>nul
set /p HTTP_CODE=<"%TEMP%\ch_health.txt"
if "%HTTP_CODE%"=="200" goto BD_LISTA
if %INTENTOS% GEQ 30 (
    echo.
    echo La base de datos esta tardando en arrancar. Revisa la ventana "Base de datos".
    goto BD_LISTA
)
timeout /t 1 /nobreak >nul
goto ESPERAR_BD
:BD_LISTA
echo       Base de datos lista.

REM --- Arrancar la app web en su propia ventana ---
echo [4/4] Arrancando la aplicacion web...
start "Control Horario - Aplicacion web" /min cmd /k "npm run dev"

REM --- Esperar un poco y abrir el navegador ---
echo.
echo Abriendo la aplicacion en tu navegador...
timeout /t 6 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo ============================================
echo   Todo listo. La app esta abierta en tu navegador.
echo   NO cierres las dos ventanas minimizadas
echo   ("Base de datos" y "Aplicacion web"): son
echo   las que hacen que la app funcione.
echo.
echo   Para apagarlo todo, simplemente cierra esas
echo   dos ventanas (o esta).
echo ============================================
echo.
pause
