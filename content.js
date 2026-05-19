// Import parsers
// Note: In a real extension, these would be imported modules
// For now, we'll include the parser inline or load it dynamically

class BraveSearchParser {
  constructor() {
    this.name = 'Brave Search Ask';
    this.urlPattern = /search\.brave\.com\/ask/;
    this.capabilities = {
      thoughtProcess: false,
      sources: true,
      requiresSidebarOpen: false
    };
  }

  isMatch(url) {
    return this.urlPattern.test(url);
  }

  extract() {
    const messages = [];
    
    // Find conversation rounds - each round has a user query and AI response
    const rounds = document.querySelectorAll('.tap-round.is-complete, .tap-round.is-first.is-complete');
    
    rounds.forEach((round, index) => {
      // Extract user query
      const userBubble = round.querySelector('.user-bubble');
      const userMessage = round.querySelector('.message.user');
      
      let userText = '';
      if (userBubble) {
        userText = this.cleanText(userBubble.innerText);
      } else if (userMessage) {
        userText = this.cleanText(userMessage.innerText);
      }

      // Extract AI response
      const assistantMessage = round.querySelector('.message.assistant');
      const assistantQuickAnswer = round.querySelector('.message.quick-answer');
      
      let assistantText = '';
      let assistantType = 'assistant';
      
      if (assistantMessage) {
        assistantText = this.cleanText(assistantMessage.innerText);
      } else if (assistantQuickAnswer) {
        assistantText = this.cleanText(assistantQuickAnswer.innerText);
        assistantType = 'quick-answer';
      }

      // Add user message
      if (userText) {
        messages.push({
          role: 'user',
          content: userText,
          index: index
        });
      }

      // Extract sources from the assistant message and enrichment carousel
      let sources = [];
      const assistantElement = assistantMessage || assistantQuickAnswer;
      
      // Look for sources within the message itself
      if (assistantElement) {
        const sourceLinks = assistantElement.querySelectorAll('a[href]');
        sourceLinks.forEach(link => {
          const url = link.href;
          const title = this.cleanText(link.innerText) || url;
          // Avoid duplicate sources
          if (!sources.find(s => s.url === url)) {
            sources.push({ title, url });
          }
        });
      }
      
      // Look for enrichment carousel (Brave Search sources) associated with this round
      // The enrichment carousel is typically after the message or in a sibling container
      const enrichmentCarousel = round.querySelector('.enrichment-carousel, [class*="enrichment"]');
      if (enrichmentCarousel) {
        const carouselLinks = enrichmentCarousel.querySelectorAll('a[href]');
        carouselLinks.forEach(link => {
          const url = link.href;
          const title = this.cleanText(link.innerText) || url;
          if (url && !url.includes('brave.com') && !sources.find(s => s.url === url)) {
            sources.push({ title, url });
          }
        });
      }
      
      // Alternative: look for all links in the round that are not in user messages
      const roundLinks = round.querySelectorAll('a[href]');
      roundLinks.forEach(link => {
        const url = link.href;
        // Skip if in user bubble or already added
        if (link.closest('.user-bubble, .message.user')) return;
        if (url && !url.includes('brave.com') && !sources.find(s => s.url === url)) {
          const title = this.cleanText(link.innerText) || url;
          sources.push({ title, url });
        }
      });

      // Add assistant message
      if (assistantText) {
        messages.push({
          role: 'assistant',
          content: assistantText,
          type: assistantType,
          index: index,
          sources: sources
        });
      }
    });

    // If no rounds found, try alternative selectors
    if (messages.length === 0) {
      return this.extractAlternative();
    }

    return {
      site: this.name,
      url: window.location.href,
      title: document.title,
      date: new Date().toISOString(),
      messages: messages
    };
  }

