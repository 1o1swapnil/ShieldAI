// 2.2 / Section 8: single DOM read at load — title and script src hints
// only, never page body content. Statically scoped (manifest content_scripts)
// to the known-tool domains; unknown-domain scanning is registered
// dynamically in background.js, only once the optional <all_urls>
// permission has been granted (Section 3.1).
chrome.runtime.sendMessage({
  type: 'page-visit',
  domain: location.hostname,
  title: document.title,
  scriptHints: Array.from(document.scripts)
    .map((s) => s.src)
    .filter(Boolean),
});
