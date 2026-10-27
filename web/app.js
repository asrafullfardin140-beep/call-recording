'use strict';

const REPO = 'asrafullfardin140-beep/call-recording';
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const FALLBACK_RELEASES = `https://github.com/${REPO}/releases/latest`;

/** Prefer these if the API is unreachable (keep in sync with latest shipped tag). */
const FALLBACK_ASSETS = {
  mac: `https://github.com/${REPO}/releases/download/v0.1.2/Cybro-Recorder-0.1.2-mac-arm64.dmg`,
  win: `https://github.com/${REPO}/releases/download/v0.1.2/Cybro-Recorder-0.1.2-win-x64-Setup.exe`,
  winPortable: `https://github.com/${REPO}/releases/download/v0.1.2/Cybro-Recorder-0.1.2-win-x64-Portable.exe`
};

const btnMac = document.getElementById('btnMac');
const btnWin = document.getElementById('btnWin');
const btnWinPortable = document.getElementById('btnWinPortable');
const meta = document.getElementById('meta');
const versionLabel = document.getElementById('versionLabel');
const allReleases = document.getElementById('allReleases');

function pickAsset(assets, predicates) {
  for (const test of predicates) {
    const hit = assets.find((a) => test(a.name || ''));
    if (hit) return hit;
  }
  return null;
}

function enableButton(btn, url) {
  if (!btn) return false;
  if (!url) {
    btn.setAttribute('aria-disabled', 'true');
    btn.removeAttribute('href');
    return false;
  }
  btn.href = url;
  btn.removeAttribute('aria-disabled');
  return true;
}

function setVersionText(tag) {
  if (!versionLabel) return;
  const clean = (tag || '').replace(/^v/i, '') || '—';
  versionLabel.textContent = clean;
}

function applyFallbacks(reason) {
  enableButton(btnMac, FALLBACK_ASSETS.mac);
  enableButton(btnWin, FALLBACK_ASSETS.win);
  enableButton(btnWinPortable, FALLBACK_ASSETS.winPortable);
  setVersionText('0.1.2');
  allReleases.href = FALLBACK_RELEASES;
  meta.dataset.state = 'warn';
  meta.textContent = reason;
}

async function loadLatest() {
  try {
    const res = await fetch(`${API}?_=${Date.now()}`, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store'
    });

    if (res.status === 404) {
      applyFallbacks(
        'No public release found via API — using v0.1.2 direct links.'
      );
      return;
    }

    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}`);
    }

    const release = await res.json();
    const assets = Array.isArray(release.assets) ? release.assets : [];

    const mac = pickAsset(assets, [
      (n) => /mac-arm64\.dmg$/i.test(n),
      (n) => /\.dmg$/i.test(n)
    ]);
    const win = pickAsset(assets, [
      (n) => /win-x64-Setup\.exe$/i.test(n),
      (n) => /Setup\.exe$/i.test(n)
    ]);
    const winPortable = pickAsset(assets, [
      (n) => /win-x64-Portable\.exe$/i.test(n),
      (n) => /Portable\.exe$/i.test(n)
    ]);

    const macOk = enableButton(btnMac, mac && mac.browser_download_url);
    const winOk = enableButton(btnWin, win && win.browser_download_url);
    const portableOk = enableButton(
      btnWinPortable,
      winPortable && winPortable.browser_download_url
    );

    if (!macOk) enableButton(btnMac, FALLBACK_ASSETS.mac);
    if (!winOk) enableButton(btnWin, FALLBACK_ASSETS.win);
    if (!portableOk) enableButton(btnWinPortable, FALLBACK_ASSETS.winPortable);

    allReleases.href = release.html_url || FALLBACK_RELEASES;
    setVersionText(release.tag_name || '0.1.2');

    const parts = [];
    if (release.tag_name) parts.push(release.tag_name);
    if (release.published_at) {
      parts.push(new Date(release.published_at).toLocaleDateString());
    }

    delete meta.dataset.state;
    meta.textContent = `Latest release ${parts.join(' · ')} — links from GitHub Releases.`;
  } catch (err) {
    console.error(err);
    applyFallbacks(
      'Could not reach GitHub API — using v0.1.2 direct download links.'
    );
  }
}

loadLatest();
