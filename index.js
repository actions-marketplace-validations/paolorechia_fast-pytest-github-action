const core = require('@actions/core');
const cache = require('@actions/cache');
const crypto = require('crypto');
const fs = require('fs');


const wait = require('./wait');
const { spawn } = require('child_process');

run();

const py_get_site_packages = `\
import sys \
print([path for path in sys.path if "site-packages" in path][0])
`

spawn_list = [
 ('python3', ['-m', 'pip', 'install', 'pytest']),
 ('python3', ['-c', py_get_site_packages]) 
]

async function run() {
  try {
    console.log('Starting...')
  } catch (error) {
    core.setFailed(error.message);
  }
}


function hash_file(filename) {
    const fileBuffer = fs.readFileSync(filename);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const hex = hashSum.digest('hex');
    return hex
}

