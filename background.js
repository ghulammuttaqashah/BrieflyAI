chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "OPEN_SIDE_PANEL" || !sender.tab?.id) return;
  chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => sendResponse({ ok: true })).catch((error) => {
    sendResponse({ error: error.message });
  });
  return true;
});
