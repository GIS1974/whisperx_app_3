@echo off
echo ============================================
echo Complete Git Repository Cleanup
echo ============================================
echo.
echo This script will completely remove large files from Git history.
echo WARNING: This will rewrite Git history and cannot be undone!
echo.
echo Make sure you have a backup of your work before proceeding.
echo.
set /p confirm="Are you sure you want to proceed? (yes/no): "

if /i not "%confirm%"=="yes" (
    echo Operation cancelled.
    pause
    exit /b
)

echo.
echo Step 1: Installing git-filter-repo (if not already installed)...
echo.

REM Check if git-filter-repo is available
git filter-repo --help >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo git-filter-repo not found. Installing via pip...
    pip install git-filter-repo
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install git-filter-repo. Please install it manually:
        echo pip install git-filter-repo
        pause
        exit /b 1
    )
)

echo.
echo Step 2: Removing large files from Git history...
echo.

REM Use git-filter-repo to remove large files completely
echo Removing media files from entire Git history...

REM Remove specific large files
git filter-repo --path "media/uploads/originals/" --invert-paths --force
git filter-repo --path "media/uploads/audio/" --invert-paths --force
git filter-repo --path "media/temp_chunks/" --invert-paths --force

REM Remove files by extension
git filter-repo --path-glob "*.mp4" --invert-paths --force
git filter-repo --path-glob "*.mkv" --invert-paths --force
git filter-repo --path-glob "*.avi" --invert-paths --force
git filter-repo --path-glob "*.mov" --invert-paths --force
git filter-repo --path-glob "*.wav" --invert-paths --force
git filter-repo --path-glob "*.mp3" --invert-paths --force

echo.
echo Step 3: Cleaning up Git repository...
echo.

REM Clean up Git references and garbage collect
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo.
echo Step 4: Checking repository size...
echo.

git count-objects -vH

echo.
echo Step 5: Attempting to push to GitHub...
echo.

git remote add origin-backup https://github.com/GIS1974/whisperx_app_3.git 2>nul
git push -f origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Push failed. The repository may still contain large files.
    echo Let's check what large files remain:
    echo.
    
    REM Find large files in the repository
    git rev-list --objects --all | git cat-file --batch-check="%(objecttype) %(objectname) %(objectsize) %(rest)" | sed -n "s/^blob //p" | sort --numeric-sort --key=2 | tail -10
    
    echo.
    echo You may need to manually remove additional large files.
) else (
    echo.
    echo ============================================
    echo Success! Repository cleaned and pushed!
    echo ============================================
    echo.
    echo The large media files have been completely removed from Git history.
    echo Your repository should now be under GitHub's size limits.
)

echo.
echo Note: Your local media files are still on disk, just not tracked by Git.
echo.
pause
