---
description: Add a new conversation parser for an unsupported AI platform using Playwright analysis
---

# Workflow: Add Conversation Parser

This workflow guides you through adding a new parser for an unsupported AI conversation platform.

## Prerequisites

- MCP Playwright server configured and running
- URL of the unsupported platform to analyze

## Steps

### 1. Analyze the Target Page

Ask the user for the URL to analyze, then open it with Playwright:

```
Use MCP Playwright to navigate to the provided URL
```

// turbo - auto-run navigation when URL provided

### 2. Extract DOM Structure

Run JavaScript evaluation on the page to find conversation elements:

```javascript
// Look for conversation patterns
const selectors = [
  '[class*="message"]',
  '[class*="chat"]',
  '[class*="conversation"]',
  '[class*="turn"]',
  '[class*="bubble"]',
  '[class*="query"]',
  '[class*="answer"]'
];

// Find user/assistant message containers
// Look for distinguishing classes, data attributes, or ARIA labels
```

// turbo - auto-run DOM analysis

### 3. Identify Selectors

Document the key CSS selectors found:
- **User messages**: `.user-message`, `[data-role="user"]`, etc.
- **Assistant messages**: `.assistant-message`, `.ai-response`, etc.
- **Message containers**: parent elements that group user+assistant pairs
- **Metadata**: timestamps, model names, message IDs if available

### 4. Create Parser File

Create a new parser in `parsers/` directory:

```javascript
// parsers/<site-name>.js
class <SiteName>Parser {
  constructor() {
    this.name = '<Site Name>';
    this.urlPattern = /<regex-pattern>/;
  }

  isMatch(url) {
    return this.urlPattern.test(url);
  }

  extract() {
    const messages = [];
    
    // Use discovered selectors
    const messageElements = document.querySelectorAll('<discovered-selector>');
    
    messageElements.forEach((el, index) => {
      // Determine role (user/assistant)
      const isUser = el.classList.contains('user') || el.matches('[data-role="user"]');
      
      messages.push({
        role: isUser ? 'user' : 'assistant',
        content: this.cleanText(el.innerText),
        index: index
      });
    });

    return {
      site: this.name,
      url: window.location.href,
      title: document.title,
      date: new Date().toISOString(),
      messages: messages
    };
  }

  cleanText(text) {
    return text?.replace(/\n\s*\n/g, '\n').trim() || '';
  }

  toMarkdown(data) {
    let md = `# ${data.title}\n\n`;
    md += `**Site**: ${data.site}\n`;
    md += `**URL**: ${data.url}\n`;
    md += `**Date**: ${data.date}\n\n---\n\n`;

    data.messages.forEach((msg) => {
      md += `## ${msg.role === 'user' ? 'Utilisateur' : 'Assistant'}\n\n${msg.content}\n\n---\n\n`;
    });

    return md;
  }
}
```

### 5. Register Parser

Add the parser to `content.js`:

1. Import the parser class
2. Add instance to `parsers` array

```javascript
// In content.js
const parsers = [
  new BraveSearchParser(),
  new <SiteName>Parser()  // Add new parser here
];
```

### 6. Test Parser

Test the parser by:
1. Loading the extension in Chrome (chrome://extensions/ → Developer mode → Load unpacked)
2. Navigating to the target site
3. Clicking the extension icon
4. Verifying extraction works

### 7. Update Manifest (if needed)

Add the new site to `host_permissions` in `manifest.json`:

```json
{
  "host_permissions": [
    "https://search.brave.com/*",
    "https://<new-site>/*"
  ]
}
```

## Completion

Verify the parser works end-to-end and commit the changes.
