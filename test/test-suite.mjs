/**
 * Suite de Testes Automatizados para Chat Media & Image Viewer v2.0.0
 * Valida: Processamento de Mídia, Regex, Resoluções de URL, Modal, Lightbox,
 * Otimizações de Imagem, Listeners e Limpeza Total de Canais.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ImageHandler } from "../scripts/image-handler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// MOCKS PARA AMBIENTE DOM E FOUNDRY VTT
// ============================================================================

class MockClassList {
  constructor(el) {
    this.el = el;
    this.classes = new Set();
  }
  add(cls) { this.classes.add(cls); }
  remove(cls) { this.classes.delete(cls); }
  contains(cls) { return this.classes.has(cls); }
  toggle(cls, force) {
    if (force === true) { this.add(cls); return true; }
    if (force === false) { this.remove(cls); return false; }
    if (this.contains(cls)) { this.remove(cls); return false; }
    this.add(cls); return true;
  }
}

class MockStyle {
  constructor(el) {
    this.el = el;
    this._props = {};
  }
  setProperty(prop, val) {
    this._props[prop] = String(val);
    this[prop] = String(val);
  }
  removeProperty(prop) {
    delete this._props[prop];
    delete this[prop];
  }
  getPropertyValue(prop) {
    return this._props[prop] || "";
  }
}

class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.classList = new MockClassList(this);
    this.style = new MockStyle(this);
    this.attributes = {};
    this._innerHTML = "";
    this.textContent = "";
    this.id = "";
    this.listeners = {};
    this.parentElement = null;
  }

  set className(val) {
    this.classList.classes = new Set(String(val || "").split(/\s+/).filter(Boolean));
  }
  get className() {
    return Array.from(this.classList.classes).join(" ");
  }

  set innerHTML(html) {
    this._innerHTML = String(html);
    this.children = [];
    if (!html || typeof html !== "string") return;
    const matches = html.matchAll(/<([a-zA-Z0-9]+)([^>]*)>/g);
    for (const m of matches) {
      const tag = m[1];
      const attrs = m[2];
      const child = new MockElement(tag);
      child.parentElement = this;
      const classMatch = attrs.match(/class=["']([^"']+)["']/);
      if (classMatch) {
        classMatch[1].split(/\s+/).filter(Boolean).forEach(c => child.classList.add(c));
      }
      const idMatch = attrs.match(/id=["']([^"']+)["']/);
      if (idMatch) child.id = idMatch[1];
      const srcMatch = attrs.match(/src=["']([^"']+)["']/);
      if (srcMatch) child.src = srcMatch[1];
      this.children.push(child);
    }
  }
  get innerHTML() {
    return this._innerHTML;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name === "id") this.id = String(val);
  }
  getAttribute(name) { return this.attributes[name] || null; }
  removeAttribute(name) { delete this.attributes[name]; }
  hasAttribute(name) { return name in this.attributes; }

  appendChild(child) {
    if (child) {
      child.parentElement = this;
      this.children.push(child);
    }
    return child;
  }

  prepend(child) {
    if (child) {
      child.parentElement = this;
      this.children.unshift(child);
    }
    return child;
  }

  before(sibling) {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) {
        sibling.parentElement = this.parentElement;
        this.parentElement.children.splice(idx, 0, sibling);
      }
    }
  }

  after(sibling) {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) {
        sibling.parentElement = this.parentElement;
        this.parentElement.children.splice(idx + 1, 0, sibling);
      }
    }
  }

  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) this.parentElement.children.splice(idx, 1);
      this.parentElement = null;
    }
  }

  addEventListener(type, cb, opts) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push({ cb, opts });
  }

  removeEventListener(type, cb) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(l => l.cb !== cb);
    }
  }

  dispatchEvent(event) {
    const handlers = this.listeners[event.type] || [];
    for (const h of handlers) {
      h.cb(event);
    }
    return !event.defaultPrevented;
  }

  click() {
    const ev = { type: "click", target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} };
    this.dispatchEvent(ev);
  }

  querySelector(selector) {
    return this._matchSelector(selector, false);
  }

  querySelectorAll(selector) {
    const results = [];
    this._matchSelector(selector, true, results);
    return results;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr._matchesSingle(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  _matchesSingle(selector) {
    if (!selector) return false;
    const parts = selector.split(",").map(s => s.trim());
    for (const part of parts) {
      if (part.startsWith(".") && this.classList.contains(part.substring(1))) return true;
      if (part.startsWith("#") && this.id === part.substring(1)) return true;
      if (part.toLowerCase() === this.tagName.toLowerCase()) return true;
      if (part.startsWith("[") && part.endsWith("]")) {
        const attrExpr = part.substring(1, part.length - 1);
        if (attrExpr.includes("=")) {
          const [key, val] = attrExpr.split("=").map(s => s.replace(/["']/g, "").trim());
          if (this.getAttribute(key) === val || this.dataset[key.replace("data-", "")] === val) return true;
        } else {
          if (this.hasAttribute(attrExpr)) return true;
        }
      }
    }
    return false;
  }

  _matchSelector(selector, all = false, acc = []) {
    for (const child of this.children) {
      if (child._matchesSingle(selector)) {
        if (!all) return child;
        acc.push(child);
      }
      const found = child._matchSelector(selector, all, acc);
      if (!all && found) return found;
    }
    return all ? acc : null;
  }
}

class MockDocument {
  constructor() {
    this.body = new MockElement("body");
    this.elementsById = new Map();
  }

  createElement(tag) {
    return new MockElement(tag);
  }

  getElementById(id) {
    if (this.elementsById.has(id)) return this.elementsById.get(id);
    return this.body.querySelector(`#${id}`);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  addEventListener(type, cb, opts) {
    this.body.addEventListener(type, cb, opts);
  }

  removeEventListener(type, cb) {
    this.body.removeEventListener(type, cb);
  }

  dispatchEvent(ev) {
    return this.body.dispatchEvent(ev);
  }
}

// Inicializa globais de teste
const mockDoc = new MockDocument();
globalThis.document = mockDoc;
globalThis.window = {
  document: mockDoc,
  innerWidth: 1920,
  innerHeight: 1080,
  open: () => ({ document: { write() {}, close() {} } })
};
globalThis.HTMLElement = MockElement;
globalThis.Dialog = class {
  constructor(data) {
    this.data = data;
    this.rendered = false;
  }
  render(force) {
    this.rendered = true;
    const root = new MockElement("div");
    root.innerHTML = this.data.content;
    if (this.data.render) this.data.render(root);
    return root;
  }
};
globalThis.ChatMessage = {
  create: async (data) => {
    globalThis.ChatMessage.lastCreated = data;
    return { id: "msg-" + Math.random().toString(36).substring(2, 9), ...data };
  }
};
globalThis.ui = {
  notifications: {
    info: (m) => {},
    warn: (m) => {},
    error: (m) => {}
  },
  chat: {
    rendered: true,
    scrollBottom: () => {}
  }
};
globalThis.game = {
  user: { isGM: true, name: "Gamemaster" },
  world: { id: "test-world" },
  settings: {
    _values: {},
    get: (mod, key) => globalThis.game.settings._values[`${mod}.${key}`],
    set: async (mod, key, val) => { globalThis.game.settings._values[`${mod}.${key}`] = val; }
  }
};

// ============================================================================
// SUITE DE EXECUÇÃO DE TESTES
// ============================================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
  } else {
    failedTests++;
    console.error(`FALHA NO TESTE: ${message}`);
  }
}

async function runAllTests() {
  console.log("Iniciando testes do Chat Media & Image Viewer v2.0.0...");

  // --------------------------------------------------------------------------
  // GRUPO 1: MEDIA_URL_REGEX E RESOLUÇÃO DE URLs
  // --------------------------------------------------------------------------
  const validMediaUrls = [
    "https://example.com/image.png",
    "http://images.com/photo.jpeg",
    "https://domain.org/art.jpg",
    "https://site.com/anim.gif",
    "https://assets.dev/vector.svg",
    "https://cdn.xyz/pic.webp",
    "https://server.com/test.avif",
    "https://sample.com/graphic.bmp",
    "https://example.com/image.png?size=large&token=abc123xyz",
    "https://tenor.com/view/funny-cat-dancing-gif-12345678",
    "https://media.tenor.com/abc123/tenor.gif",
    "https://c.tenor.com/xyz987/tenor.gif",
    "https://giphy.com/gifs/cat-cute-3oKIPnAiaMCws8nOsE",
    "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif",
    "https://i.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif",
    "https://imgur.com/gallery/ABC123",
    "https://i.imgur.com/ABC123.png",
    "https://cdn.discordapp.com/attachments/123456789/987654321/test.png",
    "https://images-ext-1.discordapp.net/external/xyz/test.gif"
  ];

  for (const url of validMediaUrls) {
    assert(ImageHandler.isMediaUrl(url), `isMediaUrl deve reconhecer: ${url}`);
  }

  const invalidUrls = [
    "Olá mundo isso é apenas texto",
    "https://google.com",
    "https://github.com/STR4DZN/custom-channels-chat",
    "/r 1d20 + 5",
    "[[/r 2d6 + 3]]",
    "http://example.com/document.pdf",
    "https://site.com/video.mp4",
    ""
  ];

  for (const url of invalidUrls) {
    assert(!ImageHandler.isMediaUrl(url), `isMediaUrl NÃO deve reconhecer texto não-mídia: ${url}`);
  }

  // Resoluções de URL
  assert(
    ImageHandler.resolveMediaUrl("https://giphy.com/gifs/funny-cat-3oKIPnAiaMCws8nOsE") === "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif",
    "resolveMediaUrl deve converter página do Giphy para link direto .gif"
  );
  assert(
    ImageHandler.resolveMediaUrl("https://i.imgur.com/xyz123") === "https://i.imgur.com/xyz123.png",
    "resolveMediaUrl deve adicionar .png a links Imgur sem extensão"
  );
  assert(
    ImageHandler.resolveMediaUrl("https://example.com/image.png") === "https://example.com/image.png",
    "resolveMediaUrl deve preservar URLs diretas já formatadas"
  );

  // --------------------------------------------------------------------------
  // GRUPO 2: PROCESSAMENTO AUTOMÁTICO DE CONTEÚDO (Auto-Embed)
  // --------------------------------------------------------------------------
  // URL pura
  const soloUrlContent = ImageHandler.processMessageContent("https://example.com/pic.png");
  assert(soloUrlContent.includes("discord-image-container"), "URL pura deve ser convertida em container de imagem");
  assert(soloUrlContent.includes('src="https://example.com/pic.png"'), "URL pura deve manter src correto");

  // Texto + URL
  const textWithUrl = ImageHandler.processMessageContent("Olha esse monstro incrível https://example.com/monster.png");
  assert(textWithUrl.includes("discord-message-text"), "Texto com URL deve conter parágrafo de texto");
  assert(textWithUrl.includes("discord-image-container"), "Texto com URL deve conter container de imagem");
  assert(textWithUrl.includes("Olha esse monstro incrível"), "Texto original deve ser preservado");

  // Mensagem normal
  const normalText = "Apenas uma conversa entre personagens.";
  assert(ImageHandler.processMessageContent(normalText) === normalText, "Texto normal não deve ser alterado");

  // --------------------------------------------------------------------------
  // GRUPO 3: ENVIO DE IMAGEM POR URL
  // --------------------------------------------------------------------------
  await ImageHandler.sendImageUrl("https://example.com/pic.jpg");
  assert(globalThis.ChatMessage.lastCreated !== null, "sendImageUrl deve chamar ChatMessage.create");
  assert(globalThis.ChatMessage.lastCreated.flags["custom-channels-chat"].isImage === true, "Deve definir flag isImage: true");
  assert(!globalThis.ChatMessage.lastCreated.flags["custom-channels-chat"].channel, "NÃO deve haver flag de canal no envio de imagem");

  // --------------------------------------------------------------------------
  // GRUPO 4: OTIMIZAÇÃO DE IMAGEM (GIFs preservados, compressão WebP)
  // --------------------------------------------------------------------------
  const mockGif = { type: "image/gif", size: 3 * 1024 * 1024, name: "dance.gif" };
  const optimizedGif = await ImageHandler.optimizeImage(mockGif);
  assert(optimizedGif === mockGif, "GIFs não devem ser recompactados em canvas para preservar animação");

  const mockSmallImage = { type: "image/png", size: 100 * 1024, name: "small.png" };
  const optimizedSmall = await ImageHandler.optimizeImage(mockSmallImage);
  assert(optimizedSmall === mockSmallImage, "Imagens leves (<250KB) não precisam de compressão");

  // --------------------------------------------------------------------------
  // GRUPO 5: VISUALIZADOR LIGHTBOX
  // --------------------------------------------------------------------------
  const overlay = ImageHandler.openLightbox("https://example.com/fullsize.png", "Imagem de Teste");
  assert(overlay !== null, "openLightbox deve retornar elemento overlay");
  assert(mockDoc.body.classList.contains("custom-lightbox-open"), "Deve adicionar classe custom-lightbox-open ao body");

  const downloadBtn = overlay.querySelector(".custom-lightbox-download");
  assert(downloadBtn !== null, "Lightbox deve ter botão de Download");

  const openExtBtn = overlay.querySelector(".custom-lightbox-open-ext");
  assert(openExtBtn !== null, "Lightbox deve ter botão de Abrir Original");
  assert(openExtBtn.href === "https://example.com/fullsize.png", "Botão de Abrir Original deve apontar para o src");

  const closeBtn = overlay.querySelector(".custom-lightbox-close");
  assert(closeBtn !== null, "Lightbox deve ter botão de fechar");

  // Fechamento com Esc
  const escEvent = { type: "keydown", key: "Escape", defaultPrevented: false, preventDefault() {} };
  mockDoc.dispatchEvent(escEvent);
  assert(!mockDoc.body.classList.contains("custom-lightbox-open"), "Tecla Esc deve fechar o Lightbox");

  // --------------------------------------------------------------------------
  // GRUPO 6: INJEÇÃO DE INTERFACE (Toolbar de Mídia)
  // --------------------------------------------------------------------------
  const mockChat = new MockElement("div");
  mockChat.id = "chat";
  const mockTextarea = new MockElement("textarea");
  mockTextarea.id = "chat-message";
  mockChat.appendChild(mockTextarea);

  ImageHandler.initInput(null, mockChat);

  const toolbar = mockChat.querySelector(".custom-chat-media-toolbar");
  assert(toolbar !== null, "initInput deve injetar toolbar de mídia");

  const attachBtn = toolbar.querySelector(".custom-chat-attach-btn");
  assert(attachBtn !== null, "Toolbar deve conter botão Imagem");

  const gifBtn = toolbar.querySelector(".custom-chat-gif-btn");
  assert(gifBtn !== null, "Toolbar deve conter botão GIF / URL");

  // --------------------------------------------------------------------------
  // GRUPO 7: VERIFICAÇÃO DE LIMPEZA E AUSÊNCIA TOTAL DE CANAIS
  // --------------------------------------------------------------------------
  const channelManagerExists = fs.existsSync(path.join(__dirname, "../scripts/channel-manager.js"));
  assert(!channelManagerExists, "Arquivo channel-manager.js DEVE ter sido totalmente removido");

  const mainContent = fs.readFileSync(path.join(__dirname, "../scripts/main.js"), "utf8");
  assert(!mainContent.includes("ChannelManager"), "main.js NÃO deve conter referências a ChannelManager");
  assert(!mainContent.includes("channelsList"), "main.js NÃO deve registrar configuração de lista de canais");
  assert(!mainContent.includes("autoRouteRolls"), "main.js NÃO deve registrar autoRouteRolls");
  assert(!mainContent.includes("custom-channel-hidden"), "main.js NÃO deve ocultar mensagens por canais");

  const cssContent = fs.readFileSync(path.join(__dirname, "../styles/custom-channels-chat.css"), "utf8");
  assert(!cssContent.includes(".custom-channels-bar"), "CSS NÃO deve conter barra de canais");
  assert(!cssContent.includes(".custom-channel-tab"), "CSS NÃO deve conter abas de canais");
  assert(!cssContent.includes(".custom-channel-hidden"), "CSS NÃO deve conter regras de ocultação de canais");

  const moduleJsonRaw = fs.readFileSync(path.join(__dirname, "../module.json"), "utf8");
  const moduleJson = JSON.parse(moduleJsonRaw);
  assert(moduleJson.version === "2.0.0", "module.json deve ter a versão 2.0.0");
  assert(moduleJson.title === "Chat Media & Image Viewer", "module.json deve ter o novo título Chat Media & Image Viewer");

  console.log(`\n========================================`);
  console.log(`RESULTADO: ${passedTests} de ${totalTests} testes passaram com sucesso!`);
  if (failedTests === 0) {
    console.log("TODOS OS TESTES PASSARAM COM 100% DE APROVAÇÃO!");
  } else {
    console.error(`${failedTests} testes falharam.`);
    process.exit(1);
  }
}

runAllTests();
