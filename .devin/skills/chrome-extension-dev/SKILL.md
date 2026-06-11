---
name: chrome-extension-dev
description: Develop Chrome extensions for content extraction with modular parsers
version: 1.0.0
---

# Chrome Extension Development

This skill provides guidance for developing Chrome extensions that extract content from web pages using modular parsers.

## Architecture

### Extension Structure

```
myscraper/
├── manifest.json          # Extension manifest v3
├── content.js             # Content script with parser registry
├── popup.html/.js/.css    # Extension popup UI
├── parsers/               # Modular parsers directory
│   ├── brave-search.js
│   └── [new-parser].js
└── icons/                 # Extension icons
```

### Parser Pattern

Each parser must implement:

```javascript
class ParserName {
  constructor() {
    this.name = 'Human Readable Name';
    this.urlPattern = /regex-to-match-url/;
  }

  isMatch(url) {
    return this.urlPattern.test(url);
  }

  extract() {
    // Return structured data object
    return {
      site: this.name,
      url: window.location.href,
      title: document.title,
      date: new Date().toISOString(),
      messages: [
        { role: 'user', content: '...', index: 0 },
        { role: 'assistant', content: '...', index: 0 }
      ]
    };
  }

  cleanText(text) {
    // Normalize extracted text
    return text?.replace(/\n\s*\n/g, '\n').trim() || '';
  }

  toMarkdown(data) {
    // Convert structured data to Markdown
    return `# Title\n\n## User\n\nContent...`;
  }
}
```

## Development Guidelines

### Content Script Design
- **Detection**: Use URL patterns to match sites
- **Extraction**: Query DOM with specific, tested selectors
- **Fallbacks**: Try alternative selectors if primary fails
- **Cleanup**: Normalize whitespace, remove redundant newlines

### Parser Registration

Parsers are registered in `content.js`:

```javascript
const parsers = [
  new BraveSearchParser(),
  new ChatGPTParser(),
  // Add new parsers here
];

function getParser() {
  const url = window.location.href;
  return parsers.find(parser => parser.isMatch(url));
}
```

### Testing with Playwright

When adding a new parser:

1. Use MCP Playwright to open the target site
2. Analyze DOM structure with `browser_evaluate`
3. Identify message containers and role indicators
4. Test selectors directly in browser console
5. Create parser based on findings

### DOM Analysis Pattern

```javascript
// Test in Playwright
const analysis = {
  // Find all message containers
  messages: document.querySelectorAll('[class*="message"]'),
  
  // Identify user vs assistant
  userClasses: [...document.querySelectorAll('*')]
    .filter(el => el.className?.includes('user')),
  assistantClasses: [...document.querySelectorAll('*')]
    .filter(el => el.className?.includes('assistant'))
};
```

## Extension Lifecycle

1. **Load**: Chrome loads manifest, registers content scripts
2. **Inject**: Content script runs on matching pages
3. **Detect**: Parser matching URL pattern is selected
4. **Extract**: User triggers extraction via popup
5. **Output**: Markdown is copied to clipboard or downloaded

## Best Practices

- **Specific selectors**: Prefer class names over tag names
- **Multiple strategies**: Implement fallback extraction methods
- **Error handling**: Return empty arrays rather than crashing
- **Content normalization**: Strip excessive whitespace
- **URL patterns**: Use specific regexes to avoid false matches
