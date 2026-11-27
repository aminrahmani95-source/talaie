@echo off
REM ============================================================
REM  Talaie - one-click publish (replaces the Gemini deploy step)
REM  Double-click this file. It saves local changes to GitHub,
REM  checks that everything builds, and publishes the website.
REM  It never force-pushes and never touches the database.
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0"
title Talaie publish

where git >nul 2>nul || (echo [X] Git is not installed on this computer. & goto fail)
where npm >nul 2>nul || (echo [X] Node.js / npm is not installed on this computer. & goto fail)

echo.
echo [1/7] Saving local changes...
git add -A
git reset -q -- .env .env.local .env.production 2>nul
git reset -q -- "talaie-backup-*" "*.zip" 2>nul
git diff --cached --quiet
if errorlevel 1 (
  git commit -q -m "Update from Claude (local changes)" || goto fail
  echo       saved.
) else (
  echo       nothing new to save.
)

echo [2/7] Getting latest version from GitHub...
git pull --rebase origin main
if errorlevel 1 (
  echo [X] Could not merge with GitHub. Nothing was published.
  git rebase --abort >nul 2>nul
  goto fail
)

echo [3/7] Installing packages (can take a few minutes)...
call npm ci
if errorlevel 1 goto fail

echo [4/7] Type check...
call npx tsc --noEmit -p tsconfig.app.json
if errorlevel 1 goto fail

echo [5/7] Automatic tests...
call npx vitest run
if errorlevel 1 goto fail

echo [6/7] Sending code to GitHub...
git push origin main
if errorlevel 1 goto fail

echo [7/7] Building and publishing the website...
call npm run deploy
if errorlevel 1 goto fail

echo.
echo ============================================================
echo   DONE. The site will update in 1-2 minutes:
echo   https://aminrahmani95-source.github.io/talaie/
echo ============================================================
for /f %%h in ('git rev-parse --short HEAD') do echo   commit: %%h
echo.
pause
exit /b 0

:fail
echo.
echo ============================================================
echo   [X] STOPPED. Nothing broken on the live site.
echo   Take a screenshot of this window and send it to Claude.
echo ============================================================
echo.
pause
exit /b 1
