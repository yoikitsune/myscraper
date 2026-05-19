---
description: Project-specific guidelines for Chrome extension development
activationMode: always
---

# Chrome Extension Project Guidelines

## Code Style

- Use ES6+ features (classes, arrow functions, const/let)
- Prefer explicit class methods over anonymous functions
- Use template literals for string concatenation
- Add JSDoc comments for parser classes

## File Organization

- One parser per file in `parsers/` directory
- Parser filename should match the site (kebab-case)
- Class name should be PascalCase and end with `Parser`

## Parser Implementation

### Required Methods

1. `constructor()` - Set name and URL pattern
2. `isMatch(url)` - Return boolean for URL match
3. `extract()` - Return structured data object
4. `cleanText(text)` - Normalize extracted text
5. `toMarkdown(data)` - Convert to Markdown format

### Data Structure

Extracted data must follow this structure:

```javascript
{
  site: "Site Name",
  url: "https://...",
  title: "Page Title",
  date: "ISO8601 timestamp",
  messages: [
    {
      role: "user" | "assistant",
      content: "Message text",
      index: 0,  // Message sequence number
      type: "quick-answer" // Optional sub-type
    }
  ]
}
```

## Error Handling

- Return empty arrays instead of null for missing data
- Log errors to console with context
- Provide fallback extraction methods
- Handle partial page loads gracefully

## Testing

- Test parsers with real URLs using Playwright MCP
- Verify Markdown output formatting
- Check clipboard and download functionality
- Test on different page states (loading, loaded, error)

## Extension Manifest

- Use Manifest V3
- Request minimal permissions needed
- Declare all host permissions explicitly
- Keep content script matches broad (`<all_urls>`) for detection

## Security Considerations

- Never execute user-provided code
- Sanitize extracted content before output
- Avoid innerHTML when possible, use textContent
- Validate URLs before processing
