'use strict';

const REPO = 'asrafullfardin140-beep/call-recording';
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const FALLBACK_RELEASES = `https://github.com/${REPO}/releases`;

const btnMac = document.getElementById('btnMac');
const btnWin = document.getElementById('btnWin');
const meta = document.getElementById('meta');
const allReleases = document.getElementById('allReleases');

function pickAsset(assets, predicates) {
  for (const test of predicates) {
    const hit = assets.find((a) => test(a.name || ''));
    if (hit) return hit;
  }
  return null;
}

function enableButton(btn, asset) {
  if (!asset || !asset.browser_download_url) {
    btn.setAttribute('aria-disabled', 'true');
    btn.removeAttribute('href');
    return false;
  }
  btn.href = asset.browser_download_url;
  btn.removeAttribute('aria-disabled');
  return true;
}

async function loadLatest() {
  try {
    const res = await fetch(API, {
      headers: { Accept: 'application/vnd.github+json' }
    });

    if (res.status === 404) {
      meta.dataset.state = 'error';
      meta.textContent =
        'No public release yet. Once CI publishes v0.1.0 (or later), these buttons will link to the installers.';
      allReleases.href = FALLBACK_RELEASES;
      return;
    }

    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}`);
    }

    const release = await res.json();
    const assets = Array.isArray(release.assets) ? release.assets : [];

    const mac = pickAsset(assets, [
      (n) => /mac-arm64\.dmg$/i.test(n),
      (n) => /\.dmg$/i.test(n),
      (n) => /mac-arm64\.zip$/i.test(n)
    ]);

    const win = pickAsset(assets, [
      (n) => /win-x64-Setup\.exe$/i.test(n),
      (n) => /Setup\.exe$/i.test(n),
      (n) => /win-x64-Portable\.exe$/i.test(n),
      (n) => /\.exe$/i.test(n)
    ]);

    const macOk = enableButton(btnMac, mac);
    const winOk = enableButton(btnWin, win);

    allReleases.href = release.html_url || FALLBACK_RELEASES;

    const parts = [];
    if (release.tag_name) parts.push(release.tag_name);
    if (release.published_at) {
      parts.push(new Date(release.published_at).toLocaleDateString());
    }

    if (!macOk && !winOk) {
      meta.dataset.state = 'error';
      meta.textContent = `Release ${release.tag_name || ''} has no Mac/Windows installers attached yet.`;
      return;
    }

    delete meta.dataset.state;
    meta.textContent = `Latest: ${parts.join(' · ')}${
      macOk || winOk ? '' : ''
    } — direct links from GitHub Releases.`;
  } catch (err) {
    console.error(err);
    meta.dataset.state = 'error';
    meta.textContent =
      'Could not reach GitHub Releases. Use the link below, or try again shortly.';
    allReleases.href = FALLBACK_RELEASES;
  }
}

loadLatest();
