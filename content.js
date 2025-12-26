// Content script for Page Section Downloader
// This runs in the context of the web page

(function() {
  // Prevent multiple injections
  if (window.psdInjected) return;
  window.psdInjected = true;
  
  let isSelecting = false;
  let selectedElement = null;
  let hoveredElement = null;
  
  // Create highlight overlay
  const overlay = document.createElement('div');
  overlay.id = 'psd-overlay';
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    border: 2px solid #4CAF50;
    background: rgba(76, 175, 80, 0.1);
    z-index: 2147483647;
    transition: all 0.1s ease;
    display: none;
  `;
  document.body.appendChild(overlay);
  
  // Create selection indicator
  const selectionIndicator = document.createElement('div');
  selectionIndicator.id = 'psd-selection-indicator';
  selectionIndicator.style.cssText = `
    position: fixed;
    pointer-events: none;
    border: 3px solid #2196F3;
    background: rgba(33, 150, 243, 0.15);
    z-index: 2147483646;
    display: none;
  `;
  document.body.appendChild(selectionIndicator);
  
  // Create label for hovered element
  const label = document.createElement('div');
  label.id = 'psd-label';
  label.style.cssText = `
    position: fixed;
    background: #333;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    z-index: 2147483647;
    pointer-events: none;
    display: none;
  `;
  document.body.appendChild(label);
  
  // Mouse move handler for highlighting
  function handleMouseMove(e) {
    if (!isSelecting) return;
    
    const target = e.target;
    if (target === overlay || target === label || target === selectionIndicator) return;
    if (target.id && target.id.startsWith('psd-')) return;
    
    hoveredElement = target;
    const rect = target.getBoundingClientRect();
    
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    
    // Show label
    const tagInfo = target.tagName.toLowerCase() + 
      (target.id ? `#${target.id}` : '') + 
      (target.className && typeof target.className === 'string' ? 
        '.' + target.className.split(' ').filter(c => c && !c.startsWith('psd-')).slice(0, 2).join('.') : '');
    
    label.textContent = tagInfo;
    label.style.display = 'block';
    label.style.top = Math.max(0, rect.top - 28) + 'px';
    label.style.left = rect.left + 'px';
  }
  
  // Click handler for selection
  function handleClick(e) {
    if (!isSelecting) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;
    if (target.id && target.id.startsWith('psd-')) return;
    
    selectedElement = target;
    isSelecting = false;
    
    // Hide hover overlay, show selection indicator
    overlay.style.display = 'none';
    label.style.display = 'none';
    
    const rect = target.getBoundingClientRect();
    selectionIndicator.style.display = 'block';
    selectionIndicator.style.top = rect.top + 'px';
    selectionIndicator.style.left = rect.left + 'px';
    selectionIndicator.style.width = rect.width + 'px';
    selectionIndicator.style.height = rect.height + 'px';
    
    // Remove cursor style
    document.body.style.cursor = '';
    
    // Send selection info to popup
    const elementData = {
      action: 'elementSelected',
      hasSelection: true,
      tagName: target.tagName,
      id: target.id || '',
      className: typeof target.className === 'string' ? 
        target.className.split(' ').filter(c => !c.startsWith('psd-')).join(' ') : '',
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      pageTitle: document.title,
      pageUrl: window.location.href
    };
    
    chrome.runtime.sendMessage(elementData);
  }
  
  // Escape key handler
  function handleKeyDown(e) {
    if (e.key === 'Escape' && isSelecting) {
      stopSelection();
    }
  }
  
  // Stop selection mode
  function stopSelection() {
    isSelecting = false;
    overlay.style.display = 'none';
    label.style.display = 'none';
    document.body.style.cursor = '';
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startSelection') {
      isSelecting = true;
      selectedElement = null;
      selectionIndicator.style.display = 'none';
      document.body.style.cursor = 'crosshair';
      sendResponse({ success: true });
    }
    
    else if (message.action === 'getSelectedElement') {
      if (selectedElement) {
        const rect = selectedElement.getBoundingClientRect();
        sendResponse({
          hasSelection: true,
          tagName: selectedElement.tagName,
          id: selectedElement.id || '',
          className: typeof selectedElement.className === 'string' ? 
            selectedElement.className.split(' ').filter(c => !c.startsWith('psd-')).join(' ') : '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          pageTitle: document.title,
          pageUrl: window.location.href
        });
      } else {
        sendResponse({ hasSelection: false });
      }
    }
    
    else if (message.action === 'getContent') {
      if (!selectedElement) {
        sendResponse({ content: null });
        return true;
      }
      
      let content = '';
      
      if (message.format === 'html') {
        if (message.includeStyles) {
          content = getHtmlWithStyles(selectedElement);
        } else {
          content = selectedElement.outerHTML;
        }
        // Wrap in basic HTML structure
        content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extracted from: ${document.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
  </style>
</head>
<body>
  <!-- Extracted from: ${window.location.href} -->
  ${content}
</body>
</html>`;
      }
      
      else if (message.format === 'text') {
        content = selectedElement.innerText || selectedElement.textContent;
      }
      
      else if (message.format === 'markdown') {
        content = htmlToMarkdown(selectedElement);
        content = `<!-- Extracted from: ${window.location.href} -->\n\n${content}`;
      }
      
      sendResponse({ content: content });
    }
    
    return true;
  });
  
  // Get HTML with computed styles inlined
  function getHtmlWithStyles(element) {
    const clone = element.cloneNode(true);
    
    // Get computed styles for the element and all descendants
    function inlineStyles(el, originalEl) {
      const computed = window.getComputedStyle(originalEl);
      const important = [
        'color', 'background-color', 'background', 'font-family', 'font-size', 
        'font-weight', 'line-height', 'text-align', 'padding', 'margin',
        'border', 'display', 'flex-direction', 'justify-content', 'align-items',
        'width', 'max-width', 'gap'
      ];
      
      let styleStr = '';
      important.forEach(prop => {
        const value = computed.getPropertyValue(prop);
        if (value && value !== 'initial' && value !== 'none' && value !== 'normal') {
          styleStr += `${prop}: ${value}; `;
        }
      });
      
      if (styleStr) {
        el.setAttribute('style', styleStr);
      }
      
      // Process children
      const originalChildren = originalEl.children;
      const cloneChildren = el.children;
      for (let i = 0; i < originalChildren.length; i++) {
        if (cloneChildren[i]) {
          inlineStyles(cloneChildren[i], originalChildren[i]);
        }
      }
    }
    
    inlineStyles(clone, element);
    return clone.outerHTML;
  }
  
  // Convert HTML to Markdown
  function htmlToMarkdown(element) {
    let md = '';
    
    function processNode(node, depth = 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }
      
      const tag = node.tagName.toLowerCase();
      let result = '';
      let childContent = '';
      
      // Process children first
      for (const child of node.childNodes) {
        childContent += processNode(child, depth);
      }
      
      childContent = childContent.trim();
      
      switch (tag) {
        case 'h1':
          result = `# ${childContent}\n\n`;
          break;
        case 'h2':
          result = `## ${childContent}\n\n`;
          break;
        case 'h3':
          result = `### ${childContent}\n\n`;
          break;
        case 'h4':
          result = `#### ${childContent}\n\n`;
          break;
        case 'h5':
          result = `##### ${childContent}\n\n`;
          break;
        case 'h6':
          result = `###### ${childContent}\n\n`;
          break;
        case 'p':
          result = `${childContent}\n\n`;
          break;
        case 'br':
          result = '\n';
          break;
        case 'strong':
        case 'b':
          result = `**${childContent}**`;
          break;
        case 'em':
        case 'i':
          result = `*${childContent}*`;
          break;
        case 'code':
          result = `\`${childContent}\``;
          break;
        case 'pre':
          result = `\`\`\`\n${childContent}\n\`\`\`\n\n`;
          break;
        case 'a':
          const href = node.getAttribute('href') || '';
          result = `[${childContent}](${href})`;
          break;
        case 'img':
          const src = node.getAttribute('src') || '';
          const alt = node.getAttribute('alt') || 'image';
          result = `![${alt}](${src})`;
          break;
        case 'ul':
          result = childContent + '\n';
          break;
        case 'ol':
          result = childContent + '\n';
          break;
        case 'li':
          const parent = node.parentElement;
          if (parent && parent.tagName.toLowerCase() === 'ol') {
            const index = Array.from(parent.children).indexOf(node) + 1;
            result = `${index}. ${childContent}\n`;
          } else {
            result = `- ${childContent}\n`;
          }
          break;
        case 'blockquote':
          result = childContent.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
          break;
        case 'hr':
          result = '---\n\n';
          break;
        case 'table':
          result = childContent + '\n';
          break;
        case 'thead':
        case 'tbody':
          result = childContent;
          break;
        case 'tr':
          result = '| ' + childContent + '\n';
          break;
        case 'th':
          result = childContent + ' | ';
          break;
        case 'td':
          result = childContent + ' | ';
          break;
        case 'div':
        case 'section':
        case 'article':
        case 'main':
        case 'header':
        case 'footer':
        case 'nav':
        case 'aside':
          result = childContent + '\n';
          break;
        case 'span':
          result = childContent;
          break;
        default:
          result = childContent;
      }
      
      return result;
    }
    
    md = processNode(element);
    
    // Clean up extra newlines
    md = md.replace(/\n{3,}/g, '\n\n').trim();
    
    return md;
  }
  
  // Add event listeners
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  
  // Cleanup on unload
  window.addEventListener('unload', () => {
    overlay.remove();
    label.remove();
    selectionIndicator.remove();
  });
})();
