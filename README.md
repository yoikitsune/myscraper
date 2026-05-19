# Conversation Extractor

Extension Chrome pour extraire des conversations de sites d'IA en format Markdown.

## 🎯 Fonctionnement

Cette extension détecte automatiquement les sites supportés et permet d'extraire les conversations en un clic. Elle fonctionne avec un système de **parsers modulaires** où chaque site a son propre parser dédié.

### Architecture

```
Extension Chrome
├── popup.html/js       → Interface utilisateur
├── content.js          → Script injecté dans les pages
├── manifest.json       → Configuration de l'extension
└── parsers/            → Parsers modulaires par site
    ├── brave-search.js
    └── (autres parsers...)
```

### Flux de données

1. **Détection** : Le content script détecte si la page actuelle correspond à un parser supporté
2. **Extraction** : Au clic sur le bouton, le parser extrait les messages et métadonnées
3. **Formatage** : Les données sont converties en Markdown
4. **Export** : Copie dans le presse-papiers ou téléchargement en fichier `.md`

---

## 🌐 Sites supportés

### 1. Brave Search Ask (`search.brave.com/ask`)

**Fonctionnalités supportées :**
- ✅ Extraction des conversations utilisateur/assistant
- ✅ **Sources** : Extraction des liens du carrousel d'enrichissement
- ❌ Thought Process : Non disponible sur ce site

**Configuration disponible :**
- Nom d'utilisateur personnalisable (remplace "Utilisateur")
- Option "Inclure les sources" (affiche les liens de référence)

---

### 2. Z.ai (`chat.z.ai`)

**Fonctionnalités supportées :**
- ✅ Extraction des conversations utilisateur/assistant
- ✅ **Sources** : Extraction des références avec URLs
- ✅ **Thought Process** : Extraction du raisonnement de l'IA (optionnel)

**Configuration disponible :**
- Nom d'utilisateur personnalisable
- Option "Inclure les sources" (affiche les sources avec liens)
- Option "Inclure le Thought Process" (affiche le raisonnement interne)

**Note** : L'extension ouvre automatiquement les panneaux de sources pour les extraire.

---

## 📦 Installation en mode développeur

### Prérequis
- Google Chrome (ou Chromium)
- Les fichiers de l'extension

### Étapes

1. **Ouvrir la page des extensions**
   ```
   chrome://extensions/
   ```

2. **Activer le mode développeur**
   - Basculer l'interrupteur "Mode développeur" (en haut à droite)

3. **Charger l'extension non empaquetée**
   - Cliquer sur **"Charger l'extension non empaquetée"**
   - Sélectionner le dossier `myscraper/` contenant les fichiers de l'extension

4. **Vérifier l'installation**
   - L'extension "Conversation Extractor" doit apparaître dans la liste
   - L'icône doit s'afficher dans la barre d'outils Chrome

5. **Accorder les permissions**
   - Lors de la première utilisation, accorder les permissions demandées
   - L'extension nécessite l'accès aux onglets actifs pour fonctionner

### Mise à jour de l'extension

Après chaque modification du code :
```
chrome://extensions/ → Rechercher "Conversation Extractor" → 🔄 (Recharger)
```

---

## 🚀 Utilisation

### Extraction simple

1. **Naviguer** vers une page supportée (Brave Search Ask ou Z.ai)
2. **Ouvrir** le popup de l'extension (clic sur l'icône)
3. **Configurer** les options si nécessaire :
   - Modifier le nom d'utilisateur
   - Cocher/décocher les options de sources/thought process
4. **Cliquer** sur "Extraire la conversation"
5. **Copier** ou **télécharger** le Markdown

### Aperçu du Markdown

Le format de sortie est :
```markdown
# Titre de la conversation

**Site**: Nom du site
**URL**: https://...
**Date**: 2026-05-19T10:13:55.381Z

---

## Julien (nom personnalisé)

Message utilisateur...

---

## Z.ai (GLM-5.1)

Réponse de l'IA...

### Sources

1. [Titre source 1](https://lien1.com)
2. [Titre source 2](https://lien2.com)

---
```

---

## 🛠️ Workflows Windsurf

Ces workflows automatisent la création et la maintenance des parsers en utilisant **Playwright MCP** pour analyser les pages.

### Prérequis
- Windsurf avec Cascade
- MCP Playwright configuré et disponible

---

### `/add-conversation-parser` - Ajouter un nouveau site

Ce workflow guide l'ajout d'un parser pour un nouveau site d'IA.

**Usage :**
```
/add-conversation-parser https://nouveau-site.com/chat
```

**Étapes automatisées :**

1. **Analyse DOM avec Playwright**
   - Navigation vers l'URL fournie
   - Exploration des sélecteurs CSS pour messages utilisateur/assistant
   - Identification des patterns de conversation

