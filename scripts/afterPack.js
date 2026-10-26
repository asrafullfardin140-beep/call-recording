'use strict';

/**
 * Ensure the macOS .app is ad-hoc signed after pack.
 * Without a signature, Gatekeeper on Apple Silicon often reports
 * "Cybro Recorder is damaged and can't be opened" for downloaded DMGs.
 *
 * Ad-hoc (`-`) is not notarization — users may still need to clear quarantine
 * (see README). It does produce a valid local signature so the bundle is not
 * treated as corrupt.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const entitlements = path.join(context.packager.projectDir, 'build', 'entitlements.mac.plist');

  if (!fs.existsSync(appPath)) {
    throw new Error(`afterPack: missing app bundle at ${appPath}`);
  }

  const args = [
    '--sign',
    '-',
    '--force',
    '--deep',
    '--options',
    'runtime',
    '--timestamp=none'
  ];

  if (fs.existsSync(entitlements)) {
    args.push('--entitlements', entitlements);
  }

  args.push(appPath);

  console.log(`[afterPack] Ad-hoc codesign: codesign ${args.join(' ')}`);
  execFileSync('codesign', args, { stdio: 'inherit' });

  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
    stdio: 'inherit'
  });

  console.log('[afterPack] Ad-hoc signature verified.');
};
