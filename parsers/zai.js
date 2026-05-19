/**
 * Parser for Z.ai conversations
 * URL pattern: chat.z.ai
 */

class ZaiParser {
  constructor() {
    this.name = 'Z.ai';
    this.urlPattern = /chat\.z\.ai/;
    this.capabilities = {
      thoughtProcess: true,
      sources: true,
      requiresSidebarOpen: false,
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

          messages.push({
            role: 'assistant',
            content: parsed.mainContent,
            thoughtProcess: parsed.thoughtProcess,
            sources: parsed.sources,
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
        const referencesHeader = Array.from(document.querySelectorAll('*')).find(
          el => el.textContent?.trim() === 'References'
        );
        
        if (referencesHeader) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime >= timeoutMs) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 200);
    });
  }

  openAllSourcesPanels() {
    // Find and click all Sources buttons in assistant messages
    const assistantMessages = document.querySelectorAll('div[class*="message-"]');
    let clickedCount = 0;

    assistantMessages.forEach(msg => {
      const buttons = msg.querySelectorAll('button');
      buttons.forEach(btn => {
        const text = btn.textContent?.trim();
        if (text?.includes('Sources') || text?.includes('Source')) {
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

    console.log(`[ZaiParser] Clicked ${clickedCount} Sources buttons`);
    return clickedCount;
  }

  extractSidebarSources() {
    const sources = [];

    const referencesHeader = Array.from(document.querySelectorAll('*')).find(
      el => el.textContent?.trim() === 'References'
    );

    if (!referencesHeader) {
      console.log('[ZaiParser] No References sidebar found');
      return sources;
    }

    const allLinks = document.querySelectorAll('a[href^="http"]');

    allLinks.forEach((link) => {
      const href = link.href;
      const text = link.textContent?.trim() || '';

      if (href && text.length > 30) {
        const sourceMatch = text.match(/^(\w+)\s*/);
        const sourceName = sourceMatch ? sourceMatch[1].toLowerCase() : '';
        const title = text.replace(/^\w+\s*/, '').slice(0, 100);

        const validSources = ['reddit', 'youtube', 'github', 'stackoverflow', 'chromewebstore', 'chatgptexporter', 'tomforth', 'outscraper', 'community'];
        if (validSources.some(s => sourceName.includes(s))) {
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

    // Also extract inline source references
    const inlineSourceRegex = /(?:^|\s)(chromewebstore\.google|github|reddit|stackoverflow|youtube|chatgptexporter|tomforth|outscraper|community\.make|facebook|clay|data-bird|sortlist|fortinet)(?:\s|$|\.)/gi;
    let inlineMatch;
    while ((inlineMatch = inlineSourceRegex.exec(content)) !== null) {
      const sourceName = inlineMatch[1].toLowerCase();
      const pseudoId = `inline_${sourceName}_${inlineMatch.index}`;
      if (!sources.find(s => s.id === pseudoId)) {
        sources.push({ id: pseudoId, label: sourceName, isInline: true });
      }
    }

    // Check for Thought Process section
    const thoughtProcessMatch = content.match(/^Thought Process\s*\n\s*\n([\s\S]*?)\n\n([A-ZÀ-ÿ][\s\S]*)$/);
    if (thoughtProcessMatch) {
      thoughtProcess = this.cleanText(thoughtProcessMatch[1]);
      mainContent = this.cleanText(thoughtProcessMatch[2]);
    } else {
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

    // Build mapping of citations to URLs with queue-based duplicate handling
    const allSources = data.allSources || [];
    const citationToUrl = new Map();
    
    // Create queues for each source type to handle duplicates properly
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
    
    // Track usage count per source type for inline sources
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
              // Inline source - get next available URL from queue
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

    data.messages.forEach((msg) => {
      if (msg.role === 'user') {
        md += `## ${username}\n\n${msg.content}\n\n`;
      } else {
        md += `## Z.ai (GLM-5.1)\n\n`;

        if (includeThoughtProcess && msg.thoughtProcess) {
          md += `<details>\n<summary>Thought Process</summary>\n\n${msg.thoughtProcess}\n\n</details>\n\n`;
        }

        md += `${msg.content}\n\n`;

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

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZaiParser;
}
