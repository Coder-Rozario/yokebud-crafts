const fs = require('fs');
const path = require('path');

// Video compression script using available tools
async function compressVideo() {
  const inputPath = path.join(__dirname, 'src', 'assades', 'Cover Video.mp4');
  const outputPath = path.join(__dirname, 'src', 'assades', 'Cover Video-compressed.mp4');

  console.log('Video compression instructions:');
  console.log('=============================');
  console.log('1. Use an online video compressor like:');
  console.log('   - https://www.freeconvert.com/video-compressor');
  console.log('   - https://www.ilovepdf.com/compress-pdf (for video)');
  console.log('   - https://www.veed.io/tools/video-compressor');
  console.log('');
  console.log('2. Target settings:');
  console.log('   - Resolution: 720p or lower');
  console.log('   - Bitrate: 1-2 Mbps');
  console.log('   - Format: MP4 with H.264 codec');
  console.log('   - Target size: Under 5MB');
  console.log('');
  console.log('3. Alternative: Use HandBrake (free desktop app)');
  console.log('   - Download from: https://handbrake.fr/');
  console.log('   - Use preset: Fast 720p30');
  console.log('');
  console.log(`4. Replace the file: ${outputPath}`);
  console.log('   with the compressed version');
}

compressVideo();