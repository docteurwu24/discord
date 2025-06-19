const logsContainer = document.getElementById('logsContainer');

function addLog(message) {
  const logEntry = document.createElement('div');
  logEntry.textContent = message;
  logsContainer.appendChild(logEntry);
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'LOG_MESSAGE') {
    addLog(request.message);
  }
});

// Initialisation
addLog("Page de logs initialisée");
chrome.runtime.sendMessage({ type: 'LOGS_PAGE_READY' }).catch(() => {});