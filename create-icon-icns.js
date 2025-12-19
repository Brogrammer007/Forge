const fs = require('fs');
const path = require('path');

function createIconICNS() {
    try {
        console.log('🎨 Creating icon.icns from icon.png...');

        const iconPngPath = path.join(__dirname, 'public', 'icon.png');
        const iconIcnsPath = path.join(__dirname, 'public', 'icon.icns');

        // Check if source PNG exists
        if (!fs.existsSync(iconPngPath)) {
            console.warn(`⚠️  Source icon not found: ${iconPngPath}`);
            console.warn('   Build will continue, but electron-builder may use default icon.');
            return; // Don't exit, just warn
        }

        // Check if ICNS already exists
        if (fs.existsSync(iconIcnsPath)) {
            console.log(`   ✅ icon.icns already exists at: ${iconIcnsPath}`);
            return;
        }

        // Try to use png2icons
        try {
            const png2icons = require('png2icons');
            const input = fs.readFileSync(iconPngPath);
            console.log(`   Reading source: ${iconPngPath}`);

            // Try different scaling methods if BILINEAR fails
            let output = null;
            const methods = [
                { name: 'BILINEAR', method: png2icons.BILINEAR },
                { name: 'NEAREST_NEIGHBOR', method: png2icons.NEAREST_NEIGHBOR },
                { name: 'BICUBIC', method: png2icons.BICUBIC },
            ];

            for (const { name, method } of methods) {
                try {
                    output = png2icons.createICNS(input, method, 0);
                    if (output) {
                        console.log(`   ✅ Successfully created ICNS using ${name} method`);
                        break;
                    }
                } catch (e) {
                    // Try next method
                    continue;
                }
            }

            if (output) {
                fs.writeFileSync(iconIcnsPath, output);
                const stats = fs.statSync(iconIcnsPath);
                console.log(`   ✅ icon.icns created successfully at: ${iconIcnsPath}`);
                console.log(`   📦 File size: ${(stats.size / 1024).toFixed(2)} KB`);
                return;
            }
        } catch (error) {
            console.warn(`   ⚠️  png2icons failed: ${error.message}`);
        }

        // If png2icons fails, warn but don't exit
        console.warn('   ⚠️  Could not generate icon.icns automatically.');
        console.warn('   ⚠️  Build will continue, but electron-builder may use default icon.');
        console.warn('   💡 Tip: You can create icon.icns manually on macOS using:');
        console.warn('      iconutil -c icns icon.iconset');
        console.warn('   Or use online tools to convert PNG to ICNS.');

    } catch (error) {
        console.warn('⚠️  Error in icon.icns generation:', error.message);
        console.warn('   Build will continue, but electron-builder may use default icon.');
        // Don't exit - let build continue
    }
}

createIconICNS();
