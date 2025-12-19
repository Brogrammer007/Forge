const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceDir = path.join(__dirname, 'dist-electron', 'win-unpacked');
const outputZip = path.join(__dirname, 'public', 'Forge-v1.0.1.zip');
const tempDir = path.join(__dirname, 'dist-electron', 'Forge-Portable');

console.log('📦 Starting portable zip creation...');

try {
    // 1. Clean up previous
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (fs.existsSync(outputZip)) {
        fs.unlinkSync(outputZip);
    }

    // 2. Create structure: Forge-Portable/Forge.exe etc
    console.log('📂 Creating temp structure...');
    fs.mkdirSync(tempDir, { recursive: true });

    // Copy everything from win-unpacked to tempDir
    // using robocopy for speed on windows (or xcopy)
    // /E = recursive, /NFL /NDL = no logging file/dir names (silent), /NJH /NJS = no job header/summary
    try {
        execSync(`robocopy "${sourceDir}" "${tempDir}" /E /NFL /NDL /NJH /NJS`, { stdio: 'inherit' });
    } catch (e) {
        // robocopy returns exit codes > 0 for success (1=files copied)
        if (e.status > 7) throw e;
    }

    // 3. Zip it
    console.log('🤐 Zipping...');
    // Use powershell to zip ensuring the root folder is included
    execSync(`powershell -command "Compress-Archive -Path '${tempDir}' -DestinationPath '${outputZip}' -Force"`, { stdio: 'inherit' });

    // 4. Cleanup
    console.log('🧹 Cleaning up...');
    fs.rmSync(tempDir, { recursive: true, force: true });

    console.log('✅ Portable ZIP created at: ' + outputZip);

} catch (error) {
    console.error('❌ Error creating zip:', error);
    process.exit(1);
}
