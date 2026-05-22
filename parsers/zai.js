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

    // Find all Sources buttons globally
    const allButtons = Array.from(document.querySelectorAll('button'));
    const sourcesButtons = allButtons.filter(btn => 
      btn.textContent?.trim() === 'Sources' || btn.textContent?.includes('Sources')
    );
    console.log(`[ZaiParser] Found ${sourcesButtons.length} Sources buttons globally`);

    // Find all message containers
    const allMessages = document.querySelectorAll('.user-message, div[class*="message-"]');

    let assistantIndex = 0; // Track assistant messages to match with Sources buttons
    for (let index = 0; index < allMessages.length; index++) {
      const el = allMessages[index];
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

          // For assistant messages, extract sources from corresponding Sources button
          let msgSources = [];
          if (assistantIndex < sourcesButtons.length) {
            const sourcesBtn = sourcesButtons[assistantIndex];
            console.log(`[ZaiParser] Assistant message ${assistantIndex}: Clicking Sources button...`);
            sourcesBtn.click();
            // Wait for sidebar to load
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            msgSources = this.extractSidebarSources();
            console.log(`[ZaiParser] Assistant message ${assistantIndex}: Extracted ${msgSources.length} sources`);
            
            // Close sidebar
            sourcesBtn.click();
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          assistantIndex++;

          messages.push({
            role: 'assistant',
            content: parsed.mainContent,
            thoughtProcess: parsed.thoughtProcess,
            sources: parsed.sources,
            sidebarSources: msgSources.length > 0 ? msgSources : undefined,
            index: index
          });
        }
      }
    }

    return {
      site: this.name,
      url: window.location.href,
      title: document.title,
      date: new Date().toISOString(),
      messages: messages
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

    // Check if sidebar is open by looking for References section
    const referencesHeader = Array.from(document.querySelectorAll('*')).find(
      el => el.textContent?.trim() === 'References'
    );

    if (!referencesHeader) {
      console.log('[ZaiParser] No References sidebar found');
      return sources; // Sidebar not open
    }

    console.log('[ZaiParser] References sidebar found, extracting links...');

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

    console.log(`[ZaiParser] Extracted ${sources.length} sources from sidebar`);
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

    // Build mapping of citations to URLs per message
    const citationToUrl = new Map();
    
    // Map 【】citations to URLs from each message's sidebarSources
    data.messages.forEach((msg) => {
      if (msg.role === 'assistant' && msg.sources && msg.sidebarSources) {
        // Map citations to this message's sources by order
        let sourceIndex = 0;
        msg.sources.forEach((source) => {
          if (source.id && !citationToUrl.has(source.id) && sourceIndex < msg.sidebarSources.length) {
            citationToUrl.set(source.id, msg.sidebarSources[sourceIndex]);
            sourceIndex++;
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

        if (includeSources && msg.sidebarSources) {
          md += `### Sources\n\n`;
            // Display ALL extracted sources, not just those mapped to citations
            msg.sidebarSources.forEach((source, idx) => {
              md += `${idx + 1}. [${source.title || source.source}](${source.url})\n`;
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
export { ZaiParser };
