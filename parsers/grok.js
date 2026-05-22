/**
 * Parser for Grok conversations
 * URL pattern: grok.com
 */

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

    // Find all paragraphs and walk up to find their message container
    const paragraphs = main.querySelectorAll('p');
    const seenContainers = new Set();

    paragraphs.forEach((p) => {
      // Walk up to find the message container
      let parent = p.parentElement;
      while (parent && parent !== main) {
        // Check if this parent has a reflection button (indicates assistant)
        const reflectionBtn = parent.querySelector('button');
        const hasReflection = reflectionBtn && reflectionBtn.textContent.includes('Réflexion');

        // Check if this is a message container (has substantial text)
        const text = parent.innerText.replace(/Copier|Report|Réflexion|sources|Enregistrer le tableau/g, '').trim();

        if (text.length > 50 && parent.className) {
          const containerId = parent.className + text.substring(0, 50);
          if (!seenContainers.has(containerId)) {
            seenContainers.add(containerId);

            // Extract sources if available
            const sources = this.extractSources(parent);

            messages.push({
              role: hasReflection ? 'assistant' : 'user',
              content: this.cleanText(text),
              sources: sources.length > 0 ? sources : undefined,
              thoughtProcess: hasReflection ? this.extractThoughtProcess(parent) : undefined
            });
          }
          break;
        }
        parent = parent.parentElement;
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
    
    // Look for "X sources" buttons or links
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

    // Look for links in the content
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
    // Grok shows reflection time like "Réflexion : 5s"
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

        // Include thought process if enabled and available
        if (includeThoughtProcess && msg.thoughtProcess) {
          md += `<details>\n<summary>Temps de réflexion</summary>\n\n${msg.thoughtProcess}\n\n</details>\n\n`;
        }

        md += `${msg.content}\n\n`;

        // Include sources if enabled and available
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

export { GrokParser };
