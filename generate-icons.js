const sharp = require('sharp');

const sizes = [16, 32, 48, 128];

(async () => {
  for (const size of sizes) {
    await sharp('logo.png')
      .resize(size, size)
      .png()
      .toFile(`icons/icon-${size}.png`);
  }
  console.log('Icons generated in /icons');
})();
