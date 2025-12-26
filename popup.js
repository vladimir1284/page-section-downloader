// Popup script for Page Section Downloader

let selectedElementData = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  const selectBtn = document.getElementById('selectBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  
  selectBtn.addEventListener('click', startSelection);
  downloadBtn.addEventListener('click', downloadSection);
  
  // Check if there's already a selected element
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedElement' });
    if (response && response.hasSelection) {
      updateSelectedInfo(response);
    }
  } catch (e) {
    // Content script not yet injected
  }
});

// Start element selection mode
async function startSelection() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Inject content script if needed
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (e) {
    // Script may already be injected
  }
  
  // Inject styles
  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content-styles.css']
    });
  } catch (e) {
    // Styles may already be injected
  }
  
  // Start selection mode
  await chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
  
  // Update button state
  const selectBtn = document.getElementById('selectBtn');
  selectBtn.textContent = '🎯 Selecting... (click an element)';
  selectBtn.classList.add('selecting');
  
  // Listen for selection
  chrome.runtime.onMessage.addListener(handleMessage);
  
  // Close popup to allow selection (optional - comment out to keep popup open)
  // window.close();
  
  showStatus('Click on any element on the page to select it', 'info');
}

// Handle messages from content script
function handleMessage(message, sender, sendResponse) {
  if (message.action === 'elementSelected') {
    updateSelectedInfo(message);
    const selectBtn = document.getElementById('selectBtn');
    selectBtn.innerHTML = '<span class="icon">🎯</span> Select Element';
    selectBtn.classList.remove('selecting');
    showStatus('Element selected!', 'success');
  }
}

// Update the UI with selected element info
function updateSelectedInfo(data) {
  selectedElementData = data;
  
  document.getElementById('elementTag').textContent = data.tagName || '-';
  document.getElementById('elementId').textContent = data.id || '(none)';
  document.getElementById('elementClass').textContent = data.className || '(none)';
  document.getElementById('elementSize').textContent = `${data.width}×${data.height}px`;
  
  document.getElementById('selectedInfo').classList.remove('hidden');
  document.getElementById('downloadSection').classList.remove('hidden');
  
  // Generate automatic filename
  const filename = generateFilename(data);
  document.getElementById('filename').value = filename;
}

// Generate automatic filename based on element and page info
function generateFilename(data) {
  const parts = [];
  
  // Add page title (sanitized)
  if (data.pageTitle) {
    const sanitizedTitle = data.pageTitle
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 30);
    if (sanitizedTitle) {
      parts.push(sanitizedTitle);
    }
  }
  
  // Add element identifier
  if (data.id) {
    parts.push(data.id);
  } else if (data.className) {
    const firstClass = data.className.split(' ')[0];
    if (firstClass && !firstClass.startsWith('psd-')) {
      parts.push(firstClass);
    }
  } else {
    parts.push(data.tagName.toLowerCase());
  }
  
  // Add timestamp
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  parts.push(timestamp);
  
  return parts.join('_');
}

// Download the selected section
async function downloadSection() {
  if (!selectedElementData) {
    showStatus('Please select an element first', 'error');
    return;
  }
  
  const format = document.querySelector('input[name="format"]:checked').value;
  const includeStyles = document.getElementById('includeStyles').checked;
  let filename = document.getElementById('filename').value.trim();
  
  // Ensure filename has correct extension
  const extensions = { html: '.html', text: '.txt', markdown: '.md' };
  const ext = extensions[format];
  if (!filename.endsWith(ext)) {
    filename += ext;
  }
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getContent',
      format: format,
      includeStyles: includeStyles
    });
    
    if (response && response.content) {
      // Send to background script for download
      chrome.runtime.sendMessage({
        action: 'download',
        content: response.content,
        filename: filename,
        mimeType: format === 'html' ? 'text/html' : 'text/plain'
      });
      
      showStatus(`Downloaded: ${filename}`, 'success');
    } else {
      showStatus('Failed to get content', 'error');
    }
  } catch (e) {
    showStatus('Error: ' + e.message, 'error');
  }
}

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.classList.remove('hidden');
  
  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      status.classList.add('hidden');
    }, 3000);
  }
}
