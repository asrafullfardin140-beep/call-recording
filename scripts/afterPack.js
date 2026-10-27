'use strict';

/**
 * Ad-hoc sign the macOS .app after pack (no Apple Developer ID / notarization).
 *
 * Do NOT combine ad-hoc identity with hardened runtime (`--options runtime`).
 * Quarantined + hardenedRuntime + non-notarized → Gatekeeper "damaged and
 * can't be opened" on Apple Silicon. Plain ad-hoc signing is recoverable via
 * right-click → Open (or System Settings → Open Anyway).
 */
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function codesignAdhoc(targetPath) {
  execFileSync('codesign', ['--sign', '-', '--force', '--timestamp=none', targetPath], {
    stdio: 'inherit'
  });
}

function listMachOFiles(appPath) {
  // macOS/BSD find: scan regular files under the bundle; keep Mach-O only.
  const out = execFileSync('find', [appPath, '-type', 'f'], { encoding: 'utf8' });

  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => {
      // Skip huge asar / resource blobs early by extension when obvious
      if (/\.(pak|dat|bin|asar|png|jpg|html|js|json|txt|md)$/i.test(p)) return false;
      try {
        const info = execFileSync('file', ['-b', p], { encoding: 'utf8' });
        return /Mach-O/i.test(info);
      } catch {
        return false;
      }
    });
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  if (!fs.existsSync(appPath)) {
    throw new Error(`afterPack: missing app bundle at ${appPath}`);
  }

  console.log(`[afterPack] Ad-hoc signing (no hardened runtime): ${appPath}`);

  const nested = listMachOFiles(appPath);
  nested.sort((a, b) => b.length - a.length);
  for (const file of nested) {
    try {
      codesignAdhoc(file);
    } catch (err) {
      console.warn(`[afterPack] skip ${file}: ${err && err.message ? err.message : err}`);
    }
  }

  // Outer bundle — plain ad-hoc, no --options runtime, no entitlements plist.
  execFileSync(
    'codesign',
    ['--sign', '-', '--force', '--deep', '--timestamp=none', appPath],
    { stdio: 'inherit' }
  );

  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
    stdio: 'inherit'
  });

  const dump = execSync(`codesign -dv --verbose=4 "${appPath}" 2>&1`, {
    encoding: 'utf8'
  });
  console.log('[afterPack] codesign -dv:\n' + dump);

  const flagsLine = dump.split('\n').find((l) => l.startsWith('flags=')) || '';
  if (/\bruntime\b/i.test(flagsLine)) {
    throw new Error(
      'afterPack: hardened runtime still present — Gatekeeper may report the app as damaged'
    );
  }
  if (!/Signature=Adhoc/i.test(dump) && !/flags=/i.test(dump)) {
    console.warn('[afterPack] Could not confirm Adhoc signature string; verify step already passed.');
  }

  console.log('[afterPack] Ad-hoc signature verified (no hardened runtime).');
};
