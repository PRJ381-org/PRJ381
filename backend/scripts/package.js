#!/usr/bin/env node
/**
 * Builds the deployable zip for Hostinger.
 *
 *   npm run package                  slim zip, no node_modules (default)
 *   npm run package -- --with-modules    fat zip, dependencies bundled
 *
 * Slim is the default because SSH is available on this plan, so dependencies are
 * installed on the server inside the CloudLinux Node virtualenv. That matters:
 * node_modules built on a Windows laptop can carry platform-specific artefacts,
 * and installing on the target is the only way to be sure the tree matches the
 * server's Node version and libc.
 *
 * Files are chosen by ALLOWLIST, never by exclusion. The zip goes to a third
 * party, and one forgotten exclude rule is all it takes to ship .env - so
 * anything not named here simply cannot end up in the archive.
 */
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const APP_ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(APP_ROOT, 'dist');
const OUT_FILE = path.join(DIST_DIR, 'prj381-backend.zip');

const withModules = process.argv.includes('--with-modules');

// Everything the app needs at runtime, and nothing else.
const INCLUDE_DIRS = [
  'src', // application code, including src/scripts/ which must run on the server
  'public', // the dashboard - served by this same app
];

const INCLUDE_FILES = [
  'package.json',
  'package-lock.json', // pins the exact tree `npm ci` will install on the server
  '.env.example',
  'DEPLOY_HOSTINGER.md',
];

// Deliberately absent: .env (secrets), tests/, scripts/ (build-time only),
// dist/, .git/, coverage/. None are in the allowlist, so none can be included.
const NEVER_INCLUDE = ['.env'];

function fail(message) {
  console.error(`\n  package failed: ${message}\n`);
  process.exit(1);
}

async function build() {
  // A stale zip that silently fails to rebuild is worse than no zip.
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const missing = [...INCLUDE_DIRS, ...INCLUDE_FILES].filter(
    (p) => !fs.existsSync(path.join(APP_ROOT, p))
  );
  if (missing.length) fail(`missing required paths: ${missing.join(', ')}`);

  const output = fs.createWriteStream(OUT_FILE);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('warning', reject);
    archive.on('error', reject);
  });

  archive.pipe(output);

  // Archive root == application root, so extracting into the Hostinger app
  // directory puts package.json exactly where Passenger expects it. A wrapping
  // top-level folder here is the classic cause of "app won't start".
  for (const dir of INCLUDE_DIRS) archive.directory(path.join(APP_ROOT, dir), dir);
  for (const file of INCLUDE_FILES) archive.file(path.join(APP_ROOT, file), { name: file });

  if (withModules) {
    if (!fs.existsSync(path.join(APP_ROOT, 'node_modules'))) {
      fail('--with-modules given but node_modules does not exist; run npm install first');
    }
    archive.directory(path.join(APP_ROOT, 'node_modules'), 'node_modules');
  }

  await archive.finalize();
  await done;

  return archive.pointer();
}

/**
 * Lists the archive's entries by walking its central directory.
 *
 * Reading the finished file checks the artefact; inspecting the allowlist would
 * only re-check our own intent. Done by hand rather than with an unzip library
 * because it is ~20 lines and this must not depend on anything that might be
 * absent when someone builds a release in a hurry.
 */
function listZipEntries(zipPath) {
  const buf = fs.readFileSync(zipPath);
  const CENTRAL_DIR_SIG = 0x02014b50;
  const names = [];

  for (let i = 0; i <= buf.length - 46; i += 1) {
    if (buf.readUInt32LE(i) !== CENTRAL_DIR_SIG) continue;
    const nameLen = buf.readUInt16LE(i + 28);
    const extraLen = buf.readUInt16LE(i + 30);
    const commentLen = buf.readUInt16LE(i + 32);
    names.push(buf.toString('utf8', i + 46, i + 46 + nameLen));
    i += 45 + nameLen + extraLen + commentLen;
  }

  return names;
}

function verifyArchive(zipPath) {
  const entries = listZipEntries(zipPath);
  if (!entries.length) fail('could not read any entries back from the archive');

  // Match on the path segment, so a nested src/.env would be caught too.
  const leaked = entries.filter((e) => NEVER_INCLUDE.includes(path.basename(e)));
  if (leaked.length) fail(`SECRET LEAK - archive contains: ${leaked.join(', ')}`);

  // The startup file must sit at the archive root or Passenger will not find it.
  if (!entries.includes('package.json')) {
    fail('package.json is not at the archive root; Passenger will fail to start the app');
  }
  if (!entries.some((e) => e.startsWith('src/index.js'))) fail('src/index.js missing from archive');
  if (!entries.some((e) => e.startsWith('public/index.html'))) {
    fail('public/index.html missing - the dashboard would 404');
  }

  return entries;
}

build()
  .then((bytes) => {
    const entries = verifyArchive(OUT_FILE);
    const mb = (bytes / 1024 / 1024).toFixed(2);
    console.log('');
    console.log(`  Built ${path.relative(process.cwd(), OUT_FILE)}  (${mb} MB, ${entries.length} entries)`);
    console.log(`  Mode:  ${withModules ? 'FAT - node_modules bundled' : 'SLIM - run npm ci on the server'}`);
    console.log(`  Verified: package.json at root, src/ and public/ present, no ${NEVER_INCLUDE.join('/')} inside`);
    console.log('');
    console.log('  Next: see DEPLOY_HOSTINGER.md');
    console.log('');
  })
  .catch((err) => fail(err.message));
