// Content script for AWS Course Extractor

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.awsExtractorInjected) return;
  window.awsExtractorInjected = true;

  // Configuración
  const CONFIG = {
    imageFolder: 'images/',
    outputFileName: 'course-content.md'
  };

  // Almacén de imágenes encontradas
  const imagesFound = [];

  /**
   * Extrae texto limpio de un elemento HTML
   */
  function cleanText(element) {
    if (!element) return '';
    let text = element.innerText || element.textContent || '';
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Convierte contenido HTML a Markdown básico
   */
  function htmlToMarkdown(element) {
    if (!element) return '';

    let markdown = '';
    const children = element.childNodes;

    children.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        markdown += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();

        switch (tag) {
          case 'strong':
          case 'b':
            markdown += `**${htmlToMarkdown(node)}**`;
            break;
          case 'em':
          case 'i':
            markdown += `*${htmlToMarkdown(node)}*`;
            break;
          case 'p':
            markdown += htmlToMarkdown(node) + '\n\n';
            break;
          case 'br':
            markdown += '\n';
            break;
          case 'ul':
            node.querySelectorAll(':scope > li').forEach(li => {
              markdown += `- ${cleanText(li)}\n`;
            });
            markdown += '\n';
            break;
          case 'ol':
            let index = 1;
            node.querySelectorAll(':scope > li').forEach(li => {
              markdown += `${index}. ${cleanText(li)}\n`;
              index++;
            });
            markdown += '\n';
            break;
          case 'a':
            const href = node.getAttribute('href');
            const linkText = cleanText(node);
            if (href) {
              markdown += `[${linkText}](${href})`;
            } else {
              markdown += linkText;
            }
            break;
          case 'h1':
            markdown += `# ${cleanText(node)}\n\n`;
            break;
          case 'h2':
            markdown += `## ${cleanText(node)}\n\n`;
            break;
          case 'h3':
            markdown += `### ${cleanText(node)}\n\n`;
            break;
          case 'h4':
            markdown += `#### ${cleanText(node)}\n\n`;
            break;
          case 'span':
          case 'div':
            markdown += htmlToMarkdown(node);
            break;
          default:
            markdown += htmlToMarkdown(node);
        }
      }
    });

    return markdown;
  }

  /**
   * Procesa una imagen y la registra
   */
  function processImage(imgElement, altText = '') {
    if (!imgElement) return '';

    const src = imgElement.getAttribute('src');
    if (!src) return '';

    const alt = altText || imgElement.getAttribute('alt') || 'image';
    const fileName = src.split('/').pop().split('?')[0];

    imagesFound.push({
      originalSrc: src,
      fileName: fileName,
      alt: alt
    });

    return `![${alt}](${CONFIG.imageFolder}${fileName})`;
  }

  /**
   * Extrae el título principal
   */
  function extractTitle() {
    const titleEl = document.querySelector('.lesson-header__title h1');
    if (titleEl) {
      return `# ${cleanText(titleEl)}\n\n`;
    }
    return '';
  }

  /**
   * Procesa bloques de texto
   */
  function processTextBlock(block) {
    let markdown = '';

    // Verificar si es un encabezado
    const heading = block.querySelector('h1, h2, h3, h4');
    if (heading) {
      const level = heading.tagName.toLowerCase();
      const prefix = level === 'h1' ? '#' : level === 'h2' ? '##' : level === 'h3' ? '###' : '####';
      markdown += `${prefix} ${cleanText(heading)}\n\n`;
    }

    // Contenido de texto regular
    const frViews = block.querySelectorAll('.fr-view');
    frViews.forEach(frView => {
      if (!frView.closest('h1, h2, h3, h4')) {
        const content = htmlToMarkdown(frView);
        if (content.trim()) {
          markdown += content.trim() + '\n\n';
        }
      }
    });

    return markdown;
  }

  /**
   * Procesa bloques de imagen
   */
  function processImageBlock(block) {
    let markdown = '';

    // Imagen principal
    const img = block.querySelector('.block-image__image img, .img img');
    if (img) {
      markdown += processImage(img) + '\n\n';
    }

    // Texto asociado a la imagen
    const imageText = block.querySelector('.block-image__text, .block-image__paragraph');
    if (imageText) {
      const frView = imageText.querySelector('.fr-view');
      if (frView) {
        markdown += htmlToMarkdown(frView).trim() + '\n\n';
      }
    }

    // Caption
    const caption = block.querySelector('.block-image__caption');
    if (caption) {
      const captionText = cleanText(caption);
      if (captionText) {
        markdown += `*${captionText}*\n\n`;
      }
    }

    return markdown;
  }

  /**
   * Procesa acordeones
   */
  function processAccordion(block) {
    let markdown = '';

    const items = block.querySelectorAll('.blocks-accordion__item');
    items.forEach(item => {
      // Título del acordeón
      const title = item.querySelector('.blocks-accordion__title');
      if (title) {
        markdown += `### ${cleanText(title)}\n\n`;
      }

      // Contenido del acordeón
      const description = item.querySelector('.blocks-accordion__description');
      if (description) {
        const frView = description.querySelector('.fr-view');
        if (frView) {
          markdown += htmlToMarkdown(frView).trim() + '\n\n';
        }
      }

      // Imagen del acordeón
      const accordionImg = item.querySelector('.blocks-accordion__image img');
      if (accordionImg) {
        markdown += processImage(accordionImg) + '\n\n';
      }
    });

    return markdown;
  }

  /**
   * Procesa galerías
   */
  function processGallery(block) {
    let markdown = '';

    const figures = block.querySelectorAll('.block-gallery__col figure');
    figures.forEach(figure => {
      const img = figure.querySelector('img');
      if (img) {
        markdown += processImage(img) + '\n\n';
      }

      const caption = figure.querySelector('.block-gallery__caption');
      if (caption) {
        const frView = caption.querySelector('.fr-view');
        if (frView) {
          markdown += htmlToMarkdown(frView).trim() + '\n\n';
        }
      }
    });

    return markdown;
  }

  /**
   * Procesa botones/enlaces
   */
  function processButton(block) {
    let markdown = '';

    const description = block.querySelector('.blocks-button__description');
    if (description) {
      const frView = description.querySelector('.fr-view');
      if (frView) {
        markdown += htmlToMarkdown(frView).trim() + '\n\n';
      }
    }

    const button = block.querySelector('.blocks-button__button');
    if (button) {
      const href = button.getAttribute('href');
      const text = cleanText(button);
      if (href && text) {
        markdown += `🔗 [${text}](${href})\n\n`;
      }
    }

    return markdown;
  }

  /**
   * Procesa listas
   */
  function processList(block) {
    let markdown = '';

    const items = block.querySelectorAll('.block-list__item');
    items.forEach(item => {
      const content = item.querySelector('.block-list__content');
      if (content) {
        const text = cleanText(content);
        if (text) {
          markdown += `- ${text}\n`;
        }
      }
    });

    return markdown + '\n';
  }

  /**
   * Procesa bloques de impacto/nota
   */
  function processImpact(block) {
    let markdown = '';

    const quote = block.querySelector('.block-impact__quote');
    if (quote) {
      const frView = quote.querySelector('.fr-view');
      if (frView) {
        const content = htmlToMarkdown(frView).trim();
        // Convertir a blockquote
        markdown += '> ' + content.replace(/\n/g, '\n> ') + '\n\n';
      }
    }

    return markdown;
  }

  /**
   * Procesa videos
   */
  function processVideo(block) {
    let markdown = '';

    // Poster del video
    const video = block.querySelector('video');
    if (video) {
      const poster = video.getAttribute('poster');
      if (poster) {
        imagesFound.push({
          originalSrc: poster,
          fileName: poster.split('/').pop().split('?')[0],
          alt: 'Video thumbnail'
        });
      }
    }

    // Caption del video
    const caption = block.querySelector('.block-video__caption');
    if (caption) {
      const frView = caption.querySelector('.fr-view');
      if (frView) {
        markdown += `**Video:** ${cleanText(frView)}\n\n`;
      }
    }

    // Fuente del video
    const source = block.querySelector('source');
    if (source) {
      const src = source.getAttribute('src');
      if (src) {
        markdown += `📹 Video: \`${src.split('/').pop()}\`\n\n`;
      }
    }

    return markdown;
  }

  /**
   * Procesa preguntas de conocimiento
   */
  function processKnowledgeCheck(block) {
    let markdown = '';

    // Pregunta
    const questionTitle = block.querySelector('.quiz-card__title');
    if (questionTitle) {
      const frView = questionTitle.querySelector('.fr-view');
      if (frView) {
        markdown += `**❓ Pregunta:** ${cleanText(frView)}\n\n`;
      }
    }

    // Opciones
    const options = block.querySelectorAll('.quiz-multiple-response-option-wrap');
    options.forEach((option, index) => {
      const label = option.querySelector('[id^="qmr-"]');
      if (label) {
        const frView = label.querySelector('.fr-view');
        if (frView) {
          markdown += `${String.fromCharCode(65 + index)}. ${cleanText(frView)}\n`;
        }
      }
    });
    markdown += '\n';

    // Feedback
    const feedback = block.querySelector('.quiz-card__feedback-text');
    if (feedback) {
      const frView = feedback.querySelector('.fr-view');
      if (frView) {
        markdown += `**Respuesta:** ${cleanText(frView)}\n\n`;
      }
    }

    return markdown;
  }

  /**
   * Función principal de extracción
   */
  function extractCourse() {
    let markdown = '';
    imagesFound.length = 0; // Limpiar array

    // Título
    markdown += extractTitle();

    // Procesar todos los bloques en orden
    const blocks = document.querySelectorAll('[data-ba="lessonEdit.block"]');

    blocks.forEach(block => {
      // Determinar tipo de bloque
      if (block.querySelector('.block-text')) {
        markdown += processTextBlock(block);
      }
      else if (block.querySelector('.block-image')) {
        markdown += processImageBlock(block);
      }
      else if (block.querySelector('.blocks-accordion')) {
        markdown += processAccordion(block);
      }
      else if (block.querySelector('.block-gallery')) {
        markdown += processGallery(block);
      }
      else if (block.querySelector('.blocks-button')) {
        markdown += processButton(block);
      }
      else if (block.querySelector('.block-list')) {
        markdown += processList(block);
      }
      else if (block.querySelector('.block-impact')) {
        markdown += processImpact(block);
      }
      else if (block.querySelector('.block-video')) {
        markdown += processVideo(block);
      }
      else if (block.querySelector('.block-knowledge')) {
        markdown += processKnowledgeCheck(block);
      }
    });

    // Limpiar markdown
    markdown = markdown
      .replace(/\n{3,}/g, '\n\n')  // Máximo 2 saltos de línea
      .replace(/^\s+|\s+$/g, '');   // Trim

    return {
      markdown: markdown,
      images: imagesFound
    };
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractCourse') {
      const { downloadMarkdown, downloadImagesList, downloadImages, imageDelay } = message.options;

      const result = extractCourse();

      // Download Markdown
      if (downloadMarkdown) {
        chrome.runtime.sendMessage({
          action: 'download',
          content: result.markdown,
          filename: CONFIG.outputFileName,
          mimeType: 'text/markdown'
        });
      }

      // Download Images List
      if (downloadImagesList) {
        chrome.runtime.sendMessage({
          action: 'download',
          content: JSON.stringify(result.images, null, 2),
          filename: 'images-list.json',
          mimeType: 'application/json'
        });
      }

      // Download Images
      if (downloadImages) {
        result.images.forEach((img, index) => {
          setTimeout(() => {
            chrome.runtime.sendMessage({
              action: 'download',
              url: img.originalSrc,
              filename: CONFIG.imageFolder + img.fileName
            });
          }, index * imageDelay);
        });
      }

      sendResponse({ success: true });
    }
    return true;
  });

})();
