const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function build() {
    try {
        console.log('🚀 Starting Custom Build Process...');

        const distDir = path.join(__dirname, 'dist-electron');

        // Kill potential running instances
        try { execSync('taskkill /F /IM Forge.exe 2>nul'); } catch (e) { }

        if (fs.existsSync(distDir)) {
            console.log('🧹 Cleaning previous build...');
            try {
                fs.rmSync(distDir, { recursive: true, force: true });
            } catch (e) {
                console.warn('⚠️  Could not clean dist directory completely (might be locked). Continuing...');
            }
        }

        // 1. Build Web App & TypeScript
        // Next.js build produces the standalone folder
        console.log('\n📦 Step 1: Building Web App (Next.js) & Electron Main process...');
        try {
            execSync('npm run build:electron', { stdio: 'inherit', shell: true });
        } catch (e) {
            console.error('Build step failed!');
            throw e;
        }

        // 2. Package Electron App (Unpacked only)
        // We use --dir to skip installer creation. We wrap in try-catch because it throws on signing errors 
        // even if the packing succeeded.
        console.log('\n🏗️  Step 2: Packaging Electron App (Unpacked)...');
        try {
            execSync('npx electron-builder --win --dir', { stdio: 'inherit', shell: true });
        } catch (e) {
            console.warn('⚠️  Electron Builder returned an error (likely signing or permissions). Checking if artifact exists...');
        }

        // Define paths
        const distElectron = path.join(__dirname, 'dist-electron', 'win-unpacked');
        const exePath = path.join(distElectron, 'Forge.exe');

        // Verify artifact exists
        if (!fs.existsSync(exePath)) {
            throw new Error(`Build failed: Forge.exe was not created at ${exePath}`);
        }
        console.log('   Forge.exe created successfully.');

        // 3. Manually copy standalone server files
        console.log('\n📂 Step 3: Copying Standalone Server files...');

        // CHANGE: Copy to resources/standalone instead of root standalone
        // This is safer and more standard for Electron apps
        const resourcesDir = path.join(distElectron, 'resources');
        const standaloneDest = path.join(resourcesDir, 'standalone');

        // Source paths
        const standaloneSrc = path.join(__dirname, '.next', 'standalone');
        const publicSrc = path.join(__dirname, 'public');
        const staticSrc = path.join(__dirname, '.next', 'static');

        // Ensure source exists
        if (!fs.existsSync(standaloneSrc)) {
            throw new Error(`Source not found: ${standaloneSrc}. Did Next.js build fail?`);
        }

        // Clean destination if exists
        if (fs.existsSync(standaloneDest)) {
            console.log('   Cleaning previous standalone folder...');
            try {
                fs.rmSync(standaloneDest, { recursive: true, force: true });
            } catch (e) {
                console.warn('   Could not clean folder (might be open), trying to overwrite...');
            }
        }

        // Copy standalone build
        console.log(`   Copying standalone build to: ${standaloneDest}`);
        fs.cpSync(standaloneSrc, standaloneDest, { recursive: true });

        // Copy public folder to standalone/public
        const publicDest = path.join(standaloneDest, 'public');
        if (fs.existsSync(publicSrc)) {
            console.log('   Copying public folder...');
            console.log(`   Source: ${publicSrc}`);
            console.log(`   Destination: ${publicDest}`);
            
            // Remove destination if it exists to ensure clean copy
            if (fs.existsSync(publicDest)) {
                console.log('   Removing existing public folder...');
                fs.rmSync(publicDest, { recursive: true, force: true });
            }
            
            try {
                fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
                console.log(`   ✅ Public folder copied to: ${publicDest}`);
                
                // Verify public folder contents
                if (fs.existsSync(publicDest)) {
                    const publicFiles = fs.readdirSync(publicDest);
                    console.log(`   ✅ Public folder verified with ${publicFiles.length} item(s)`);
                }
            } catch (error) {
                console.error(`   ❌ Failed to copy public folder: ${error.message}`);
                throw error;
            }
        } else {
            console.warn(`   ⚠️  Public source folder not found at: ${publicSrc}`);
        }

        // Copy .next/static to standalone/.next/static
        // WOZNIAK MODE: This is critical for CSS and JS to load!
        const staticDest = path.join(standaloneDest, '.next', 'static');
        if (fs.existsSync(staticSrc)) {
            console.log('   Copying .next/static folder (CRITICAL for CSS/JS)...');
            console.log(`   Source: ${staticSrc}`);
            console.log(`   Destination: ${staticDest}`);
            
            const nextDest = path.join(standaloneDest, '.next');
            if (!fs.existsSync(nextDest)) {
                fs.mkdirSync(nextDest, { recursive: true });
                console.log(`   Created .next directory: ${nextDest}`);
            }

            // Remove destination if it exists to ensure clean copy
            if (fs.existsSync(staticDest)) {
                console.log('   Removing existing static folder...');
                fs.rmSync(staticDest, { recursive: true, force: true });
            }

            // Copy with error handling
            try {
                fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
                console.log(`   ✅ Static files copied to: ${staticDest}`);
            } catch (error) {
                console.error(`   ❌ Failed to copy static files: ${error.message}`);
                throw error;
            }

            // Verify CSS files exist
            if (fs.existsSync(staticDest)) {
                const allFiles = [];
                function getAllFiles(dir, fileList = []) {
                    const files = fs.readdirSync(dir);
                    files.forEach(file => {
                        const filePath = path.join(dir, file);
                        if (fs.statSync(filePath).isDirectory()) {
                            getAllFiles(filePath, fileList);
                        } else {
                            fileList.push(path.relative(staticDest, filePath));
                        }
                    });
                    return fileList;
                }
                const allFilesList = getAllFiles(staticDest);
                const cssFiles = allFilesList.filter(f => f.toString().endsWith('.css'));
                
                if (cssFiles.length > 0) {
                    console.log(`   ✅ CSS files verified: ${cssFiles.length} file(s) found`);
                    cssFiles.forEach(f => console.log(`      - ${f}`));
                } else {
                    console.warn('   ⚠️  No CSS files found in static folder - this might cause styling issues!');
                }
                
                // Also verify the structure
                const cssDir = path.join(staticDest, 'css');
                if (fs.existsSync(cssDir)) {
                    const cssDirFiles = fs.readdirSync(cssDir);
                    console.log(`   ✅ CSS directory exists with ${cssDirFiles.length} file(s)`);
                } else {
                    console.error('   ❌ CSS directory not found after copy!');
                }
            } else {
                console.error('   ❌ Static destination folder does not exist after copy!');
            }
        } else {
            console.error('   ❌ ERROR: .next/static folder not found! CSS will not load!');
            console.error(`   Searched at: ${staticSrc}`);
            throw new Error('Static files not found - build will fail without CSS');
        }

        // WOZNIAK MODE: Also copy the server chunks that Next.js needs
        const serverSrc = path.join(__dirname, '.next', 'server');
        const serverDest = path.join(standaloneDest, '.next', 'server');
        if (fs.existsSync(serverSrc)) {
            console.log('   Copying .next/server folder (required for SSR)...');
            fs.cpSync(serverSrc, serverDest, { recursive: true });
            console.log(`   ✅ Server files copied to: ${serverDest}`);
        }

        // WOZNIAK MODE: Copy loading.html to electron folder in the unpacked directory
        // This is needed because main.js looks for it relative to __dirname
        const loadingHtmlSrc = path.join(__dirname, 'electron', 'loading.html');
        const electronDir = path.join(distElectron, 'resources', 'app.asar.unpacked', 'electron');
        const electronDirAlt = path.join(distElectron, 'resources', 'app', 'electron');
        
        // Also ensure loading.html is in the right place next to main.js
        // Since files are in asar, we need to verify the electron folder setup
        console.log('   Verifying loading.html location...');
        if (fs.existsSync(loadingHtmlSrc)) {
            console.log(`   ✅ loading.html source exists at: ${loadingHtmlSrc}`);
        } else {
            console.error('   ❌ loading.html not found at source!');
        }

        // 4. Create Zip
        console.log('\n📦 Step 4: Creating ZIP archive...');
        const version = require('./package.json').version;
        const zipName = `Forge-v${version}.zip`;
        const distDirBase = path.join(__dirname, 'dist-electron'); // Ensure correct base dist dir
        const zipPath = path.join(distDirBase, zipName);

        // distElectron is the 'win-unpacked' dir already
        const sourceDir = distElectron;

        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

        console.log(`   Zipping ${sourceDir} to ${zipPath}...`);

        try {
            // PowerShell Compress-Archive
            const psCommand = `powershell -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force"`;
            execSync(psCommand, { stdio: 'inherit' });
            console.log(`   ✅ Zip created successfully: ${zipPath}`);
            console.log(`   👉 Ready for upload to GitHub Releases!`);
        } catch (error) {
            console.error('   ❌ Failed to create zip archive. Please zip manually.');
        }

        console.log('\n✅ Build Complete!');
        console.log(`   Executable located at: ${exePath}`);
        console.log(`   Server located at:     ${path.join(resourcesDir, 'standalone/server.js')}`);
        console.log('\n👉 You can now run Forge.exe!');

    } catch (error) {
        console.error('\n❌ Build Failed:', error.message);
        process.exit(1);
    }
}

build();
