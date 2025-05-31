@echo off
echo ============================================
echo Fresh Git Repository Start
echo ============================================
echo.
echo This script will create a fresh Git repository without the large file history.
echo This is the safest and most reliable approach.
echo.
echo WARNING: This will remove all Git history!
echo Make sure you have a backup of your current work.
echo.
set /p confirm="Are you sure you want to proceed? (yes/no): "

if /i not "%confirm%"=="yes" (
    echo Operation cancelled.
    pause
    exit /b
)

echo.
echo Step 1: Backing up current Git config...
echo.

REM Save the current remote URL
for /f "tokens=*" %%i in ('git remote get-url origin 2^>nul') do set REMOTE_URL=%%i
echo Current remote URL: %REMOTE_URL%

echo.
echo Step 2: Removing old Git history...
echo.

REM Remove the .git directory to start fresh
rmdir /s /q .git

echo.
echo Step 3: Initializing fresh Git repository...
echo.

REM Initialize a new Git repository
git init
git branch -M main

echo.
echo Step 4: Adding files to new repository...
echo.

REM Add all files except those in .gitignore
git add .

echo.
echo Step 5: Creating initial commit...
echo.

git commit -m "Initial commit: WhisperX ESL Video App

- Complete Django backend with REST API
- React frontend with Video.js player
- ESL learning features (listen-and-repeat, shadowing)
- File upload and transcription pipeline
- Media files excluded from Git tracking

This is a fresh repository without large file history."

echo.
echo Step 6: Adding remote and pushing...
echo.

if not "%REMOTE_URL%"=="" (
    git remote add origin %REMOTE_URL%
    echo Pushing to: %REMOTE_URL%
    git push -f origin main
    
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo ============================================
        echo Success! Fresh repository created and pushed!
        echo ============================================
        echo.
        echo Your repository now has a clean history without large files.
        echo All your code and configuration is preserved.
        echo Media files remain on your local disk but are not tracked by Git.
    ) else (
        echo.
        echo Push failed. You may need to check your GitHub credentials or network connection.
        echo The fresh repository is ready locally, you can try pushing manually:
        echo git push -f origin main
    )
) else (
    echo.
    echo No remote URL found. You can add it manually:
    echo git remote add origin https://github.com/GIS1974/whisperx_app_3.git
    echo git push -f origin main
)

echo.
echo Step 7: Verifying repository size...
echo.

git count-objects -vH

echo.
echo Repository cleanup complete!
echo.
pause
