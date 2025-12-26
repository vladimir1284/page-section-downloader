// Content script for Page Section Downloader
// This runs in the context of the web page

(function() {
  // Prevent multiple injections
  if (window.psdInjected) return;
  window.psdInjected = true;
  
  let isSelecting = false;
  let selectedElement = null;
  let hoveredElement = null;
  let currentDepthElement = null; // Track element at current navigation depth
  let matchedElements = []; // Store elements matching a selector
  let currentMatchIndex = 0; // Current index in matched elements
  
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
    max-width: 400px;
  `;
  document.body.appendChild(label);
  
  // Create help tooltip
  const helpTooltip = document.createElement('div');
  helpTooltip.id = 'psd-help';
  helpTooltip.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.85);
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    z-index: 2147483647;
    pointer-events: none;
    display: none;
    text-align: center;
    line-height: 1.5;
  `;
  helpTooltip.innerHTML = `
    <strong>Navegación:</strong><br>
    <kbd style="background:#555;padding:2px 6px;border-radius:3px;">↑</kbd> / <kbd style="background:#555;padding:2px 6px;border-radius:3px;">W</kbd> = Padre &nbsp;|&nbsp; 
    <kbd style="background:#555;padding:2px 6px;border-radius:3px;">↓</kbd> / <kbd style="background:#555;padding:2px 6px;border-radius:3px;">S</kbd> = Hijo &nbsp;|&nbsp;
    <kbd style="background:#555;padding:2px 6px;border-radius:3px;">←</kbd> <kbd style="background:#555;padding:2px 6px;border-radius:3px;">→</kbd> = Hermanos<br>
    <kbd style="background:#555;padding:2px 6px;border-radius:3px;">Shift+hover</kbd> = Ignorar elementos fijos &nbsp;|&nbsp;
    <kbd style="background:#555;padding:2px 6px;border-radius:3px;">Click</kbd> = Seleccionar &nbsp;|&nbsp;
    <kbd style="background:#555;padding:2px 6px;border-radius:3px;">Esc</kbd> = Cancelar
  `;
  document.body.appendChild(helpTooltip);
  
  // Get element label text
  function getElementLabel(el) {
    if (!el) return '';
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const classes = el.className && typeof el.className === 'string' 
      ? '.' + el.className.split(' ').filter(c => c && !c.startsWith('psd-')).slice(0, 2).join('.')
      : '';
    const size = `${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`;
    return `${tag}${id}${classes} (${size}px)`;
  }
  
  // Update overlay position for an element
  function updateOverlay(el) {
    if (!el) {
      overlay.style.display = 'none';
      label.style.display = 'none';
      return;
    }
    
    const rect = el.getBoundingClientRect();
    
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    
    label.textContent = getElementLabel(el);
    label.style.display = 'block';
    label.style.top = Math.max(0, rect.top - 28) + 'px';
    label.style.left = Math.max(0, rect.left) + 'px';
  }
  
  // Check if element is one of our UI elements
  function isOurElement(el) {
    if (!el) return false;
    return el.id && el.id.startsWith('psd-');
  }
  
  // Get the deepest element at a point, ignoring fixed/sticky elements if needed
  function getElementAtPoint(x, y, ignoreFixed = false) {
    const elements = document.elementsFromPoint(x, y);
    
    for (const el of elements) {
      if (isOurElement(el)) continue;
      
      if (ignoreFixed) {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          continue;
        }
      }
      
      return el;
    }
    
    return elements[elements.length - 1] || document.body;
  }
  
  // Navigate to parent element
  function goToParent() {
    if (!currentDepthElement) return;
    
    let parent = currentDepthElement.parentElement;
    while (parent && (isOurElement(parent) || parent === document.body || parent === document.documentElement)) {
      parent = parent.parentElement;
    }
    
    if (parent && parent !== document.body && parent !== document.documentElement) {
      currentDepthElement = parent;
      updateOverlay(currentDepthElement);
    }
  }
  
  // Navigate to first child element
  function goToChild() {
    if (!currentDepthElement) return;
    
    const children = Array.from(currentDepthElement.children).filter(c => !isOurElement(c));
    if (children.length > 0) {
      currentDepthElement = children[0];
      updateOverlay(currentDepthElement);
    }
  }
  
  // Navigate to sibling element
  function goToSibling(direction) {
    if (!currentDepthElement || !currentDepthElement.parentElement) return;
    
    const siblings = Array.from(currentDepthElement.parentElement.children).filter(c => !isOurElement(c));
    const currentIndex = siblings.indexOf(currentDepthElement);
    
    if (currentIndex === -1) return;
    
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = siblings.length - 1;
    if (newIndex >= siblings.length) newIndex = 0;
    
    currentDepthElement = siblings[newIndex];
    updateOverlay(currentDepthElement);
  }
  
  // Mouse move handler for highlighting
  let lastMouseX = 0;
  let lastMouseY = 0;
  
  function handleMouseMove(e) {
    if (!isSelecting) return;
    
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    const target = getElementAtPoint(e.clientX, e.clientY, e.shiftKey);
    if (!target || isOurElement(target)) return;
    
    hoveredElement = target;
    currentDepthElement = target;
    updateOverlay(target);
  }
  
  // Click handler for selection
  function handleClick(e) {
    if (!isSelecting) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Use current navigated element or hovered element
    const target = currentDepthElement || hoveredElement;
    if (!target || isOurElement(target)) return;
    
    selectedElement = target;
    isSelecting = false;
    
    // Hide hover overlay and help, show selection indicator
    overlay.style.display = 'none';
    label.style.display = 'none';
    helpTooltip.style.display = 'none';
    
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
  
  // Keyboard handler for navigation
  function handleKeyDown(e) {
    if (!isSelecting) return;
    
    // Escape - cancel selection
    if (e.key === 'Escape') {
      stopSelection();
      return;
    }
    
    // Navigation keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 's', 'S', 'a', 'A', 'd', 'D'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          goToParent();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          goToChild();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          goToSibling(-1);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          goToSibling(1);
          break;
      }
    }
    
    // Enter - confirm selection
    if (e.key === 'Enter' && currentDepthElement) {
      e.preventDefault();
      handleClick(e);
    }
  }
  
  // Stop selection mode
  function stopSelection() {
    isSelecting = false;
    currentDepthElement = null;
    overlay.style.display = 'none';
    label.style.display = 'none';
    helpTooltip.style.display = 'none';
    document.body.style.cursor = '';
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startSelection') {
      isSelecting = true;
      selectedElement = null;
      currentDepthElement = null;
      selectionIndicator.style.display = 'none';
      helpTooltip.style.display = 'block';
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
    
    else if (message.action === 'selectBySelector') {
      let selector = message.selector;
      
      // Auto-add . if it looks like a class without prefix
      if (selector && !selector.startsWith('.') && !selector.startsWith('#') && !selector.includes(' ') && !selector.includes('[') && !selector.includes(':')) {
        // Try as-is first (could be a tag name), then try with .
        try {
          const directMatch = document.querySelectorAll(selector);
          if (directMatch.length === 0) {
            selector = '.' + selector;
          }
        } catch (e) {
          selector = '.' + selector;
        }
      }
      
      try {
        const elements = document.querySelectorAll(selector);
        
        if (elements.length === 0) {
          sendResponse({ success: false, error: `No se encontró: ${selector}` });
          return true;
        }
        
        // Filter out our own elements
        matchedElements = Array.from(elements).filter(el => !isOurElement(el));
        
        if (matchedElements.length === 0) {
          sendResponse({ success: false, error: `No se encontró: ${selector}` });
          return true;
        }
        
        currentMatchIndex = 0;
        selectedElement = matchedElements[0];
        
        // Scroll element into view
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Show selection indicator
        const rect = selectedElement.getBoundingClientRect();
        setTimeout(() => {
          const newRect = selectedElement.getBoundingClientRect();
          selectionIndicator.style.display = 'block';
          selectionIndicator.style.top = newRect.top + 'px';
          selectionIndicator.style.left = newRect.left + 'px';
          selectionIndicator.style.width = newRect.width + 'px';
          selectionIndicator.style.height = newRect.height + 'px';
        }, 300);
        
        sendResponse({
          success: true,
          hasSelection: true,
          tagName: selectedElement.tagName,
          id: selectedElement.id || '',
          className: typeof selectedElement.className === 'string' ? 
            selectedElement.className.split(' ').filter(c => !c.startsWith('psd-')).join(' ') : '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          pageTitle: document.title,
          pageUrl: window.location.href,
          matchCount: matchedElements.length,
          currentIndex: currentMatchIndex
        });
      } catch (e) {
        sendResponse({ success: false, error: `Selector inválido: ${e.message}` });
      }
    }
    
    else if (message.action === 'navigateMatch') {
      if (matchedElements.length === 0) {
        sendResponse({ success: false, error: 'No hay elementos para navegar' });
        return true;
      }
      
      currentMatchIndex += message.direction;
      if (currentMatchIndex < 0) currentMatchIndex = matchedElements.length - 1;
      if (currentMatchIndex >= matchedElements.length) currentMatchIndex = 0;
      
      selectedElement = matchedElements[currentMatchIndex];
      
      // Scroll element into view
      selectedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Update selection indicator
      setTimeout(() => {
        const rect = selectedElement.getBoundingClientRect();
        selectionIndicator.style.display = 'block';
        selectionIndicator.style.top = rect.top + 'px';
        selectionIndicator.style.left = rect.left + 'px';
        selectionIndicator.style.width = rect.width + 'px';
        selectionIndicator.style.height = rect.height + 'px';
      }, 300);
      
      const rect = selectedElement.getBoundingClientRect();
      sendResponse({
        success: true,
        hasSelection: true,
        tagName: selectedElement.tagName,
        id: selectedElement.id || '',
        className: typeof selectedElement.className === 'string' ? 
          selectedElement.className.split(' ').filter(c => !c.startsWith('psd-')).join(' ') : '',
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        pageTitle: document.title,
        pageUrl: window.location.href,
        matchCount: matchedElements.length,
        currentIndex: currentMatchIndex
      });
    }
    
    else if (message.action === 'getContent') {
      if (!selectedElement) {
        sendResponse({ content: null, error: 'No hay elemento seleccionado' });
        return true;
      }
      
      let content = '';
      let sourceElement = selectedElement;
      
      // Try to get content from iframe if the selected element is an iframe
      if (selectedElement.tagName === 'IFRAME') {
        try {
          const iframeDoc = selectedElement.contentDocument || selectedElement.contentWindow?.document;
          if (iframeDoc) {
            sourceElement = iframeDoc.body || iframeDoc.documentElement;
          } else {
            sendResponse({ 
              content: null, 
              error: 'No se puede acceder al contenido del iframe (cross-origin protegido)' 
            });
            return true;
          }
        } catch (e) {
          sendResponse({ 
            content: null, 
            error: 'Iframe protegido por política de seguridad: ' + e.message 
          });
          return true;
        }
      }
      
      // Try to access shadow DOM content
      if (sourceElement.shadowRoot) {
        try {
          sourceElement = sourceElement.shadowRoot;
        } catch (e) {
          // Closed shadow root, can't access
        }
      }
      
      try {
        if (message.format === 'html') {
          if (message.includeStyles) {
            content = getHtmlWithStyles(sourceElement);
          } else {
            content = sourceElement.outerHTML || sourceElement.innerHTML;
          }
          
          // If content is too small, try to get from nested iframes
          if (!content || content.length < 50) {
            const iframeContent = getContentFromIframes(sourceElement);
            if (iframeContent && iframeContent.length > content.length) {
              content = iframeContent;
            }
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
          // Try multiple methods to get text
          content = sourceElement.innerText || sourceElement.textContent || '';
          
          // If no content, try selection API
          if (!content.trim()) {
            content = getVisibleText(sourceElement);
          }
          
          // If still no content, try getting from nested iframes
          if (!content.trim()) {
            const iframeContent = getContentFromIframes(sourceElement);
            if (iframeContent) {
              const temp = document.createElement('div');
              temp.innerHTML = iframeContent;
              content = temp.innerText || temp.textContent || '';
            }
          }
          
          if (!content.trim()) {
            sendResponse({ 
              content: null, 
              error: 'El elemento no tiene contenido de texto accesible' 
            });
            return true;
          }
        }
        
        else if (message.format === 'markdown') {
          content = htmlToMarkdown(sourceElement);
          content = `<!-- Extracted from: ${window.location.href} -->\n\n${content}`;
        }
        
        if (!content || content.trim().length < 10) {
          sendResponse({ 
            content: null, 
            error: 'No se pudo extraer contenido (puede estar protegido o vacío)' 
          });
          return true;
        }
        
        sendResponse({ content: content });
      } catch (e) {
        sendResponse({ 
          content: null, 
          error: 'Error al extraer contenido: ' + e.message 
        });
      }
    }
    
    return true;
  });
  
  // Get HTML with computed styles inlined
  function getHtmlWithStyles(element) {
    const clone = element.cloneNode(true);
    
    // Get computed styles for the element and all descendants
    function inlineStyles(el, originalEl) {
      if (!originalEl || !el) return;
      
      try {
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
      } catch (e) {
        // Ignore style errors
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
    return clone.outerHTML || clone.innerHTML || '';
  }
  
  // Alternative method: get content from nested iframes
  function getContentFromIframes(element) {
    let content = '';
    const iframes = element.querySelectorAll('iframe');
    
    for (const iframe of iframes) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc && doc.body) {
          content += doc.body.innerHTML || '';
        }
      } catch (e) {
        // Cross-origin, skip
      }
    }
    
    return content;
  }
  
  // Alternative method: use Selection API to get visible text
  function getVisibleText(element) {
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
      const text = selection.toString();
      selection.removeAllRanges();
      return text;
    } catch (e) {
      return element.innerText || element.textContent || '';
    }
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
    helpTooltip.remove();
  });
})();
