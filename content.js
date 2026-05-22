// ============================================================
// Conversation Extractor - Content Script
// ============================================================
// Ce fichier contient tous les parsers inline pour garantir
// la compatibilité avec Chrome extensions (pas de modules ES6).
// ============================================================

// ============================================================
// PARSER: Brave Search Ask
// ============================================================
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

    const rounds = document.querySelectorAll('.tap-round.is-complete, .tap-round.is-first.is-complete');

    rounds.forEach((round, index) => {
      const userBubble = round.querySelector('.user-bubble');
      const userMessage = round.querySelector('.message.user');

      let userText = '';
      if (userBubble) {
        userText = this.cleanText(userBubble.innerText);
      } else if (userMessage) {
        userText = this.cleanText(userMessage.innerText);
      }

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

      if (userText) {
        messages.push({
          role: 'user',
          content: userText,
          index: index
        });
      }

      let sources = [];
      const assistantElement = assistantMessage || assistantQuickAnswer;

      if (assistantElement) {
        const sourceLinks = assistantElement.querySelectorAll('a[href]');
        sourceLinks.forEach(link => {
          const url = link.href;
          const title = this.cleanText(link.innerText) || url;
          if (url && !url.includes('brave.com') && !sources.find(s => s.url === url)) {
            sources.push({ title, url });
          }
        });
      }

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

      const roundLinks = round.querySelectorAll('a[href]');
      roundLinks.forEach(link => {
        const url = link.href;
        if (link.closest('.user-bubble, .message.user')) return;
        if (url && !url.includes('brave.com') && !sources.find(s => s.url === url)) {
          const title = this.cleanText(link.innerText) || url;
          sources.push({ title, url });
        }
      });

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
        const sources = [];
        const sourceLinks = msg.querySelectorAll('a[href]');
        sourceLinks.forEach(link => {
          const url = link.href;
          const title = this.cleanText(link.innerText) || url;
          if (url && !url.includes('brave.com') && !sources.find(s => s.url === url)) {
            sources.push({ title, url });
          }
        });

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

// ============================================================
// PARSER: Z.ai
// ============================================================
class ZaiParser {
  constructor() {
    this.name = 'Z.ai';
    this.urlPattern = /chat\.z\.ai/;
    this.capabilities = {
      thoughtProcess: true,
      sources: true,
      requiresSidebarOpen: false,
      sidebarInstructions: "L'extension ouvrira automatiquement les panneaux de sources"
    };
  }

  isMatch(url) {
    return this.urlPattern.test(url);
  }

  async extract() {
    const messages = [];

    const allButtons = Array.from(document.querySelectorAll('button'));
    const sourcesButtons = allButtons.filter(btn =>
      btn.textContent?.trim() === 'Sources' || btn.textContent?.includes('Sources')
    );
    console.log(`[ZaiParser] Found ${sourcesButtons.length} Sources buttons globally`);

    const allMessages = document.querySelectorAll('.user-message, div[class*="message-"]');

    let assistantIndex = 0;
    for (let index = 0; index < allMessages.length; index++) {
      const el = allMessages[index];
      const isUser = el.classList.contains('user-message');

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
          const parsed = this.parseAssistantMessage(rawContent);

          let msgSources = [];
          if (assistantIndex < sourcesButtons.length) {
            const sourcesBtn = sourcesButtons[assistantIndex];
            console.log(`[ZaiParser] Assistant message ${assistantIndex}: Clicking Sources button...`);
            sourcesBtn.click();
            await new Promise(resolve => setTimeout(resolve, 1500));

            msgSources = this.extractSidebarSources();
            console.log(`[ZaiParser] Assistant message ${assistantIndex}: Extracted ${msgSources.length} sources`);

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

  extractSidebarSources() {
    const sources = [];

    const referencesHeader = Array.from(document.querySelectorAll('*')).find(
      el => el.textContent?.trim() === 'References'
    );

    if (!referencesHeader) {
      console.log('[ZaiParser] No References sidebar found');
      return sources;
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

    const citationRegex = /【([^】]+)】/g;
    let match;
    while ((match = citationRegex.exec(content)) !== null) {
      const citation = match[1];
      if (!sources.find(s => s.id === citation)) {
        sources.push({ id: citation, label: citation });
      }
    }

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

    const citationToUrl = new Map();

    data.messages.forEach((msg) => {
      if (msg.role === 'assistant' && msg.sources && msg.sidebarSources) {
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

// ============================================================
// PARSER: Grok (xAI)
// ============================================================
class GrokParser {
  constructor() {
    this.name = 'Grok';
    this.urlPattern = /grok\.com/;
    this.capabilities = {
      thoughtProcess: true,
      sources: true,
      requiresSidebarOpen: false
    };
  }

  isMatch(url) {
    return this.urlPattern.test(url);
  }

  extract() {
    const messages = [];
    const main = document.querySelector('main');
    if (!main) {
      return {
        site: this.name,
        url: window.location.href,
        title: document.title,
        date: new Date().toISOString(),
        messages: []
      };
    }

    // Grok messages are in rows aligned with CSS classes:
    // - User messages: class contains 'items-end'
    // - Assistant messages: class contains 'items-start'
    const messageRows = main.querySelectorAll('[class*="items-end"], [class*="items-start"]');

    messageRows.forEach((row) => {
      const className = row.className || '';
      const isUser = className.includes('items-end');
      const isAssistant = className.includes('items-start');

      // Get text from the message bubble or the row itself
      const bubble = row.querySelector('.message-bubble');
      let rawText = bubble ? bubble.innerText : row.innerText;

      // Clean up the text
      let text = rawText
        .replace(/Copier|Report|sources|Enregistrer le tableau/g, '')
        .trim();

      // Remove reflection time from the beginning of assistant messages
      const reflectionMatch = text.match(/^Réflexion\s*[:：]\s*\d+s\s*\n?\n?/);
      let thoughtProcess = null;
      if (reflectionMatch) {
        thoughtProcess = reflectionMatch[0].trim();
        text = text.substring(reflectionMatch[0].length).trim();
      }

      if (text.length > 10) {
        const sources = isAssistant ? this.extractSources(row) : [];

        messages.push({
          role: isUser ? 'user' : 'assistant',
          content: this.cleanText(text),
          sources: sources.length > 0 ? sources : undefined,
          thoughtProcess: thoughtProcess || undefined
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

  extractSources(container) {
    const sources = [];

    const sourceButtons = container.querySelectorAll('button');
    sourceButtons.forEach(btn => {
      const text = btn.textContent?.trim();
      if (text && text.includes('sources')) {
        const match = text.match(/(\d+)\s+sources/);
        if (match) {
          sources.push({ count: parseInt(match[1]), type: 'sources' });
        }
      }
    });

    const links = container.querySelectorAll('a[href]');
    links.forEach(link => {
      const url = link.href;
      const title = this.cleanText(link.innerText) || url;
      if (url && !url.includes('grok.com') && !sources.find(s => s.url === url)) {
        sources.push({ title, url });
      }
    });

    return sources;
  }

  extractThoughtProcess(container) {
    const reflectionBtn = container.querySelector('button');
    if (reflectionBtn) {
      const text = reflectionBtn.textContent?.trim();
      if (text && text.includes('Réflexion')) {
        return text;
      }
    }
    return null;
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

    data.messages.forEach((msg) => {
      if (msg.role === 'user') {
        md += `## ${username}\n\n${msg.content}\n\n`;
      } else {
        md += `## Grok (xAI)\n\n`;

        if (includeThoughtProcess && msg.thoughtProcess) {
          md += `<details>\n<summary>Temps de réflexion</summary>\n\n${msg.thoughtProcess}\n\n</details>\n\n`;
        }

        md += `${msg.content}\n\n`;

        if (includeSources && msg.sources && msg.sources.length > 0) {
          md += `### Sources\n\n`;
          msg.sources.forEach((source, index) => {
            if (source.url) {
              md += `${index + 1}. [${source.title}](${source.url})\n`;
            } else if (source.count) {
              md += `${index + 1}. ${source.count} sources\n`;
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

// ============================================================
// REGISTRY & MESSAGE HANDLER
// ============================================================

const parsers = [
  new BraveSearchParser(),
  new ZaiParser(),
  new GrokParser()
];

function getParser() {
  const url = window.location.href;
  return parsers.find(parser => parser.isMatch(url));
}

console.log('[Conversation Extractor] Content script loaded on:', window.location.href);
console.log('[Conversation Extractor] Registered parsers:', parsers.map(p => p.name));

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
