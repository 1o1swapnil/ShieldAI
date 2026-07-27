// 3.1: in-product justification screen for the optional_host_permissions
// grant, shown at install time instead of a silent blanket grant.
const grantButton = document.getElementById('grant-button');
const skipButton = document.getElementById('skip-button');
const statusEl = document.getElementById('status');

async function finish(granted) {
  await chrome.runtime.sendMessage({ type: 'host-permission-decision', granted });
  statusEl.textContent = granted
    ? 'Broad access granted. Continue to install token entry.'
    : 'Skipped. You still get full known-tool-list detection. Continue to install token entry.';
  grantButton.disabled = true;
  skipButton.disabled = true;
}

grantButton.addEventListener('click', async () => {
  const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
  finish(granted);
});

skipButton.addEventListener('click', () => finish(false));
