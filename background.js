// Background service worker for AWS Course Extractor

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'download') {
    if (message.url) {
      // Download from URL
      chrome.downloads.download({
        url: message.url,
        filename: sanitizeFilename(message.filename),
        saveAs: false
      }, (downloadId) => {
        handleDownloadResult(downloadId);
      });
    } else if (message.content) {
      // Download content blob
      downloadContent(message.content, message.filename, message.mimeType);
    }
  }
});

function downloadContent(content, filename, mimeType) {
  // Create a Blob from the content
  // Note: In Service Workers we can't use Blob/URL.createObjectURL directly for downloads in the same way as pages
  // But we can use data URLs for small content or the Reader API

  const reader = new FileReader();
  const blob = new Blob([content], { type: mimeType });

  reader.onload = function () {
    const dataUrl = reader.result;

    chrome.downloads.download({
      url: dataUrl,
      filename: sanitizeFilename(filename),
      saveAs: false
    }, (downloadId) => {
      handleDownloadResult(downloadId);
    });
  };
  reader.readAsDataURL(blob);
}

function handleDownloadResult(downloadId) {
  if (chrome.runtime.lastError) {
    console.error('Download failed:', chrome.runtime.lastError);
  } else {
    console.log('Download started with ID:', downloadId);
  }
}

// Sanitize filename to remove invalid characters
function sanitizeFilename(filename) {
  // Remove or replace invalid filename characters
  return filename
    .replace(/[<>:"|?*]/g, '-') // Allow / and \ for folders
    .replace(/\s+/g, '_')
    .substring(0, 200); // Limit length
}
