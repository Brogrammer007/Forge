const pngToIco = require('png-to-ico').default || require('png-to-ico');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createIco() {
    try {
        const inputPath = path.join(__dirname, 'public', 'favicon.png');
        const tempPngPath = path.join(__dirname, 'public', 'temp-icon.png');
        const icoPath = path.join(__dirname, 'public', 'icon.ico');

        console.log('Converting to proper PNG first...');

        // Convert to proper PNG with 256x256 size for ICO
        await sharp(inputPath)
            .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toFile(tempPngPath);

        console.log('Creating ICO from:', tempPngPath);

        const buf = await pngToIco(tempPngPath);
        fs.writeFileSync(icoPath, buf);

        // Cleanup temp file
        fs.unlinkSync(tempPngPath);

        console.log('Successfully created:', icoPath);
    } catch (error) {
        console.error('Error creating ICO:', error);
        process.exit(1);
    }
}

createIco();
