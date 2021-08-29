const core = require('@actions/core');
const cache = require('@actions/cache');
const crypto = require('crypto');
const fs = require('fs');

const { spawn } = require('child_process');

let python_path = undefined

function register_proc_handlers(proc, next_step) {

    proc.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`);
    });
    proc.stderr.on('data', (data) => {
          console.error(`stderr: ${data}`);
    });
    proc.on('close', next_step)
}

async function base_step(step_data) {
    console.log('On base step', step_data)
    if (step_data.code === 0) {
        try {
          if (step_data.spawn_hook) {
              proc = step_data.spawn_hook() 
              register_proc_handlers(proc, step_data.next_step)
          }
          if (step_data.next_step && !step_data.spawn_hook) {
              await step_data.next_step(0)
          }
        } catch (error) {
          core.setFailed(error.message);
        }
    } else {
        core.setFailed("Step failed");
    }
}

async function install_pytest(code) {
    console.log('Installing pytest...')
    await base_step(
        {
            name: 'install pytest',
            code,
            spawn_hook: function() {
                return spawn('python3', ['-m', 'pip', 'install', 'pytest'])
            },
            next_step: finish_install_pytest
        }
    )
}

async function finish_install_pytest(code) {
    console.log('Installed pytest.')
    await base_step({
        name: 'finish pytest',
        code,
        next_step: get_packages
    })
}


async function get_packages(code) {
    await base_step(
        {
            code,
            spawn_hook: function() {
                const proc = spawn('python3', ['-c', 'import sys; import json; print(json.dumps(sys.path))']) 
                proc.stdout.on('data', function(data) { python_path = JSON.parse(data) } )
                return proc
            },
            next_step: finish_get_packages
        }
    )
}

async function finish_get_packages(code) {
    console.log('Found pathes: ', python_path)
    await base_step({
        name: 'finish get site packages',
        code,
        next_step: install_pytest_requirements
    })
}

async function install_pytest_requirements(code) {
    await base_step(
        {
            code,
            spawn_hook: function() {
                return spawn('python3', ['-m', 'pip', 'install', '-r', 'test_requirements.txt'])
            },
            next_step: finish_install_pytest_requirements
        }
    )
}

async function finish_install_pytest_requirements(code) {
    console.log('Installed pytest')
    await base_step({
        name: 'finish get site packages',
        code,
        next_step: run_pytest
    })
}


async function run_pytest(code) {
    await base_step(
        {
            code,
            spawn_hook: function() {
                return spawn('python3', ['-m', 'pytest', 'sample_py'])
            },
            next_step: finish_run_pytest
        }
    )
}


async function finish_run_pytest(code) {
    console.log('Finish pytest...')
}

async function run() {
  try {
    console.log('Starting...')
    await install_pytest(0)
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

run();

