# Page Section Downloader

A Chrome extension that lets you select and download sections of a webpage with automatically generated filenames.

## Features

- **Visual Element Selection**: Click to select any element on the page with visual highlighting
- **Multiple Export Formats**: Download as HTML, plain text, or Markdown
- **Auto-Generated Filenames**: Smart filename generation based on page title, element ID/class, and timestamp
- **Style Preservation**: Option to include inline styles in HTML exports
- **Markdown Conversion**: Converts HTML structure to proper Markdown syntax

## Installation

### Load as Unpacked Extension (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** using the toggle in the top right corner
3. Click **Load unpacked**
4. Select the `page-section-downloader` folder
5. The extension icon will appear in your toolbar

## How to Use

1. **Click the extension icon** in your Chrome toolbar to open the popup
2. **Click "Select Element"** to enter selection mode
3. **Hover over elements** on the page - they will be highlighted with a green border
4. **Click on the element** you want to download
5. **Choose your options**:
   - Edit the auto-generated filename if desired
   - Select format: HTML, Text, or Markdown
   - Toggle "Include inline styles" for HTML exports
6. **Click "Download Section"** to save the file

## Keyboard Shortcuts

- **Escape**: Cancel element selection mode

## Export Formats

### HTML
- Full HTML document with proper structure
- Optional inline styles from the original page
- Source URL included as a comment

### Text
- Plain text extraction of the element content
- Preserves text content only, no formatting

### Markdown
- Converts HTML to Markdown syntax
- Supports headings, lists, links, images, code blocks, and more
- Source URL included as a comment

## Filename Generation

The auto-generated filename includes:
1. Page title (sanitized, first 30 characters)
2. Element identifier (ID, first class, or tag name)
3. Timestamp (YYYYMMDD-HHMM format)

Example: `my-awesome-page_main-content_20241226-1430.html`

## Permissions

- **activeTab**: Access the current tab to select elements
- **downloads**: Save files to your computer
- **scripting**: Inject content scripts for element selection

## Troubleshooting

**Extension icon doesn't appear?**
- Make sure the extension is enabled in `chrome://extensions/`
- Try pinning the extension by clicking the puzzle piece icon in Chrome

**Can't select elements?**
- Refresh the page and try again
- Some elements in iframes may not be selectable

**Download doesn't start?**
- Check your Chrome download settings
- Make sure you haven't blocked downloads from extensions

## License

MIT License - Feel free to modify and distribute!