  extractAlternative() {
    const messages = [];
    
    // Try finding all message elements directly
    const allMessages = document.querySelectorAll('.message');
    let index = 0;
    
    allMessages.forEach((msg) => {
      const isUser = msg.classList.contains('user');
      const isAssistant = msg.classList.contains('assistant') || msg.classList.contains('llm-output');
      
      if (isUser) {
        messages.push({
          role: 'user',
          content: this.cleanText(msg.innerText),
          index: index++
        });
      } else if (isAssistant) {
        // Extract sources from message and surrounding context
        const sources = [];
        
        // Links within the message
        const sourceLinks = msg.querySelectorAll('a[href]');
        sourceLinks.forEach(link => {
          const url = link.href;
          const title = this.cleanText(link.innerText) || url;
          if (url && !url.includes('brave.com') && !sources.find(s => s.url === url)) {
            sources.push({ title, url });
          }
        });
        
        // Look for enrichment carousel as sibling or within parent
        const parentRound = msg.closest('.tap-round');
        if (parentRound) {
          const enrichmentLinks = parentRound.querySelectorAll('.enrichment-carousel a[href], [class*="enrichment"] a[href]');
          enrichmentLinks.forEach(link => {
            const url = link.href;
            const title = this.cleanText(link.innerText) || url;
            if (url && !url.includes('brave.com') && !sources.find(s => s.url === url)) {
              sources.push({ title, url });
            }
          });
        }

        messages.push({
          role: 'assistant',
          content: this.cleanText(msg.innerText),
          type: msg.classList.contains('quick-answer') ? 'quick-answer' : 'assistant',
          index: index,
          sources: sources
        });
      }
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
    if (!text) return '';
    return text
      .replace(/\n\s*\n/g, '\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }

  toMarkdown(data, config = {}) {
    const username = config.username || 'Utilisateur';
    const includeSources = config.includeSources || false;
    
    let md = `# ${data.title}\n\n`;
    md += `**Site**: ${data.site}\n`;
    md += `**URL**: ${data.url}\n`;
    md += `**Date**: ${data.date}\n\n`;
    md += `---\n\n`;

    data.messages.forEach((msg) => {
      if (msg.role === 'user') {
        md += `## ${username}\n\n${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        md += `## Brave AI${msg.type === 'quick-answer' ? ' (Réponse rapide)' : ''}\n\n${msg.content}\n\n`;
        
        // Include sources if enabled and available
        if (includeSources && msg.sources && msg.sources.length > 0) {
          md += `### Sources\n\n`;
          msg.sources.forEach((source, index) => {
            md += `${index + 1}. [${source.title}](${source.url})\n`;
          });
          md += `\n`;
        }
      }
      md += `---\n\n`;
    });

    return md;
  }
}

class ZaiParser {
  constructor() {
    this.name = 'Z.ai';
    this.urlPattern = /chat\.z\.ai/;
    this.capabilities = {
      thoughtProcess: true,
      sources: true,
      requiresSidebarOpen: false, // Auto-clicked by extension
      sidebarInstructions: 'L\'extension ouvrira automatiquement les panneaux de sources'
    };
  }

  isMatch(url) {
    return this.urlPattern.test(url);
  }

  async extract() {
    const messages = [];

    // Auto-click all Sources buttons to open sidebars
    this.openAllSourcesPanels();

    // Wait for sidebars to open (they load asynchronously)
    await this.waitForSidebars(2000);

    // Find all message containers
    // User messages: .user-message container with .chat-user content
    // Assistant messages: [class*="message-"] container with .chat-assistant content
    const allMessages = document.querySelectorAll('.user-message, div[class*="message-"]');

    // Extract sources from sidebar (now open)
    const sidebarSources = this.extractSidebarSources();

    allMessages.forEach((el, index) => {
      const isUser = el.classList.contains('user-message');

      // Get content from inner containers
      let rawContent = '';
      if (isUser) {
        const userContent = el.querySelector('.chat-user');
        rawContent = userContent ? userContent.innerText : el.innerText;
      } else {
        const assistantContent = el.querySelector('.chat-assistant');
        rawContent = assistantContent ? assistantContent.innerText : el.innerText;
      }

      if (rawContent) {
        if (isUser) {
          const cleanedContent = this.cleanText(rawContent);
          messages.push({
            role: 'user',
            content: cleanedContent,
            index: index
          });
        } else {
          // Parse assistant message BEFORE cleaning to preserve structure
          const parsed = this.parseAssistantMessage(rawContent);

          // Keep citation IDs per message, URLs will be in allSources
          messages.push({
            role: 'assistant',
            content: parsed.mainContent,
            thoughtProcess: parsed.thoughtProcess,
            sources: parsed.sources, // Just citation IDs like turn0search5
            index: index
          });
        }
      }
    });

    return {
      site: this.name,
      url: window.location.href,
      title: document.title,
      date: new Date().toISOString(),
      messages: messages,
      allSources: sidebarSources.length > 0 ? sidebarSources : undefined
    };
  }

  waitForSidebars(timeoutMs = 2000) {
    return new Promise(resolve => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        // Check if References section appeared
        const referencesHeader = Array.from(document.querySelectorAll('*')).find(
          el => el.textContent?.trim() === 'References'
        );
        
        if (referencesHeader) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime >= timeoutMs) {
          clearInterval(checkInterval);
          resolve(false); // Timeout reached
        }
      }, 200); // Check every 200ms
    });
  }

