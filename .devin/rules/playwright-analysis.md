---
description: Guidelines for using Playwright MCP to analyze web pages
activationMode: auto-glob
pathPatterns: 
  - "parsers/*.js"
  - "content.js"
---

# Playwright Analysis for Parser Development

When creating or modifying parsers using Playwright MCP, follow these steps:

## 1. Navigation

Always navigate to the target URL first:

```
mcp1_browser_navigate to the provided URL
```

Wait for page load before proceeding.

## 2. Initial Analysis

Take a snapshot to understand page structure:

```
mcp1_browser_snapshot with depth 5
```

## 3. DOM Exploration

Use `browser_evaluate` to test selectors:

```javascript
() => {
  // Test potential selectors
  const tests = {
    messages: document.querySelectorAll('[class*="message"]').length,
    userBubbles: document.querySelectorAll('.user-bubble').length,
    assistantMessages: document.querySelectorAll('.assistant').length,
    
    // Get sample content
    samples: [...document.querySelectorAll('.message')]
      .slice(0, 3)
      .map(el => ({
        className: el.className,
        textPreview: el.innerText?.substring(0, 50)
      }))
  };
  
  return tests;
}
```

## 4. Selector Strategy

Look for these patterns in order of preference:

1. **Semantic classes**: `.message.user`, `.message.assistant`
2. **Data attributes**: `[data-role="user"]`, `[data-testid="message"]`
3. **ARIA labels**: `[aria-label="User message"]`
4. **Container groups**: `.chat-turn`, `.conversation-round`

## 5. Extraction Testing

Test the full parser logic directly in the browser:

```javascript
() => {
  // Simulate parser extraction
  const messages = [];
  const rounds = document.querySelectorAll('.tap-round');
  
  rounds.forEach((round, index) => {
    const userText = round.querySelector('.user-bubble')?.innerText;
    const assistantText = round.querySelector('.assistant')?.innerText;
    
    if (userText) messages.push({ role: 'user', content: userText, index });
    if (assistantText) messages.push({ role: 'assistant', content: assistantText, index });
  });
  
  return { count: messages.length, messages };
}
```

## 6. Verification

Before completing:
- Verify all message roles are correctly identified
- Check that conversation order is preserved
- Ensure text content is properly cleaned
- Test edge cases (empty messages, loading states)

## Output

Provide the user with:
1. Discovered CSS selectors
2. Proposed parser implementation
3. Suggested URL pattern
4. Integration steps
