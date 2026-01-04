// Popup script for AWS Course Extractor

document.addEventListener('DOMContentLoaded', () => {
  const extractBtn = document.getElementById('extractBtn');
  
  extractBtn.addEventListener('click', async () => {
    const downloadMarkdown = document.getElementById('downloadMarkdown').checked;
    const downloadImagesList = document.getElementById('downloadImagesList').checked;
    const downloadImages = document.getElementById('downloadImages').checked;
    const imageDelay = parseInt(document.getElementById('imageDelay').value, 10) || 500;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject content script if needed
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      });
    } catch (e) {
      // Script may already be injected
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractCourse',
        options: {
          downloadMarkdown,
          downloadImagesList,
          downloadImages,
          imageDelay
        }
      });

      if (response && response.success) {
        showStatus('Extraction started!', 'success');
      } else {
        showStatus('Extraction failed or no content found.', 'error');
      }
    } catch (e) {
      showStatus('Error: ' + e.message, 'error');
    }
  });
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.classList.remove('hidden');
  
  setTimeout(() => {
    status.classList.add('hidden');
  }, 3000);
}