  openAllSourcesPanels() {
    // Find and click all Sources buttons in assistant messages
    const assistantMessages = document.querySelectorAll('div[class*="message-"]');
    let clickedCount = 0;

    assistantMessages.forEach(msg => {
      // Look for Sources button in this message
      const buttons = msg.querySelectorAll('button');
      buttons.forEach(btn => {
        const text = btn.textContent?.trim();
        if (text?.includes('Sources') || text?.includes('Source')) {
          // Check if not already clicked (not active/open)
          const isOpen = btn.getAttribute('active') !== null ||
                        btn.className.includes('active') ||
                        btn.getAttribute('aria-pressed') === 'true';
          if (!isOpen) {
            btn.click();
            clickedCount++;
          }
        }
      });
    });

    // Wait a bit for sidebars to open (synchronous wait not possible, but we continue)
    console.log(`[ZaiParser] Clicked ${clickedCount} Sources buttons`);
    return clickedCount;
  }

  extractSidebarSources() {
    const sources = [];

    // Check if sidebar is open by looking for References section
    const referencesHeader = Array.from(document.querySelectorAll('*')).find(
      el => el.textContent?.trim() === 'References'
    );

    if (!referencesHeader) {
      console.log('[ZaiParser] No References sidebar found');
      return sources; // Sidebar not open
    }

    // Find all source links in the sidebar
    // They are typically links with favicon and structured content
    const allLinks = document.querySelectorAll('a[href^="http"]');

    allLinks.forEach((link) => {
      const href = link.href;
      const text = link.textContent?.trim() || '';

      // Check if this looks like a source link (has certain patterns)
      // Source links typically have longer text and contain domain names
      if (href && text.length > 30) {
        // Extract source name (usually the first word/segment)
        const sourceMatch = text.match(/^(\w+)\s*/);
        const sourceName = sourceMatch ? sourceMatch[1].toLowerCase() : '';

        // Extract title (remove source name from beginning)
        const title = text.replace(/^\w+\s*/, '').slice(0, 100);

        // Check if this is a valid source link (has recognizable source)
        const validSources = ['reddit', 'youtube', 'github', 'stackoverflow', 'chromewebstore', 'chatgptexporter', 'tomforth', 'outscraper', 'community'];
        if (validSources.some(s => sourceName.includes(s))) {
          // Avoid duplicates
          if (!sources.find(s => s.url === href)) {
            sources.push({
              url: href,
              source: sourceName,
              title: title
            });
          }
        }
      }
    });

    return sources;
  }

  parseAssistantMessage(content) {
    let thoughtProcess = null;
    let mainContent = content;
    const sources = [];

    // Extract sources/citations (format: 【turn0search5】)
    const citationRegex = /【([^】]+)】/g;
    let match;
    while ((match = citationRegex.exec(content)) !== null) {
      const citation = match[1];
      if (!sources.find(s => s.id === citation)) {
        sources.push({ id: citation, label: citation });
      }
    }

    // Also extract inline source references (e.g., "chromewebstore.google", "github", etc.)
    // These appear in the second and subsequent messages
    const inlineSourceRegex = /(?:^|\s)(chromewebstore\.google|github|reddit|stackoverflow|youtube|chatgptexporter|tomforth|outscraper|community\.make|facebook|clay|data-bird|sortlist|fortinet)(?:\s|$|\.)/gi;
    let inlineMatch;
    while ((inlineMatch = inlineSourceRegex.exec(content)) !== null) {
      const sourceName = inlineMatch[1].toLowerCase();
      // Generate a pseudo-ID for inline sources
      const pseudoId = `inline_${sourceName}_${inlineMatch.index}`;
      if (!sources.find(s => s.id === pseudoId)) {
        sources.push({ id: pseudoId, label: sourceName, isInline: true });
      }
    }

    // Check for Thought Process section
    // Format: "Thought Process\n\n<thought content>\n\n<main response>"
    // The main response typically starts with a phrase like "En tant que..." or "Voici..."
    const thoughtProcessMatch = content.match(/^Thought Process\s*\n\s*\n([\s\S]*?)\n\n([A-ZÀ-ÿ][\s\S]*)$/);
    if (thoughtProcessMatch) {
      thoughtProcess = this.cleanText(thoughtProcessMatch[1]);
      mainContent = this.cleanText(thoughtProcessMatch[2]);
    } else {
      // No thought process found, just clean the content
      mainContent = this.cleanText(content);
    }

    return { thoughtProcess, mainContent, sources };
  }

  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\n\s*\n/g, '\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }

