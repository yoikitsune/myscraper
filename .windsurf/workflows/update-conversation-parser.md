---
description: Update an existing conversation parser when a site changes its DOM structure
---

# Workflow: Update Conversation Parser

This workflow helps you update an existing parser when a website has changed its structure or when extraction is no longer working.

## When to Use This Workflow

Use this workflow when:
- Extraction returns "No conversation found"
- The site has been redesigned (new layout, CSS classes changed)
- Selectors in the parser are obsolete
- You want to add new features (sources, thought process, etc.)
- The parser was working before but stopped working recently

## Prerequisites

- MCP Playwright server configured and running
- Name of the parser to update (e.g., "brave-search", "zai")
- URL of the site to test (optional - will use pattern from parser)

## Steps

### 1. Identify the Parser to Update

Ask the user which parser needs updating:
- Parser name/file (e.g., "brave-search", "zai", "chatgpt")
- URL to test on (if specific page has issues)

### 2. Read the Current Parser Implementation

Open and analyze the existing parser file:

```
Read parsers/<parser-name>.js
Read content.js (to see how it's integrated)
```

Document the current implementation:
- URL pattern used
- CSS selectors for user messages
- CSS selectors for assistant messages
- Extraction logic and methods
- Current capabilities (sources, thought process)

### 3. Navigate to the Site with Playwright

Use MCP Playwright to open the target site:

```
mcp1_browser_navigate to the site's URL
```

// turbo - auto-run navigation

Wait for the page to fully load, including any dynamic content.

### 4. Analyze the Current DOM Structure

Run JavaScript evaluation to find the new conversation elements:

```javascript
() => {
  // Look for message containers
  const tests = {
    // Test old selectors first
    oldUserSelector: document.querySelectorAll('.user-bubble, .message.user').length,
    oldAssistantSelector: document.querySelectorAll('.message.assistant, .llm-output').length,
    
    // Search for new patterns
    userPatterns: [...document.querySelectorAll('*')]
      .filter(el => el.className?.toLowerCase().includes('user') && el.innerText?.length > 10)
      .slice(0, 5)
      .map(el => ({ class: el.className, tag: el.tagName })),
    
    assistantPatterns: [...document.querySelectorAll('*')]
      .filter(el => (el.className?.toLowerCase().includes('assistant') || 
                     el.className?.toLowerCase().includes('ai')) && 
                     el.innerText?.length > 20)
      .slice(0, 5)
      .map(el => ({ class: el.className, tag: el.tagName }))
  };
  
  return tests;
}
```

// turbo - auto-run DOM analysis

### 5. Test New Selectors

Verify the new selectors work:

```javascript
() => {
  // Test the new selectors
  const newSelectors = {
    userMessages: document.querySelectorAll('<new-user-selector>').length,
    assistantMessages: document.querySelectorAll('<new-assistant-selector>').length
  };
  
  // Get sample content
  const samples = {
    user: [...document.querySelectorAll('<new-user-selector>')]
      .slice(0, 2)
      .map(el => el.innerText?.substring(0, 100)),
    assistant: [...document.querySelectorAll('<new-assistant-selector>')]
      .slice(0, 2)
      .map(el => el.innerText?.substring(0, 100))
  };
  
  return { newSelectors, samples };
}
```

### 6. Check for New Features

Look for additional features that could be extracted:

```javascript
() => {
  const features = {
    // Look for sources/references
    sources: document.querySelectorAll('.sources, .references, [class*="source"], [class*="citation"]').length,
    
    // Look for thought process / reasoning
    thoughtProcess: document.querySelectorAll('.thought-process, .reasoning, [class*="thought"], details').length,
    
    // Look for timestamps
    timestamps: document.querySelectorAll('.timestamp, .time, [class*="date"]').length,
    
    // Look for model name
    modelInfo: [...document.querySelectorAll('*')]
      .filter(el => el.innerText?.match(/GPT|Claude|GLM|AI|Model/i))
      .slice(0, 3)
      .map(el => ({ text: el.innerText?.substring(0, 50), class: el.className }))
  };
  
  return features;
}
```

### 7. Update the Parser File

Modify the parser with the corrected selectors and logic:

#### For `parsers/<parser-name>.js`:

Update these sections:
1. **URL pattern** (if site URL structure changed)
2. **extract() method** - Update selectors
3. **Capabilities** - Add new features if discovered
4. **toMarkdown()** - Handle new data structures

Example changes:
```javascript
// OLD (broken)
const userMessages = document.querySelectorAll('.user-bubble');

// NEW (fixed)
const userMessages = document.querySelectorAll('.chat-user, .user-message .content');
```

### 8. Synchronize with content.js

Ensure the parser in `content.js` matches the updated standalone version:

```javascript
// In content.js, update the inline parser class
class UpdatedParser {
  // Copy the updated implementation from parsers/<parser-name>.js
}
```

### 9. Test the Updated Parser

Validate the extraction works:

```javascript
// Test the parser directly in the browser
const parser = new UpdatedParser();
const data = parser.extract();
console.log('Messages found:', data.messages.length);

// Test Markdown generation
const markdown = parser.toMarkdown(data, { 
  username: 'Test', 
  includeSources: true 
});
console.log('Markdown preview:', markdown.substring(0, 500));
```

// turbo - auto-run parser test

### 10. Provide Update Summary

Report to the user:

1. **What changed** in the site's DOM
2. **Old selectors** → **New selectors**
3. **New features** added (if any)
4. **Files modified**
5. **Testing results**

### 11. Rebuild and Test Instructions

Provide these steps to the user:

```
1. Recharger l'extension: chrome://extensions/ → 🔄 Recharger
2. Rafraîchir la page du site
3. Ouvrir le popup de l'extension
4. Tester l'extraction
5. Vérifier que les sources/thought process fonctionnent (si activés)
```

## Troubleshooting Common Issues

### No messages found after update

- Check if the page is fully loaded (wait for dynamic content)
- Try scrolling to load more messages
- Verify selectors match exactly (class names are case-sensitive)

### Partial extraction (some messages missing)

- The site may use lazy loading - need to scroll before extracting
- Check for multiple message container types
- Add fallback selectors in extractAlternative()

### Sources not extracted

- Check if sources are in a separate panel/sidebar
- Look for buttons that need to be clicked to reveal sources
- May need to auto-click "Show sources" buttons before extraction

## Completion Checklist

- [ ] Parser file updated with new selectors
- [ ] content.js synchronized with changes
- [ ] Extraction tested and working
- [ ] Markdown output verified
- [ ] New features documented (if added)
- [ ] User informed of changes

## Example Update Scenario

**Problem**: Brave Search Ask changed `.user-bubble` to `.chat-user`

**Solution**:
```javascript
// In extract() method, update:
const userBubble = round.querySelector('.chat-user'); // Changed from .user-bubble
```

**Test**: Verify extraction finds messages again.

---

## Notes

- Keep a backup of the old parser version (git commit before changes)
- Document the date of the update and what changed on the site
- Some sites change frequently - consider making selectors more flexible
- If a site has A/B testing, test on multiple pages
