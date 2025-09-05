#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

function getLibconfsecVersion() {
  if (process.env.LIBCONFSEC_VERSION) {
    return process.env.LIBCONFSEC_VERSION;
  }
  
  try {
    const packageJson = require('../package.json');
    return packageJson.libconfsecVersion || '0.1.0';
  } catch (error) {
    return '0.1.0';
  }
}

const LIBCONFSEC_VERSION = getLibconfsecVersion();
const BASE_URL = 'https://github.com/confidentsecurity/libconfsec/releases/download';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function getPlatformInfo() {
  const platform = process.platform;
  const arch = process.arch;

  const platformMap = {
    darwin: 'darwin',
    linux: 'linux',
  };

  const archMap = {
    x64: 'amd64',
    arm64: 'arm64',
  };

  const osName = platformMap[platform];
  const archName = archMap[arch];

  if (!osName) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  if (!archName) {
    throw new Error(`Unsupported architecture: ${arch}`);
  }

  return {
    osName,
    archName,
  };
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);

    const file = fs.createWriteStream(destination);
    
    const options = {
      headers: {},
    };

    if (GITHUB_TOKEN) {
      options.headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }

    const request = https.get(url, { ...options, agent: false }, response => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        return downloadFile(response.headers.location, destination)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(
          new Error(
            `Failed to download: ${response.statusCode} ${response.statusMessage}`
          )
        );
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', err => {
        fs.unlink(destination, () => {});
        reject(err);
      });
    });

    request.on('error', reject);
  });
}

function extractZip(zipPath, extractDir) {
  try {
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'inherit' });
  } catch (error) {
    throw new Error(`Failed to extract ZIP file: ${error.message}`);
  }
}

async function downloadLibconfsec() {
  const { osName, archName } = getPlatformInfo();
  
  const libDir = path.join(__dirname, '..', 'native', 'lib');
  
  fs.mkdirSync(libDir, { recursive: true });
  
  // Clear existing libconfsec files
  const existingFiles = fs.readdirSync(libDir).filter(f => f.startsWith('libconfsec'));
  existingFiles.forEach(file => {
    fs.unlinkSync(path.join(libDir, file));
  });

  console.log(`Downloading libconfsec for ${osName}-${archName}...`);

  const tag = `libconfsec%2Fv${LIBCONFSEC_VERSION}`;
  const libFilename = `libconfsec_${osName}_${archName}.zip`;
  const shaFilename = `${libFilename}.sha256`;
  
  const libUrl = `${BASE_URL}/${tag}/${libFilename}`;
  const shaUrl = `${BASE_URL}/${tag}/${shaFilename}`;

  const libPath = path.join(libDir, libFilename);
  const shaPath = path.join(libDir, shaFilename);

  try {
    await Promise.all([
      downloadFile(libUrl, libPath),
      downloadFile(shaUrl, shaPath),
    ]);

    console.log('Download completed, extracting...');
    
    extractZip(libPath, libDir);
    
    // Clean up ZIP file
    fs.unlinkSync(libPath);
    
    // Verify extracted files
    const libraryPath = path.join(libDir, 'libconfsec.a');
    const headerPath = path.join(libDir, 'libconfsec.h');
    
    if (!fs.existsSync(libraryPath)) {
      throw new Error('libconfsec.a not found after extraction');
    }
    
    if (!fs.existsSync(headerPath)) {
      throw new Error('libconfsec.h not found after extraction');
    }

    console.log('libconfsec extraction completed successfully');
    console.log(`Library: ${libraryPath} (${fs.statSync(libraryPath).size} bytes)`);
    console.log(`Header: ${headerPath} (${fs.statSync(headerPath).size} bytes)`);
    
  } catch (error) {
    console.error('Failed to download libconfsec:', error.message);
    
    // Clean up partial downloads
    [libPath, shaPath].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    process.exit(1);
  }
}

function checkExistingFiles() {
  const libDir = path.join(__dirname, '..', 'native', 'lib');
  
  const libraryPath = path.join(libDir, 'libconfsec.a');
  const headerPath = path.join(libDir, 'libconfsec.h');

  if (fs.existsSync(libraryPath) && fs.existsSync(headerPath)) {
    console.log('libconfsec files already exist, skipping download');
    return true;
  }

  return false;
}

if (require.main === module) {
  if (process.env.USE_LOCAL_LIBCONFSEC === 'true') {
    console.log('Using local libconfsec (USE_LOCAL_LIBCONFSEC=true)');
    if (!checkExistingFiles()) {
      console.error('Local libconfsec files not found in native/lib/');
      process.exit(1);
    }
    process.exit(0);
  }

  if (process.env.SKIP_LIBCONFSEC_DOWNLOAD === 'true') {
    console.log('Skipping libconfsec download (SKIP_LIBCONFSEC_DOWNLOAD=true)');
    process.exit(0);
  }

  if (!checkExistingFiles()) {
    downloadLibconfsec().catch(console.error);
  }
}
