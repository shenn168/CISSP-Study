chrome.runtime.onInstalled.addListener(() => {
  console.log("CISSP Readiness and Coaching Tool installed.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "OPEN_APP") {
    const url = chrome.runtime.getURL("app.html");
    chrome.tabs.create({ url });
    sendResponse({ ok: true });
    return true;
  }
});