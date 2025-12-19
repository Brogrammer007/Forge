const sharp = require('sharp');
const path = require('path');

async function createFavicons() {
    const inputPath = path.join(__dirname, 'public', 'favicon.png');

    // Create 32x32 favicon
    await sharp(inputPath)
        .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(path.join(__dirname, 'public', 'favicon-32.png'));

    console.log('Created favicon-32.png');

    // Also create proper icon.png 256x256 for electron
    await sharp(inputPath)
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(path.join(__dirname, 'public', 'icon-new.png'));

    console.log('Created icon-new.png');
}

createFavicons().catch(console.error);
