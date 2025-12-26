// Background service worker for Page Section Downloader

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'download') {
    downloadContent(message.content, message.filename, message.mimeType);
  }
});

function downloadContent(content, filename, mimeType) {
  // Create a Blob from the content
  const blob = new Blob([content], { type: mimeType });
  
  // Create a data URL
  const reader = new FileReader();
  reader.onload = function() {
    const dataUrl = reader.result;
    
    // Trigger download
    chrome.downloads.download({
      url: dataUrl,
      filename: sanitizeFilename(filename),
      saveAs: false // Set to true if you want the save dialog
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download failed:', chrome.runtime.lastError);
      } else {
        console.log('Download started with ID:', downloadId);
      }
    });
  };
  reader.readAsDataURL(blob);
}

// Sanitize filename to remove invalid characters
function sanitizeFilename(filename) {
  // Remove or replace invalid filename characters
  return filename
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .replace(/_+/g, '_')
    .substring(0, 200); // Limit length
}