  toMarkdown(data, config = {}) {
    const username = config.username || 'Utilisateur';
    const includeSources = config.includeSources || false;
    const includeThoughtProcess = config.includeThoughtProcess || false;

    let md = `# ${data.title}\n\n`;
    md += `**Site**: ${data.site}\n`;
    md += `**URL**: ${data.url}\n`;
    md += `**Date**: ${data.date}\n\n`;
    md += `---\n\n`;

    // Build mapping of citations to URLs with proper handling for duplicates
    const allSources = data.allSources || [];
    const citationToUrl = new Map();
    
    // Create queues for each source type to handle duplicates
    const sourceQueues = new Map();
    allSources.forEach(source => {
      if (source.source) {
        const key = source.source.toLowerCase();
        if (!sourceQueues.has(key)) {
          sourceQueues.set(key, []);
        }
        sourceQueues.get(key).push(source);
      }
    });
    
    // Track which inline sources we've used per type
    const usedCounts = new Map();

    let sourceIndex = 0;
    data.messages.forEach((msg) => {
      if (msg.role === 'assistant' && msg.sources) {
        msg.sources.forEach((source) => {
          if (source.id && !citationToUrl.has(source.id)) {
            if (!source.isInline && sourceIndex < allSources.length) {
              // Regular citation - map by order
              citationToUrl.set(source.id, allSources[sourceIndex]);
              sourceIndex++;
            } else if (source.isInline) {
              // Inline source - get next available URL for this source type
              const queue = sourceQueues.get(source.label.toLowerCase()) || [];
              const usedCount = usedCounts.get(source.label.toLowerCase()) || 0;
              if (usedCount < queue.length) {
                citationToUrl.set(source.id, queue[usedCount]);
                usedCounts.set(source.label.toLowerCase(), usedCount + 1);
              }
            }
          }
        });
      }
    });

    // Now build the markdown output
    data.messages.forEach((msg) => {
      if (msg.role === 'user') {
        md += `## ${username}\n\n${msg.content}\n\n`;
      } else {
        md += `## Z.ai (GLM-5.1)\n\n`;

        // Include Thought Process if enabled and available
        if (includeThoughtProcess && msg.thoughtProcess) {
          md += `<details>\n<summary>Thought Process</summary>\n\n${msg.thoughtProcess}\n\n</details>\n\n`;
        }

        md += `${msg.content}\n\n`;

        // Include sources with URLs if available
        if (includeSources && msg.sources && msg.sources.length > 0) {
          md += `### Sources\n\n`;
          msg.sources.forEach((source, idx) => {
            const mappedSource = citationToUrl.get(source.id);
            if (mappedSource) {
              md += `${idx + 1}. [${mappedSource.title || mappedSource.source}](${mappedSource.url})\n`;
            } else {
              md += `${idx + 1}. ${source.id || source.label}\n`;
            }
          });
          md += `\n`;
        }
      }
      md += `---\n\n`;
    });

    return md;
  }
}

// Registry of parsers
const parsers = [
  new BraveSearchParser(),
  new ZaiParser()
];

// Find matching parser
function getParser() {
  const url = window.location.href;
  return parsers.find(parser => parser.isMatch(url));
}

// Debug logging
console.log('[Conversation Extractor] Content script loaded on:', window.location.href);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Conversation Extractor] Received message:', request);
  
  if (request.action === 'detect') {
    const parser = getParser();
    console.log('[Conversation Extractor] Parser found:', parser?.name || 'none');
    if (parser) {
      sendResponse({ 
        supported: true, 
        site: parser.name,
        capabilities: parser.capabilities || {}
      });
    } else {
      sendResponse({ supported: false });
    }
    return true;
  }

  if (request.action === 'extract') {
    const parser = getParser();
    if (!parser) {
      sendResponse({ error: 'Site non supporté' });
      return true;
    }

    (async () => {
      try {
        // Get configuration from request
        const config = request.config || {
          username: 'Utilisateur',
          includeSources: false
        };
        
        const data = await parser.extract();
        
        if (data.messages.length === 0) {
          sendResponse({ error: 'Aucune conversation trouvée sur cette page' });
          return;
        }

        const markdown = parser.toMarkdown(data, config);
        sendResponse({ markdown, data });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    
    return true;
  }
});
