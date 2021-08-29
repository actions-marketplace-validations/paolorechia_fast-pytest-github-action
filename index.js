const core = require('@actions/core');
const cache = require('@actions/cache');
const crypto = require('crypto');
const fs = require('fs');

const { spawn } = require('child_process');

let pytest_args = undefined
let python_path = undefined
let requirements_file = undefined
let hash_path = undefined
let hash_key = undefined

let has_passed_tests = false
let has_failed_tests = false

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
              register_proc_handlers(proc, step_data.next_step ? step_data.next_step : function(){})
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

async function start(code) {
    await base_step({
        name: 'Start state machine',
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
    hash_path = python_path.find(element => element.includes('site-packages'))
    hash_key = `${hash_key}-${hash_path}`
    console.log('Restoring cache with')
    console.log([hash_path])
    console.log(hash_key)
    cacheKey = await cache.restoreCache([hash_path], hash_key, [])
    if (cacheKey) { 
        console.log('Cache hit!')
        await base_step({
            name: 'finish get site packages',
            code,
            next_step: run_pytest
        })
    } else {
        console.log('Cache miss! Installing everything :)')
        await base_step({
            name: 'finish get site packages',
            code,
            next_step: install_pytest
        })
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
        next_step: install_pytest_requirements
    })
}



async function install_pytest_requirements(code) {
    await base_step(
        {
            code,
            spawn_hook: function() {
                return spawn('python3', ['-m', 'pip', 'install', '-r', requirements_file])
            },
            next_step: finish_install_pytest_requirements
        }
    )
}

async function finish_install_pytest_requirements(code) {
    console.log('Installed pytest')
    console.log(hash_key, hash_path)
    if (hash_key && hash_path) {
        console.log('Using: ', 'path', [hash_path], 'key', hash_key)
        console.log('Caching dependencies...')
        const cacheId = await cache.saveCache([hash_path], hash_key)
    } else {
        console.log('Hash key not found to write to cache...')
    }
    await base_step({
        name: 'run pytest',
        code,
        next_step: run_pytest
    })
}


async function run_pytest(code) {
    await base_step(
        {
            code,
            spawn_hook: function() {
                const pytest = spawn('python3', ['-m', 'pytest', pytest_args])
                pytest.stdout.on('data', function(data) {
                    if (data.includes('passed')) {
                        has_passed_tests = true
                    }
                    if (data.includes('failed')) {
                        has_failed_tests = true
                    }
                })
                return pytest 
            },
            next_step: finish_run_pytest
        }
    )
}


async function finish_run_pytest(code) {
    console.log('Finish pytest...')

    if (has_passed_tests && !has_failed_tests) {
        core.setOutput('OK! Congratulations :)')
    } else {
        core.setFailed("Failed :(");
    }
}

async function run() {
  try {
    pytest_args = core.getInput('pytest_args');
    if (!pytest_args) {
        core.setFailed("You must provide a pytest argument with 'pytest_args'");
    }
    requirements_file = core.getInput('requirements_file');
    if (!requirements_file) {
        core.setFailed("You must provide a requirements file with 'requirements_file'");
    }
    console.log('Start run...')
    console.log('Hashing dependencies...')
    hash_key = `fast-pytest-gh-${hash_file(requirements_file)}`
    await start(0)
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