2. **Création du parser**
   - Génération automatique du fichier `parsers/<site-name>.js`
   - Implémentation des méthodes requises :
     - `isMatch(url)` - Pattern de matching URL
     - `extract()` - Extraction des messages
     - `toMarkdown(data, config)` - Formatage
     - `capabilities` - Fonctionnalités supportées

3. **Intégration**
   - Ajout du parser au registre dans `content.js`
   - Mise à jour de `manifest.json` si nouvelles permissions requises

4. **Test**
   - Validation de l'extraction via Playwright
   - Vérification du Markdown généré

---

### `/update-conversation-parser` - Mettre à jour un parser existant

Ce workflow met à jour un parser existant lorsque le site a changé sa structure DOM.

**Usage :**
```
/update-conversation-parser brave-search
```

**Quand l'utiliser :**
- L'extraction ne fonctionne plus (aucune conversation trouvée)
- Les sélecteurs CSS ont changé
- Nouvelles fonctionnalités à ajouter (sources, thought process)
- Le site a été redessiné

**Étapes automatisées :**

1. **Diagnostic**
   - Analyse de l'ancien parser
   - Identification des sélecteurs obsolètes
   - Test sur l'URL du site avec Playwright

2. **Analyse DOM actuelle**
   - Navigation vers le site avec Playwright MCP
   - Recherche des nouveaux sélecteurs pour messages
   - Détection des sources/thought process si disponibles

3. **Mise à jour du parser**
   - Modification du fichier `parsers/<parser-name>.js`
   - Mise à jour des sélecteurs CSS
   - Ajout de nouvelles méthodes d'extraction si nécessaire

4. **Synchronisation**
   - Mise à jour de `content.js` si la structure a changé
   - Mise à jour du parser standalone dans `parsers/`

5. **Validation**
   - Test de l'extraction corrigée
   - Vérification de la rétrocompatibilité si possible

---

## 📁 Structure des fichiers

```
myscraper/
├── manifest.json              # Manifest V3 de l'extension
├── popup.html                 # Interface popup
├── popup.js                   # Logique popup (UI, config, messaging)
├── content.js                 # Content script avec parsers et registry
├── parsers/
│   ├── brave-search.js        # Parser Brave Search Ask
│   └── zai.js                 # Parser Z.ai (si séparé)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── .windsurf/
│   ├── workflows/
│   │   ├── add-conversation-parser.md      # Workflow création parser
│   │   └── update-conversation-parser.md   # Workflow mise à jour parser
│   ├── skills/
│   │   └── chrome-extension-dev/
│   │       └── SKILL.md                    # Skill dev extension
│   └── rules/
│       ├── project-guidelines.md           # Règles projet
│       └── playwright-analysis.md          # Règles Playwright
└── README.md                  # Ce fichier
```

---

## 🔧 Développement

### Ajouter un parser manuellement

1. Créer `parsers/mon-site.js` :
```javascript
class MonSiteParser {
  constructor() {
    this.name = 'Mon Site';
    this.urlPattern = /mon-site\.com\/chat/;
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
    // Implémentation de l'extraction
    const messages = [];
    // ... logique d'extraction ...
    
    return {
      site: this.name,
      url: window.location.href,
      title: document.title,
      date: new Date().toISOString(),
      messages: messages
    };
  }

  toMarkdown(data, config = {}) {
    // Implémentation du formatage
    const username = config.username || 'Utilisateur';
    let md = `# ${data.title}\n\n`;
    // ... formatage ...
    return md;
  }
}
```

2. Enregistrer dans `content.js` :
```javascript
const parsers = [
  new BraveSearchParser(),
  new ZaiParser(),
  new MonSiteParser()  // ← Ajouter ici
];
```

3. Recharger l'extension

---

## 🐛 Dépannage

### "Impossible de communiquer avec la page"
- Recharger l'extension dans `chrome://extensions/`
- Rafraîchir la page web
- Vérifier que le site est supporté

### "Aucune conversation trouvée"
- Vérifier que la conversation est chargée complètement
- Essayer de scroller pour charger plus de messages
- Utiliser `/update-conversation-parser` si le site a changé

### Sources non extraites
- Sur Brave Search : vérifier que les sources sont présentes dans le carrousel
- Sur Z.ai : l'extension ouvre automatiquement les panneaux, attendre quelques secondes

---

## 📄 Licence

Ce projet est open source. Utilisation personnelle uniquement - respectez les conditions d'utilisation des sites scrapés.

---

## 🙏 Crédits

- Développé avec l'aide de Windsurf Cascade
- Utilise Playwright MCP pour l'analyse DOM
- Inspiré par LLMFeeder et autres outils d'extraction
