@echo off
echo ============================================
echo Quick Fix for Large Files - Safe Approach
echo ============================================
echo.
echo This script will safely remove large files from Git tracking
echo without rewriting history (safer option).
echo.

echo Step 1: Remove large files from Git tracking...
echo.

REM Remove the entire media directory from Git tracking
git rm -r --cached media/ 2>nul
git rm -r --cached temp_uploads/ 2>nul
git rm -r --cached media_files/ 2>nul

echo Step 2: Add updated .gitignore and commit...
echo.

git add .gitignore
git commit -m "Remove media files from Git tracking and update .gitignore

- Stop tracking media/ directory and all uploaded files
- Update .gitignore to prevent future large file commits
- Media files remain on local disk but are excluded from version control
- Fixes GitHub push issues with large files"

echo.
echo Step 3: Try to push...
echo.

git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ============================================
    echo Push failed - trying force push...
    echo ============================================
    echo.
    echo WARNING: This will overwrite the remote repository!
    echo Make sure no one else is working on this repository.
    echo.
    set /p force="Do you want to force push? (y/n): "
    
    if /i "%force%"=="y" (
        git push -f origin main
        echo.
        echo Force push completed!
    ) else (
        echo.
        echo Skipped force push. You may need to resolve this manually.
    )
) else (
    echo.
    echo ============================================
    echo Success! Repository pushed successfully.
    echo ============================================
)

echo.
echo Note: Your media files are still on your local disk in the media/ folder,
echo they're just not tracked by Git anymore.
echo.
pause
