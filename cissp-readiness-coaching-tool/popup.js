document.getElementById("openAppBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_APP" });
});

document.getElementById("openNewTabBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_APP" });
});