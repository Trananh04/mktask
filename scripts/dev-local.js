#!/usr/bin/env node

const { execFileSync, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const localDir = path.join(rootDir, '.local');
const dataDir = path.join(localDir, 'postgres-data');
const passwordFile = path.join(localDir, 'postgres.pw');
const postgresLog = path.join(localDir, 'postgres.log');
const seedMarker = path.join(localDir, 'seeded');
const pidFile = path.join(localDir, 'dev-local-pids.json');

const dbUser = process.env.LOCAL_POSTGRES_USER || 'taskosaur';
const dbPassword = process.env.LOCAL_POSTGRES_PASSWORD || 'taskosaur';
const dbName = process.env.LOCAL_POSTGRES_DB || 'taskosaur';
const dbPort = process.env.LOCAL_POSTGRES_PORT || '55432';
const dbUrl = `postgresql://${dbUser}:${dbPassword}@localhost:${dbPort}/${dbName}`;
const bootstrapOnly = process.argv.includes('--bootstrap-only');
const stopOnly = process.argv.includes('--stop');

const npmCmd = 'npm';
const npmNeedsShell = process.platform === 'win32';
const exeSuffix = process.platform === 'win32' ? '.exe' : '';

let postgresStartedByThisRun = false;
const childProcesses = [];
let shuttingDown = false;

function log(message) {
  console.log(`[dev:local] ${message}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: options.env || process.env,
    stdio: options.stdio || 'inherit',
    encoding: 'utf8',
    shell: options.shell || false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }

  return result;
}

function savePidFile() {
  fs.mkdirSync(localDir, { recursive: true });
  fs.writeFileSync(
    pidFile,
    JSON.stringify(
      {
        manager: process.pid,
        children: childProcesses.map((child) => child.pid).filter(Boolean),
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

function removePidFile() {
  try {
    fs.rmSync(pidFile, { force: true });
  } catch {
    // Best effort cleanup only.
  }
}

function commandOutput(command, args, env = process.env) {
  try {
    return execFileSync(command, args, {
      cwd: rootDir,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function findInPath(name) {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  const output = commandOutput(lookup, [name]);
  return output.split(/\r?\n/).find(Boolean);
}

function findPostgresBin() {
  const required = ['initdb', 'pg_ctl', 'pg_isready', 'psql', 'createdb'];

  if (process.env.POSTGRES_BIN) {
    const binDir = process.env.POSTGRES_BIN;
    const found = Object.fromEntries(
      required.map((tool) => [tool, path.join(binDir, `${tool}${exeSuffix}`)]),
    );

    if (required.every((tool) => fs.existsSync(found[tool]))) {
      return found;
    }
  }

  const fromPath = Object.fromEntries(
    required.map((tool) => [tool, findInPath(`${tool}${exeSuffix}`)]),
  );

  if (required.every((tool) => fromPath[tool])) {
    return fromPath;
  }

  if (process.platform === 'win32') {
    const baseDir = 'C:\\Program Files\\PostgreSQL';
    if (fs.existsSync(baseDir)) {
      const versions = fs
        .readdirSync(baseDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => Number.parseFloat(b) - Number.parseFloat(a));

      for (const version of versions) {
        const binDir = path.join(baseDir, version, 'bin');
        const found = Object.fromEntries(
          required.map((tool) => [tool, path.join(binDir, `${tool}${exeSuffix}`)]),
        );

        if (required.every((tool) => fs.existsSync(found[tool]))) {
          return found;
        }
      }
    }
  }

  throw new Error(
    'PostgreSQL tools were not found. Install PostgreSQL locally or set POSTGRES_BIN to its bin folder.',
  );
}

function postgresEnv(extra = {}) {
  return {
    ...process.env,
    PGPASSWORD: dbPassword,
    DATABASE_URL: dbUrl,
    QUEUE_BACKEND: 'better-queue',
    QUEUE_ENABLE_FALLBACK: 'true',
    ...extra,
  };
}

function isPostgresReady(pg) {
  const result = spawnSync(pg.pg_isready, ['-h', 'localhost', '-p', dbPort, '-U', dbUser], {
    cwd: rootDir,
    env: postgresEnv(),
    stdio: 'ignore',
  });
  return result.status === 0;
}

function initPostgres(pg) {
  fs.mkdirSync(localDir, { recursive: true });

  if (fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    return;
  }

  log(`Initializing project-local PostgreSQL at ${path.relative(rootDir, dataDir)}`);
  fs.writeFileSync(passwordFile, `${dbPassword}\n`, { mode: 0o600 });

  run(pg.initdb, [
    '-D',
    dataDir,
    '-U',
    dbUser,
    '--auth=scram-sha-256',
    '--pwfile',
    passwordFile,
    '--encoding=UTF8',
  ]);
}

function startPostgres(pg) {
  if (isPostgresReady(pg)) {
    log(`PostgreSQL is already running on localhost:${dbPort}`);
    return;
  }

  log(`Starting project-local PostgreSQL on localhost:${dbPort}`);
  run(pg.pg_ctl, [
    '-D',
    dataDir,
    '-l',
    postgresLog,
    '-o',
    `-p ${dbPort} -c listen_addresses=localhost`,
    'start',
    '-w',
  ]);
  postgresStartedByThisRun = true;
}

function ensureDatabase(pg) {
  const exists = commandOutput(
    pg.psql,
    [
      '-h',
      'localhost',
      '-p',
      dbPort,
      '-U',
      dbUser,
      '-d',
      'postgres',
      '-tAc',
      `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`,
    ],
    postgresEnv(),
  );

  if (exists === '1') {
    return;
  }

  log(`Creating database ${dbName}`);
  run(pg.createdb, ['-h', 'localhost', '-p', dbPort, '-U', dbUser, dbName], {
    env: postgresEnv(),
  });
}

function runBootstrap() {
  const env = postgresEnv();

  log('Generating Prisma client');
  run(npmCmd, ['run', 'prisma:generate', '--workspace=backend'], { env, shell: npmNeedsShell });

  log('Applying database migrations');
  run(npmCmd, ['run', 'prisma:migrate:dev', '--workspace=backend'], { env, shell: npmNeedsShell });

  if (fs.existsSync(seedMarker)) {
    log('Database seed already completed; skipping seed step');
    return;
  }

  log('Seeding sample data');
  run(npmCmd, ['run', 'seed', '--workspace=backend'], { env, shell: npmNeedsShell });

  log('Seeding admin user');
  run(npmCmd, ['run', 'seed:admin', '--workspace=backend'], {
    env,
    allowFailure: true,
    shell: npmNeedsShell,
  });

  fs.writeFileSync(seedMarker, new Date().toISOString());
}

function startDevProcess(name, args, env) {
  const child = spawn(npmCmd, args, {
    cwd: rootDir,
    env,
    stdio: 'inherit',
    shell: npmNeedsShell,
  });

  childProcesses.push(child);
  savePidFile();

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      log(`${name} exited (${signal || code}). Stopping dev environment.`);
      shutdown(code || 1);
    }
  });
}

function killChild(child) {
  if (!child.pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

function stopPostgres(pg, force = false) {
  if (!force && !postgresStartedByThisRun) {
    return;
  }
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    return;
  }
  log('Stopping project-local PostgreSQL');
  run(pg.pg_ctl, ['-D', dataDir, 'stop', '-m', 'fast', '-w'], {
    env: postgresEnv(),
    allowFailure: true,
    stdio: 'ignore',
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of childProcesses) {
    killChild(child);
  }
  removePidFile();
  stopPostgres(findPostgresBin());
  process.exit(exitCode);
}

function killProcessTree(pid) {
  if (!pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process may already be gone.
    }
  }
}

function getListeningPids(ports) {
  if (process.platform !== 'win32') {
    return [];
  }

  const script = ports
    .map(
      (port) =>
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
    )
    .join('; ');

  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  return result.stdout
    .split(/\s+/)
    .map((value) => Number.parseInt(value, 10))
    .filter(Boolean);
}

function stopLocalDev() {
  const pg = findPostgresBin();
  const pids = new Set();

  if (fs.existsSync(pidFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
      for (const pid of saved.children || []) {
        pids.add(pid);
      }
      if (saved.manager && saved.manager !== process.pid) {
        pids.add(saved.manager);
      }
    } catch {
      // Fall back to port-based cleanup below.
    }
  }

  for (const pid of getListeningPids([3000, 3001])) {
    pids.add(pid);
  }

  for (const pid of pids) {
    killProcessTree(pid);
  }

  removePidFile();
  stopPostgres(pg, true);
  log('Local dev stopped');
}

function main() {
  if (stopOnly) {
    stopLocalDev();
    return;
  }

  const pg = findPostgresBin();
  initPostgres(pg);
  startPostgres(pg);
  ensureDatabase(pg);
  runBootstrap();

  if (bootstrapOnly) {
    log('Bootstrap check completed');
    stopPostgres(pg);
    return;
  }

  log('Starting frontend on http://localhost:3001');
  log('Starting backend on http://localhost:3000');

  const env = postgresEnv({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api',
  });

  startDevProcess('frontend', ['run', 'dev:fast', '--workspace=frontend'], env);
  startDevProcess('backend', ['run', 'start:dev', '--workspace=backend'], env);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('uncaughtException', (error) => {
  console.error(error);
  shutdown(1);
});

main();
