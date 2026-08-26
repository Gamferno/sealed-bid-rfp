const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const isRoot = fs.existsSync(path.join(process.cwd(), 'contracts'));
const rootDir = isRoot ? process.cwd() : path.resolve(process.cwd(), '..');
const contractsDir = path.join(rootDir, 'contracts');
const uiDir = path.join(rootDir, 'ui');

const env = {
  ...process.env,
  PATH: `${path.join(uiDir, 'node_modules/.bin')}:${path.join(rootDir, 'node_modules/.bin')}:${process.env.PATH}`,
};

console.log(`[Build] Working dir: ${process.cwd()} (isRoot: ${isRoot})`);
console.log(`[Build] 1. Building contracts in ${contractsDir}...`);
cp.execSync('tsc --project tsconfig.build.json && mkdir -p dist && cp -Rf ./managed ./dist/managed', { cwd: contractsDir, env, stdio: 'inherit' });

console.log(`[Build] 2. Building UI in ${uiDir}...`);
cp.execSync('tsc && vite build --mode preprod', { cwd: uiDir, env, stdio: 'inherit' });

console.log(`[Build] 3. Copying ZK proving keys and circuit assets...`);
const uiDist = path.join(uiDir, 'dist');
fs.mkdirSync(path.join(uiDist, 'keys'), { recursive: true });
fs.mkdirSync(path.join(uiDist, 'zkir'), { recursive: true });

cp.execSync(`cp -Rf ${path.join(contractsDir, 'managed/sealed-bid/keys')}/. ${path.join(uiDist, 'keys')}/`, { stdio: 'inherit' });
cp.execSync(`cp -Rf ${path.join(contractsDir, 'managed/sealed-bid/zkir')}/. ${path.join(uiDist, 'zkir')}/`, { stdio: 'inherit' });

// Ensure dist output is mirrored so Vercel finds it regardless of root setting
const rootDist = path.join(rootDir, 'dist');
if (fs.existsSync(uiDist)) {
  fs.mkdirSync(rootDist, { recursive: true });
  cp.execSync(`cp -Rf ${uiDist}/. ${rootDist}/`, { stdio: 'inherit' });
}

console.log(`[Build] ✅ Full build completed successfully!`);
