@echo off
echo ============================================
echo Git Repository Cleanup - Remove Large Files
echo ============================================
echo.
echo This script will remove large media files from Git history
echo that are preventing you from pushing to GitHub.
echo.
echo WARNING: This will rewrite Git history!
echo Make sure you have a backup of your work.
echo.
pause

echo.
echo Step 1: Remove large files from Git tracking...
echo.

REM Remove the specific large files mentioned in the error
git rm --cached "media/uploads/originals/1/60710caf-3286-472b-91ff-3d0d86747dc7/House_of_Cards_S1E1.mp4" 2>nul
git rm --cached "media/uploads/originals/1/88680394-8f05-44e9-bf51-cf536be6ecc5/Gilmore Girls-S1E2-720P.mp4" 2>nul
git rm --cached "media/uploads/originals/1/10cfc461-c872-4943-bc69-8b951d574590/The_Big_Bang_Theory_S9E11.mp4" 2>nul
git rm --cached "media/uploads/audio/1/60710caf-3286-472b-91ff-3d0d86747dc7/60710caf-3286-472b-91ff-3d0d86747dc7.wav" 2>nul
git rm --cached "media/uploads/audio/1/88680394-8f05-44e9-bf51-cf536be6ecc5/88680394-8f05-44e9-bf51-cf536be6ecc5.wav" 2>nul

REM Remove all files in media directory from Git tracking
git rm -r --cached media/ 2>nul
git rm -r --cached temp_uploads/ 2>nul
git rm -r --cached media_files/ 2>nul

echo.
echo Step 2: Remove any other large files...
echo.

REM Remove common large file types
git rm --cached *.mp4 2>nul
git rm --cached *.mkv 2>nul
git rm --cached *.avi 2>nul
git rm --cached *.mov 2>nul
git rm --cached *.wav 2>nul
git rm --cached *.mp3 2>nul

echo.
echo Step 3: Commit the removal...
echo.

git add .gitignore
git commit -m "Remove large media files from Git tracking and update .gitignore

- Remove video files (House_of_Cards_S1E1.mp4, Gilmore Girls-S1E2-720P.mp4, etc.)
- Remove audio files (*.wav, *.mp3)
- Update .gitignore to prevent future large file commits
- Media files are now properly excluded from version control"

echo.
echo Step 4: Clean up Git history (optional but recommended)...
echo.
echo This step will remove the large files from Git history entirely.
echo This is recommended to reduce repository size.
echo.
set /p cleanup="Do you want to clean Git history? (y/n): "

if /i "%cleanup%"=="y" (
    echo.
    echo Cleaning Git history... This may take a while.
    echo.
    
    REM Use git filter-branch to remove large files from history
    git filter-branch --force --index-filter "git rm --cached --ignore-unmatch media/uploads/originals/1/60710caf-3286-472b-91ff-3d0d86747dc7/House_of_Cards_S1E1.mp4" --prune-empty --tag-name-filter cat -- --all
    git filter-branch --force --index-filter "git rm --cached --ignore-unmatch media/uploads/originals/1/88680394-8f05-44e9-bf51-cf536be6ecc5/Gilmore\ Girls-S1E2-720P.mp4" --prune-empty --tag-name-filter cat -- --all
    git filter-branch --force --index-filter "git rm --cached --ignore-unmatch media/uploads/originals/1/10cfc461-c872-4943-bc69-8b951d574590/The_Big_Bang_Theory_S9E11.mp4" --prune-empty --tag-name-filter cat -- --all
    git filter-branch --force --index-filter "git rm --cached --ignore-unmatch media/uploads/audio/1/60710caf-3286-472b-91ff-3d0d86747dc7/60710caf-3286-472b-91ff-3d0d86747dc7.wav" --prune-empty --tag-name-filter cat -- --all
    git filter-branch --force --index-filter "git rm --cached --ignore-unmatch media/uploads/audio/1/88680394-8f05-44e9-bf51-cf536be6ecc5/88680394-8f05-44e9-bf51-cf536be6ecc5.wav" --prune-empty --tag-name-filter cat -- --all
    
    echo.
    echo Cleaning up Git references...
    git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
    
    echo.
    echo Git history cleaned successfully!
)

echo.
echo ============================================
echo Cleanup Complete!
echo ============================================
echo.
echo Next steps:
echo 1. Try pushing again: git push -u origin main
echo 2. If you still have issues, you may need to force push: git push -f origin main
echo.
echo Note: The media files are still on your local disk in the media/ folder,
echo they're just not tracked by Git anymore.
echo.
pause
