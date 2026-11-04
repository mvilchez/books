const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const coversDir = '/home/marino/Documentos/workspace/books/public/covers';
if (!fs.existsSync(coversDir)) { console.log('No covers dir'); process.exit(0); }

var jpgFiles = fs.readdirSync(coversDir).filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpg?default=false'));
console.log('Found ' + jpgFiles.length + ' JPG-like files in covers/');

for (var i = 0; i < jpgFiles.length; i++) {
  var jpgFile = jpgFiles[i];
  var inputPath = path.join(coversDir, jpgFile);
  var baseName = jpgFile.replace('?default=false', '');
  var webpFile = baseName + '.webp';
  var outputPath = path.join(coversDir, webpFile);
  console.log('Converting: ' + jpgFile + ' -> ' + webpFile);
  try {
    var inputBuf = fs.readFileSync(inputPath);
    var outputBuf = await sharp(inputBuf).webp({ quality: 75 }).toBuffer();
    fs.writeFileSync(outputPath, outputBuf);
    fs.unlinkSync(inputPath);
    console.log('  Converted and deleted original');
  } catch (e) {
    console.log('  ERROR: ' + e.message);
  }
}console.log('Covers done');
