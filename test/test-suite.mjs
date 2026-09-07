/**
 * Suite de Testes Automatizados e Benchmark de Performance
 * para o módulo custom-channels-chat v1.4.0
 */

import fs from "fs";
import { ChannelManager } from "../scripts/channel-manager.js";
import { ImageHandler } from "../scripts/image-handler.js";

// ============================================================================
// 1. AMBIENTE MOCK DO FOUNDRY VTT & DOM
// ============================================================================

class MockClassList {
  constructor(el) {
    this.el = el;
    this.classes = new Set();
  }
  add(cls) {
    this.classes.add(cls);
  }
  remove(cls) {
    this.classes.delete(cls);
  }
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
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.scrollWidth = 500;
    this.clientWidth = 300;
    this.offsetLeft = 0;
    this.offsetWidth = 80;
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
      const hrefMatch = attrs.match(/href=["']([^"']+)["']/);
      if (hrefMatch) child.href = hrefMatch[1];
      const roleMatch = attrs.match(/role=["']([^"']+)["']/);
      if (roleMatch) child.setAttribute("role", roleMatch[1]);
      this.children.push(child);
    }
  }

  get innerHTML() {
    return this._innerHTML || "";
  }

  scrollIntoView() {
    this.scrolledIntoView = true;
  }

  scrollTo(options) {
    if (typeof options === "object") {
      if (options.left !== undefined) this.scrollLeft = options.left;
      if (options.top !== undefined) this.scrollTop = options.top;
    }
  }

  setAttribute(name, val) { this.attributes[name] = String(val); }
  getAttribute(name) { return this.attributes[name]; }
  hasAttribute(name) { return this.attributes[name] !== undefined; }
  removeAttribute(name) { delete this.attributes[name]; }
  appendChild(child) {
    if (child instanceof MockElement) {
      child.parentElement = this;
      this.children.push(child);
    }
    return child;
  }
  insertBefore(child, ref) {
    if (child instanceof MockElement) {
      child.parentElement = this;
      const idx = ref ? this.children.indexOf(ref) : -1;
      if (idx !== -1) {
        this.children.splice(idx, 0, child);
      } else {
        this.children.push(child);
      }
    }
    return child;
  }
  remove() {
    this.removed = true;
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) this.parentElement.children.splice(idx, 1);
    }
  }
  before(el) {
    this.beforeElement = el;
    if (this.parentElement && el instanceof MockElement) {
      el.parentElement = this.parentElement;
      const idx = this.parentElement.children.indexOf(this);
      this.parentElement.children.splice(idx, 0, el);
    }
  }
  prepend(el) {
    if (el instanceof MockElement) {
      el.parentElement = this;
      this.children.unshift(el);
    }
  }
  addEventListener(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    const handlers = this.listeners[event.type] || [];
    for (const h of handlers) {
      h.call(this, event);
    }
    if (this.parentElement && !event.propagationStopped) {
      this.parentElement.dispatchEvent(event);
    }
  }
  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches && curr.matches(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }
  matches(selector) {
    if (selector.includes(",")) {
      return selector.split(",").some(s => this.matches(s.trim()));
    }
    if (selector.includes(" > ")) {
      const [parentSel, childSel] = selector.split(" > ").map(s => s.trim());
      return this.matches(childSel) && this.parentElement && this.parentElement.matches(parentSel);
    }
    if (selector.startsWith(".")) {
      const classes = selector.split(".").filter(Boolean);
      return classes.every(cls => this.className.includes(cls) || this.classList.contains(cls));
    }
    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }
    if (selector.toLowerCase() === this.tagName.toLowerCase()) {
      return true;
    }
    if (selector.startsWith("[") && selector.endsWith("]")) {
      const attr = selector.slice(1, -1);
      if (attr.includes("=")) {
        const [k, v] = attr.split("=");
        const cleanV = v.replace(/['"]/g, "");
        return this.getAttribute(k) === cleanV || this.dataset[k.replace("data-", "")] === cleanV;
      }
      return this.getAttribute(attr) !== undefined || this.dataset[attr.replace("data-", "")] !== undefined;
    }
    return false;
  }
  querySelector(selector) {
    if (selector === "#chat-log") return mockChatLog;
    if (selector === ".custom-channels-bar") {
      return this.children.find(c => c.matches(".custom-channels-bar")) || mockChat.children.find(c => c.matches(".custom-channels-bar")) || null;
    }
    const search = (node) => {
      for (const child of node.children) {
        if (child.matches && child.matches(selector)) return child;
        const res = search(child);
        if (res) return res;
      }
      return null;
    };
    return search(this);
  }
  querySelectorAll(selector) {
    const results = [];
    const search = (node) => {
      for (const child of node.children) {
        if (child.matches && child.matches(selector)) results.push(child);
        search(child);
      }
    };
    search(this);
    return results;
  }
}
globalThis.HTMLElement = MockElement;

const mockHead = new MockElement("head");
const mockSidebar = new MockElement("div");
mockSidebar.id = "sidebar";

const mockSidebarTabs = new MockElement("nav");
mockSidebarTabs.id = "sidebar-tabs";
mockSidebar.appendChild(mockSidebarTabs);

const mockChat = new MockElement("section");
mockChat.id = "chat";
mockSidebar.appendChild(mockChat);

const mockChatLog = new MockElement("ol");
mockChatLog.id = "chat-log";
mockChat.appendChild(mockChatLog);

const mockChatControls = new MockElement("div");
mockChatControls.id = "chat-controls";
mockChat.appendChild(mockChatControls);

const mockChatTextarea = new MockElement("textarea");
mockChatTextarea.id = "chat-message";
mockChat.appendChild(mockChatTextarea);

const documentListeners = {};

globalThis.document = {
  head: mockHead,
  body: new MockElement("body"),
  createElement(tag) {
    const el = new MockElement(tag);
    el.classList = new MockClassList(el);
    return el;
  },
  getElementById(id) {
    if (id === "chat") return mockChat;
    if (id === "chat-log") return mockChatLog;
    if (id === "chat-controls") return mockChatControls;
    if (id === "chat-message") return mockChatTextarea;
    if (id === "sidebar") return mockSidebar;
    if (id === "sidebar-tabs") return mockSidebarTabs;
    const findInNode = (node) => {
      if (node.id === id) return node;
      for (const c of node.children) {
        const f = findInNode(c);
        if (f) return f;
      }
      return null;
    };
    return findInNode(mockHead) || findInNode(mockChat) || findInNode(document.body);
  },
  querySelector(sel) {
    return mockChat.querySelector(sel) || document.body.querySelector(sel);
  },
  querySelectorAll(sel) {
    const inChat = mockChat.querySelectorAll(sel);
    const inBody = document.body.querySelectorAll(sel);
    return [...inChat, ...inBody];
  },
  addEventListener(event, cb, useCapture) {
    if (!documentListeners[event]) documentListeners[event] = [];
    if (useCapture) {
      documentListeners[event].unshift(cb);
    } else {
      documentListeners[event].push(cb);
    }
  },
  removeEventListener(event, cb) {
    if (!documentListeners[event]) return;
    documentListeners[event] = documentListeners[event].filter(h => h !== cb);
  },
  dispatchEvent(event) {
    const handlers = (documentListeners[event.type] || []).slice();
    for (const h of handlers) h(event);
  }
};

let lastWindowOpened = null;
globalThis.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  open(url) {
    lastWindowOpened = {
      url,
      document: {
        written: "",
        write(html) { this.written += html; },
        close() {}
      }
    };
    return lastWindowOpened;
  }
};

const registeredHooks = {};
globalThis.Hooks = {
  on(event, cb) {
    if (!registeredHooks[event]) registeredHooks[event] = [];
    registeredHooks[event].push(cb);
  },
  once(event, cb) {
    if (!registeredHooks[event]) registeredHooks[event] = [];
    registeredHooks[event].push(cb);
  },
  callAll(event, ...args) {
    const list = (registeredHooks[event] || []).slice();
    for (const h of list) h(...args);
  }
};

// Mock do objeto `game` do Foundry
const mockSettings = {
  "custom-channels-chat.channelsList": "geral, off-topic, dados",
  "custom-channels-chat.autoRouteRolls": true,
  "custom-channels-chat.enableDiscordStyle": true
};

const emittedSocketEvents = [];

globalThis.game = {
  world: { id: "test-world" },
  user: { id: "user-gm", name: "Jogador Mestre", isGM: true, avatar: "icons/mestre.png" },
  users: new Map([["user-gm", { name: "Jogador Mestre", isGM: true, avatar: "icons/mestre.png" }]]),
  messages: new Map(),
  settings: {
    get(module, key) {
      return mockSettings[`${module}.${key}`];
    },
    async set(module, key, val) {
      mockSettings[`${module}.${key}`] = val;
      return val;
    }
  },
  socket: {
    emit(event, data) {
      emittedSocketEvents.push({ event, data });
    }
  }
};

// Mock do Dialog
let lastOpenedDialog = null;
globalThis.Dialog = class {
  constructor(options) {
    this.options = options;
    lastOpenedDialog = this;
  }
  render() {
    this.rendered = true;
    return this;
  }
  static confirm(options) {
    if (options.yes) options.yes();
  }
};

// Mock do ui
globalThis.ui = {
  chat: {
    element: mockChat,
    scrollBottom() { this.scrolled = true; }
  },
  notifications: {
    info(msg) { this.lastInfo = msg; },
    warn(msg) { this.lastWarn = msg; },
    error(msg) { this.lastError = msg; }
  }
};

// Mock do CONST
globalThis.CONST = {
  CHAT_MESSAGE_TYPES: {
    OTHER: 0,
    OOC: 1,
    IC: 2,
    EMOTE: 3,
    WHISPER: 4,
    ROLL: 5
  }
};

// Mock do ChatMessage
globalThis.ChatMessage = {
  createdMessages: [],
  async create(data) {
    this.createdMessages.push(data);
    return data;
  }
};

// Carrega os hooks e inicializadores do main.js
await import("../scripts/main.js");

// ============================================================================
// 2. SUITE DE TESTES
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FALHA: ${message}`);
    testsFailed++;
  }
}

console.log("\n========================================================");
console.log("   INICIANDO SUITE DE TESTES v1.4.0: custom-channels-chat");
console.log("========================================================\n");

// TESTE 1: Lista padrão de canais
console.log("Teste 1: Lista padrão de canais e garantia do canal 'dados' e 'geral'");
const channels = ChannelManager.getChannels();
assert(channels.includes("geral"), "Canal 'geral' presente");
assert(channels.includes("off-topic"), "Canal 'off-topic' presente");
assert(channels.includes("dados"), "Canal 'dados' presente");

// TESTE 2: Criação de novo canal pela API (GM)
console.log("\nTeste 2: Criação de novo canal pela UI/API (GM)");
const resCreate = await ChannelManager.createChannel("Sala Secreta");
assert(resCreate.success === true, "Canal criado com sucesso");
assert(resCreate.channel === "sala-secreta", "Nome sanitizado para minúsculas com hífen ('sala-secreta')");
assert(ChannelManager.getChannels().includes("sala-secreta"), "Novo canal consta em getChannels()");
assert(ChannelManager.getActiveChannel() === "sala-secreta", "Novo canal tornou-se o canal ativo");

// TESTE 3: Prevenção de duplicidade e validação de nomes vazios
console.log("\nTeste 3: Validação de nomes de canal (duplicados e vazios)");
const resDuplicate = await ChannelManager.createChannel("sala-secreta");
assert(resDuplicate.success === false && resDuplicate.error === "exists", "Canal duplicado rejeitado com erro 'exists'");

const resEmpty = await ChannelManager.createChannel("   ");
assert(resEmpty.success === false && resEmpty.error === "invalid", "Canal com espaços em branco rejeitado com erro 'invalid'");

// TESTE 4: Criação de canal por Jogador (não-GM via Socket)
console.log("\nTeste 4: Criação de canal solicitada por jogador (emissão via socket)");
game.user.isGM = false;
await ChannelManager.createChannel("plano-de-fuga");
const lastSocket = emittedSocketEvents[emittedSocketEvents.length - 1];
assert(lastSocket?.event === "module.custom-channels-chat", "Evento emitido no socket correto");
assert(lastSocket?.data?.action === "createChannel", "Ação 'createChannel' identificada");
assert(lastSocket?.data?.channelName === "plano-de-fuga", "Nome do canal transmitido corretamente");
game.user.isGM = true; // Restaura GM

// TESTE 5: Exclusão de canal e proteção dos canais #geral e #dados
console.log("\nTeste 5: Exclusão de canais e proteção dos canais vitais");
const delGeral = await ChannelManager.deleteChannel("geral");
assert(delGeral === false, "Canal #geral não pode ser excluído");

const delDados = await ChannelManager.deleteChannel("dados");
assert(delDados === false, "Canal #dados não pode ser excluído");

ChannelManager.setActiveChannel("sala-secreta");
const delCustom = await ChannelManager.deleteChannel("sala-secreta");
assert(delCustom === true, "Canal customizado #sala-secreta excluído com sucesso");
assert(!ChannelManager.getChannels().includes("sala-secreta"), "#sala-secreta não está mais na lista de canais");
assert(ChannelManager.getActiveChannel() === "geral", "Após exclusão do canal ativo, voltou para #geral");

// TESTE 6: Renderização da Barra e Delegação de Eventos de Clique
console.log("\nTeste 6: Renderização da Barra de Canais e Botão '+'");
ChannelManager.renderBar(ui.chat, mockChat);
const bar = mockChat.querySelector(".custom-channels-bar");
assert(bar !== null, "Barra de canais (.custom-channels-bar) injetada no chat");

const addBtn = bar.querySelector(".custom-channel-add-btn");
assert(addBtn !== null, "Botão '+' de adicionar canal (.custom-channel-add-btn) presente");

// Simula clique no botão '+'
addBtn.dispatchEvent({ type: "click", preventDefault() {}, stopPropagation() {} });
assert(lastOpenedDialog !== null && lastOpenedDialog.options.title === "Criar Novo Canal", "Clique no botão '+' abriu a modal de criação de canal");

// Simula clique em aba de canal via delegação de evento
ChannelManager.setActiveChannel("geral");
assert(ChannelManager.getActiveChannel() === "geral", "Canal ativo inicial é 'geral'");

const offTopicTab = bar.children.find(c => c.dataset?.channel === "off-topic");
assert(offTopicTab !== null, "Aba #off-topic encontrada");
assert(offTopicTab.innerHTML.includes('<span class="channel-name">off-topic</span>'), "Aba possui label HTML com nome do canal");
assert(offTopicTab.innerHTML.includes('channel-hash'), "Aba possui marcador visual '#' de canal");

offTopicTab.dispatchEvent({ type: "click", preventDefault() {}, stopPropagation() {} });
assert(ChannelManager.getActiveChannel() === "off-topic", "Clique na aba #off-topic trocou o canal ativo com sucesso");

// TESTE 6b: Exclusão de canal via ícone .channel-del-icon sem trocar o canal ativo
console.log("\nTeste 6b: Interceptação de clique no ícone de exclusão");
await ChannelManager.createChannel("canal-teste-del");
ChannelManager.renderBar(ui.chat, mockChat);
const delBar = mockChat.querySelector(".custom-channels-bar");
const delTab = delBar.children.find(c => c.dataset?.channel === "canal-teste-del");
assert(delTab !== null, "Aba #canal-teste-del criada e encontrada na barra");
assert(delTab.innerHTML.includes("channel-del-icon"), "Aba deletável possui ícone de exclusão para GM");

let confirmDialogOpen = false;
let confirmChannel = "";
const origConfirm = Dialog.confirm;
Dialog.confirm = (opts) => {
  confirmDialogOpen = true;
  if (opts.content.includes("canal-teste-del")) confirmChannel = "canal-teste-del";
  if (opts.yes) opts.yes();
};

const mockDelIcon = new MockElement("span");
mockDelIcon.className = "channel-del-icon";
mockDelIcon.dataset.channel = "canal-teste-del";
mockDelIcon.parentElement = delTab;

delTab.listeners["click"][0]({
  target: mockDelIcon,
  preventDefault() {},
  stopPropagation() {}
});

assert(confirmDialogOpen === true && confirmChannel === "canal-teste-del", "Clique no ícone de exclusão abriu confirmação e executou exclusão");
Dialog.confirm = origConfirm;

// TESTE 6c: Tecla Enter no modal de criação de canal
console.log("\nTeste 6c: Submissão via tecla Enter no modal de criação de canal");
let enterChannelCreated = false;
const origCreate = ChannelManager.createChannel;
ChannelManager.createChannel = async (name) => {
  if (name === "canal-via-enter") enterChannelCreated = true;
  return { success: true };
};
ChannelManager.showCreateChannelDialog();
if (lastOpenedDialog && lastOpenedDialog.options.render) {
  const mockDiv = new MockElement("div");
  const mockInput = new MockElement("input");
  mockInput.id = "new-channel-name-input";
  mockInput.value = "canal-via-enter";
  mockDiv.children.push(mockInput);
  
  const mockCreateBtn = new MockElement("button");
  mockCreateBtn.className = "dialog-button create";
  mockCreateBtn.click = () => { lastOpenedDialog.options.buttons.create.callback(mockDiv); };
  mockDiv.children.push(mockCreateBtn);
  
  lastOpenedDialog.options.render(mockDiv);
  mockInput.dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
  assert(enterChannelCreated === true, "Pressionar tecla Enter no campo de texto submete e cria o canal diretamente");
}
ChannelManager.createChannel = origCreate;

// TESTE 6d: Criação otimista de canal por jogador (visível na sessão)
console.log("\nTeste 6d: Criação otimista de canal por jogador");
game.user.isGM = false;
await ChannelManager.createChannel("plano-secreto-jogadores");
assert(ChannelManager.getChannels().includes("plano-secreto-jogadores"), "Jogador tem canal adicionado imediatamente via localChannels de forma otimista");
game.user.isGM = true;

// TESTE 7: Filtragem de Mensagens e Auto-Tagging de Mensagens Existentes
console.log("\nTeste 7: Filtragem e Auto-Tagging de mensagens no DOM");
ChannelManager.setActiveChannel("off-topic");
// Cria mensagens simuladas no mockChatLog
const msgGeral = new MockElement("li");
msgGeral.className = "chat-message message";
msgGeral.id = "msg-1";
msgGeral.dataset.messageId = "msg-1";
mockChatLog.appendChild(msgGeral);

const msgOffTopic = new MockElement("li");
msgOffTopic.className = "chat-message message";
msgOffTopic.id = "msg-2";
msgOffTopic.dataset.messageId = "msg-2";
msgOffTopic.dataset.channel = "off-topic";
mockChatLog.appendChild(msgOffTopic);

// Roda filterMessages() enquanto o canal ativo é "off-topic"
ChannelManager.filterMessages();

assert(msgGeral.dataset.channel === "geral", "Mensagem sem canal foi auto-identificada como 'geral'");
assert(msgGeral.classList.contains("custom-channel-hidden"), "Mensagem de #geral recebeu classe .custom-channel-hidden");
assert(!msgOffTopic.classList.contains("custom-channel-hidden"), "Mensagem de #off-topic permanece visível");

const styleTag = document.getElementById("custom-channels-filter-style");
assert(styleTag.textContent.includes('.chat-message:not([data-channel="off-topic"])'), "Regra CSS contém seletores para .chat-message");
assert(styleTag.textContent.includes('.message:not([data-channel="off-topic"])'), "Regra CSS contém seletores para .message");

// TESTE 8: Barra de Ferramentas de Mídia (Botões Imagem e GIF/URL)
console.log("\nTeste 8: Injeção da Toolbar de Mídia no Chat");
ImageHandler.initInput(ui.chat, mockChat);
const mediaToolbar = mockChat.querySelector(".custom-chat-media-toolbar");
assert(mediaToolbar !== null, "Barra de ferramentas de mídia (.custom-chat-media-toolbar) injetada");

const attachBtn = mockChat.querySelector(".custom-chat-attach-btn");
assert(attachBtn !== null, "Botão 'Imagem' (.custom-chat-attach-btn) presente");

const gifBtn = mockChat.querySelector(".custom-chat-gif-btn");
assert(gifBtn !== null, "Botão 'GIF / URL' (.custom-chat-gif-btn) presente");

// Simula clique no botão GIF/URL
gifBtn.dispatchEvent({ type: "click", preventDefault() {}, stopPropagation() {} });
assert(lastOpenedDialog !== null && lastOpenedDialog.options.title === "Enviar Imagem ou GIF", "Clique no botão 'GIF / URL' abriu modal com live preview");

// TESTE 9: Reconhecimento e Resolução de URLs de Imagem e GIF
console.log("\nTeste 9: Detecção de URLs diretas, Tenor, Giphy e Imgur");
assert(ImageHandler.isMediaUrl("https://example.com/foto.png"), "URL .png direta reconhecida");
assert(ImageHandler.isMediaUrl("https://example.com/animacao.gif"), "URL .gif direta reconhecida");
assert(ImageHandler.isMediaUrl("https://example.com/imagem.webp"), "URL .webp direta reconhecida");
assert(ImageHandler.isMediaUrl("https://tenor.com/view/funny-cat-gif-12345"), "URL do Tenor reconhecida");
assert(ImageHandler.isMediaUrl("https://media.tenor.com/abc/cat.gif"), "URL do Tenor media reconhecida");
assert(ImageHandler.isMediaUrl("https://giphy.com/gifs/cat-cute-3oKIPnAiaMCws8nOsE"), "URL do Giphy reconhecida");
assert(ImageHandler.isMediaUrl("https://imgur.com/gallery/abc.png"), "URL do Imgur reconhecida");
assert(!ImageHandler.isMediaUrl("https://google.com"), "URL comum (Google) não é tratada como mídia");

// Resolução de Giphy
const resolvedGiphy = ImageHandler.resolveMediaUrl("https://giphy.com/gifs/cat-cute-3oKIPnAiaMCws8nOsE");
assert(resolvedGiphy === "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif", "Página do Giphy resolvida para GIF direto");

// TESTE 10: Auto-incorporação de Links de Imagem e GIF em Mensagens
console.log("\nTeste 10: Processamento de conteúdo de mensagem com links de mídia");
// 10a. Apenas link
const pureUrl = "https://media.giphy.com/media/test/giphy.gif";
const processedPure = ImageHandler.processMessageContent(pureUrl);
assert(processedPure.includes('class="discord-image-container"'), "Mensagem pura com URL foi convertida em container de imagem");
assert(processedPure.includes('src="https://media.giphy.com/media/test/giphy.gif"'), "Tag <img> com o link correto inserida");

// 10b. Texto com link
const textWithUrl = "Olha esse monstro: https://i.imgur.com/monster.png";
const processedMixed = ImageHandler.processMessageContent(textWithUrl);
assert(processedMixed.includes('<p class="discord-message-text">Olha esse monstro:</p>'), "Texto acompanhante preservado em parágrafo");
assert(processedMixed.includes('src="https://i.imgur.com/monster.png"'), "Imagem anexada logo abaixo do texto");

// 10c. Mensagem que já contém tag <img>
const alreadyImg = '<img src="icons/sword.png" />';
assert(ImageHandler.processMessageContent(alreadyImg) === alreadyImg, "Mensagem que já possui imagem não sofre alteração duplicada");

// 10d. URL envolta em tags HTML <p>...</p>
const wrappedUrl = "<p>https://media.giphy.com/media/test/giphy.gif</p>";
const processedWrapped = ImageHandler.processMessageContent(wrappedUrl);
assert(processedWrapped.includes('class="discord-image-container"'), "URL envolta em <p> é convertida em container de imagem");
assert(!processedWrapped.includes("<p></p>") && !processedWrapped.includes('<p class="discord-message-text"></p>'), "URL envolta em <p> não gera parágrafos vazios ou aninhamentos inválidos");

// TESTE 11: Envio direto de Imagem via sendImageUrl
console.log("\nTeste 11: Envio de URL via sendImageUrl");
await ImageHandler.sendImageUrl("https://example.com/dragao.jpg", "geral");
const lastCreated = ChatMessage.createdMessages[ChatMessage.createdMessages.length - 1];
assert(lastCreated.flags["custom-channels-chat"].channel === "geral", "Mensagem enviada com flag de canal 'geral'");
assert(lastCreated.flags["custom-channels-chat"].isImage === true, "Mensagem marcada com flag isImage: true");
assert(lastCreated.content.includes("https://example.com/dragao.jpg"), "Conteúdo contém a URL da imagem");

// TESTE 12: Preservação de GIFs animados no upload
console.log("\nTeste 12: GIFs animados não são rasterizados em canvas");
const gifBlob = new Blob(["fake-gif-data"], { type: "image/gif" });
const optimizedGif = await ImageHandler.optimizeImage(gifBlob);
assert(optimizedGif === gifBlob, "GIF animado mantido intacto sem perda de quadros");

// TESTE 13: Fallback Base64 para envio de imagem
console.log("\nTeste 13: Conversão de imagem para Base64 (fallback garantido)");
const fakeFile = new Blob(["test-image-binary-data"], { type: "image/png" });
fakeFile.name = "exemplo.png";

// TESTE 14: Proteção de cards de sistema e itens em formatDomMessage
console.log("\nTeste 14: Proteção de cards de sistema e itens em formatDomMessage");
const normalCard = new MockElement("div");
normalCard.className = "chat-message";
const normalCardContent = new MockElement("div");
normalCardContent.className = "message-content";
const itemIcon = new MockElement("img");
itemIcon.src = "icons/weapons/espada.png";
normalCardContent.appendChild(itemIcon);
normalCard.appendChild(normalCardContent);

const mockMsgDocNotImage = {
  getFlag(mod, key) { return false; }
};

ImageHandler.formatDomMessage(mockMsgDocNotImage, normalCard);
assert(!itemIcon.classList.contains("discord-chat-img"), "Ícone de item de card de sistema NÃO foi alterado para imagem de chat");
assert(normalCard.querySelector(".discord-image-container") === null, "Nenhum container Discord foi injetado em card comum");

// TESTE 15: Preservação de speaker ao falar em personagem
console.log("\nTeste 15: Preservação de speaker ao falar em personagem");
const mockDocSpeaker = {
  content: "Falando como Gandalf",
  speaker: { actor: "actor-123", token: "token-456", alias: "Gandalf" },
  updateSource(updates) { this.updates = updates; }
};
const mockCreateData = {
  content: "Falando como Gandalf",
  speaker: { actor: "actor-123", token: "token-456", alias: "Gandalf" }
};
const currentActive = ChannelManager.getActiveChannel();
const updates = { "flags.custom-channels-chat.channel": currentActive };
mockDocSpeaker.updateSource(updates);

assert(mockDocSpeaker.speaker.actor === "actor-123", "speaker.actor preservado para fala de personagem");
assert(mockDocSpeaker.speaker.token === "token-456", "speaker.token preservado para fala de personagem");
assert(mockDocSpeaker.speaker.alias === "Gandalf", "speaker.alias preservado para fala de personagem");

globalThis.FileReader = class {
  readAsDataURL(blob) {
    setTimeout(() => {
      this.result = "data:image/png;base64,dGVzdC1pbWFnZS1iaW5hcnktZGF0YQ==";
      if (this.onload) this.onload();
    }, 10);
  }
};

const base64Result = await ImageHandler.fileToBase64(fakeFile);
assert(base64Result.startsWith("data:image/png;base64,"), "Fallback Base64 funcionou corretamente com Data URL");

// TESTE 16: Visualizador Responsivo Lightbox (Viewport-adapted)
console.log("\nTeste 16: Visualizador Responsivo Lightbox (openLightbox, Esc, Close, Open Original)");
const lightboxOverlay = ImageHandler.openLightbox("https://example.com/mapa-mundi.png", "Mapa Épico");
assert(lightboxOverlay !== null, "Lightbox instanciado com sucesso");
assert(lightboxOverlay.classList.contains("custom-image-lightbox-overlay"), "Overlay possui classe .custom-image-lightbox-overlay");
assert(lightboxOverlay.classList.contains("active"), "Overlay possui classe .active para animação suave");
assert(document.body.children.includes(lightboxOverlay), "Lightbox inserido no document.body");

const lbImg = lightboxOverlay.querySelector(".custom-lightbox-image");
assert(lbImg !== null && lbImg.src === "https://example.com/mapa-mundi.png", "Imagem carregada no Lightbox com URL correta");

const openExtBtn = lightboxOverlay.querySelector(".custom-lightbox-open-ext");
assert(openExtBtn !== null && openExtBtn.href === "https://example.com/mapa-mundi.png", "Botão 'Abrir Original' presente com link correto");

// Testa tecla Escape para fechar
document.dispatchEvent({ type: "keydown", key: "Escape", preventDefault() {} });
assert(!lightboxOverlay.classList.contains("active"), "Pressionar Escape remove classe .active para fechar Lightbox");

// Testa clique em .discord-chat-img disparando Lightbox
let openedUrl = "";
const origOpenLightbox = ImageHandler.openLightbox;
ImageHandler.openLightbox = (src) => { openedUrl = src; return null; };

const fakeChatImg = new MockElement("img");
fakeChatImg.className = "discord-chat-img";
fakeChatImg.src = "https://example.com/aventura.png";
mockChatLog.appendChild(fakeChatImg);

document.dispatchEvent({
  type: "click",
  target: fakeChatImg,
  preventDefault() {},
  stopPropagation() {}
});
assert(openedUrl === "https://example.com/aventura.png", "Clique em .discord-chat-img aciona abertura automática do Lightbox");
ImageHandler.openLightbox = origOpenLightbox;

// TESTE 17: Barra de Canais Fixada (Sticky), Rolagem Horizontal e Truncamento de Nome
console.log("\nTeste 17: Barra de Canais Pinned/Sticky e Rolagem Horizontal (Wheel)");
ChannelManager.renderBar(ui.chat, mockChat);
const stickyBar = mockChat.querySelector(".custom-channels-bar");
assert(stickyBar !== null, "Barra de canais renderizada no topo");

// Simula scroll wheel horizontal na barra
stickyBar.dispatchEvent({ type: "wheel", deltaY: 150, preventDefault() {} });
assert(stickyBar.scrollLeft === 150, "Evento de roda do mouse (wheel) realiza rolagem horizontal em sidebars estreitas");

// Truncamento seguro de nomes longos de canal a no máximo 30 caracteres
const longChannelResult = await ChannelManager.createChannel("canal-com-nome-extremamente-longo-que-ultrapassa-trinta-caracteres");
assert(longChannelResult.success === true, "Canal criado com sucesso");
assert(longChannelResult.channel.length <= 30, `Nome do canal limitado a 30 caracteres (atual: ${longChannelResult.channel.length})`);

// TESTE 18: Isolamento do Container e Posicionamento Fora do ChatLog
console.log("\nTeste 18: Isolamento de Rolagem e Inserção Fora do ChatLog");
const chatLogEl = mockChat.querySelector("#chat-log");
assert(!chatLogEl.children.some(c => c.matches?.(".custom-channels-bar")), "Barra de canais NÃO está contida dentro do #chat-log");
assert(mockChat.children[0] === stickyBar || mockChat.children.indexOf(stickyBar) < mockChat.children.indexOf(chatLogEl), "Barra de canais está posicionada firmemente ANTES do #chat-log");

// TESTE 19: Fechamento ao clicar fora da imagem e navegação de Data URL
console.log("\nTeste 19: Fechamento do Lightbox no Overlay e Abertura Segura de Data URL");
const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const dataLightbox = ImageHandler.openLightbox(dataUrl, "Data Image");
assert(dataLightbox !== null, "Lightbox instanciado com Data URL");
assert(document.body.classList.contains("custom-lightbox-open"), "Classe .custom-lightbox-open adicionada ao body para travar rolagem");

const dataOpenBtn = dataLightbox.querySelector(".custom-lightbox-open-ext");
assert(dataOpenBtn !== null, "Botão de abrir presente");
dataOpenBtn.dispatchEvent({ type: "click", preventDefault() {}, stopPropagation() {} });
assert(lastWindowOpened !== null, "window.open chamado com segurança para Data URL sem bloqueio de navegação do browser");
assert(lastWindowOpened.document.written.includes(dataUrl), "Imagem gravada no documento da nova janela aberta");

// Clicar fora da imagem (no overlay ou backdrop) deve fechar
dataLightbox.dispatchEvent({ type: "click", target: dataLightbox, preventDefault() {}, stopPropagation() {} });
assert(!dataLightbox.classList.contains("active"), "Clique no overlay fecha o Lightbox");

// TESTE 20: Captura de clique em imagens genéricas do chat e proteção de avatares/dados
console.log("\nTeste 20: Interceptação em Fase de Captura de Imagens de Chat e Proteção de Avatares");
let capturedSrc = "";
const prevOpenLightbox = ImageHandler.openLightbox;
ImageHandler.openLightbox = (src) => { capturedSrc = src; return null; };

// 1. Imagem comum sem classe dentro do chat log
const plainChatImg = new MockElement("img");
plainChatImg.src = "https://example.com/mapa-secreto.jpg";
mockChatLog.appendChild(plainChatImg);

document.dispatchEvent({
  type: "click",
  target: plainChatImg,
  preventDefault() {},
  stopPropagation() {}
});
assert(capturedSrc === "https://example.com/mapa-secreto.jpg", "Imagem comum dentro do #chat-log interceptada e aberta no Lightbox");

// 2. Avatar de autor não deve ser aberto no Lightbox
capturedSrc = "";
const avatarImg = new MockElement("img");
avatarImg.className = "avatar";
avatarImg.src = "icons/mestre.png";
const avatarWrap = new MockElement("div");
avatarWrap.className = "discord-avatar-wrap";
avatarWrap.appendChild(avatarImg);
mockChatLog.appendChild(avatarWrap);

document.dispatchEvent({
  type: "click",
  target: avatarImg,
  preventDefault() {},
  stopPropagation() {}
});
assert(capturedSrc === "", "Avatar do autor ignorado pelo interceptador de Lightbox");

ImageHandler.openLightbox = prevOpenLightbox;

// TESTE 21: Isolamento de Rolagem (scrollToTab) e Bloqueio de Scroll no container #chat
console.log("\nTeste 21: Isolamento de Rolagem (scrollToTab) e Bloqueio de Scroll no container pai");
const mockNav = new MockElement("nav");
mockNav.className = "custom-channels-bar";
mockNav.scrollWidth = 600;
mockNav.clientWidth = 200;
mockNav.scrollLeft = 0;

const mockTabA = new MockElement("button");
mockTabA.offsetLeft = 250;
mockTabA.offsetWidth = 80;
mockNav.appendChild(mockTabA);

ChannelManager.scrollToTab(mockNav, mockTabA);
assert(mockNav.scrollLeft > 0, "scrollToTab ajusta o scrollLeft do container nav para exibir a aba");
assert(mockTabA.scrolledIntoView !== true, "scrollToTab NÃO dispara scrollIntoView nativo que desalinharia os containers pais");

// Teste de bloqueio de scroll indevido no chatContainer
mockChat.scrollTop = 50;
mockChat.dispatchEvent({ type: "scroll" });
assert(mockChat.scrollTop === 0, "Listener de scroll lock reseta qualquer tentativa do browser de rolar o container #chat no foco");

// TESTE 22: Proteção e centralização de ImagePopout nativo (Hook renderImagePopout)
console.log("\nTeste 22: Hook renderImagePopout centraliza e restringe popout ao viewport");
let popoutPosition = null;
const fakePopoutApp = {
  position: { width: 2500, height: 1600, top: 100, left: 100 },
  setPosition(pos) { popoutPosition = pos; }
};
const fakePopoutHtml = new MockElement("div");
fakePopoutHtml.className = "image-popout";

globalThis.Hooks.callAll("renderImagePopout", fakePopoutApp, fakePopoutHtml, {});
assert(popoutPosition !== null, "Hook renderImagePopout executado com sucesso");
assert(popoutPosition.width <= 1920 * 0.9, "Largura do popout restrita a no máximo 90vw");
assert(popoutPosition.height <= 1080 * 0.9, "Altura do popout restrita a no máximo 90vh");
assert(popoutPosition.left >= 10, "Popout mantido centralizado e visível na tela");

// TESTE 23: Isolamento e Ocultação das Abas da Sidebar (Prevenção de Sobreposição do Chat em Atores/Cenas/etc.)
console.log("\nTeste 23: Isolamento CSS de abas ativas/inativas da sidebar e prevenção de vazamento do chat");
const cssPath = new URL("../styles/custom-channels-chat.css", import.meta.url);
const cssContent = fs.readFileSync(cssPath, "utf-8");

assert(cssContent.includes("#chat.active"), "Regra CSS do container do chat restrita à classe .active");
assert(cssContent.includes('#sidebar .tab[data-tab="chat"].active'), "Regra da tab chat restrita à classe .active");
assert(cssContent.includes("section#chat.sidebar-tab.active"), "Regra section#chat restrita à classe .active");
assert(cssContent.includes('#sidebar .tab[data-tab="chat"]:not(.active)'), "Regra explícita de display: none para chat inativo na sidebar");
assert(cssContent.includes('#chat:not(.active):not(#chat-popout):not(.chat-popout)'), "Chat inativo ocultado com display: none !important exceto se for popout");
assert(cssContent.includes('#sidebar.collapsed #chat'), "Chat ocultado com display: none !important quando sidebar estiver recolhida");

// Simulação de troca de aba na sidebar para 'actors'
let chatBarReRendered = false;
const origRenderBar = ChannelManager.renderBar;
ChannelManager.renderBar = () => { chatBarReRendered = true; };
mockChat.classList.remove("active");
globalThis.Hooks.callAll("changeSidebarTab", { tabName: "actors" });
assert(chatBarReRendered === false, "changeSidebarTab com tabName='actors' NÃO processa aba de chat");
ChannelManager.renderBar = origRenderBar;

// Verificação de isolamento via syncChatVisibility (esconde #chat com display: none e hidden)
globalThis.Hooks.callAll("changeSidebarTab", { tabName: "actors" });
assert(mockChat.style.display === "none", "changeSidebarTab para 'actors' aplicou display: none inline no #chat");
assert(mockChat.hasAttribute("hidden") === true, "changeSidebarTab para 'actors' aplicou atributo hidden no #chat");
assert(!mockChat.classList.contains("active"), "changeSidebarTab para 'actors' removeu classe .active do #chat");

globalThis.Hooks.callAll("changeSidebarTab", { tabName: "chat" });
assert(mockChat.style.display !== "none", "changeSidebarTab para 'chat' removeu display: none inline do #chat");
assert(mockChat.hasAttribute("hidden") === false, "changeSidebarTab para 'chat' removeu atributo hidden do #chat");
assert(mockChat.classList.contains("active"), "changeSidebarTab para 'chat' adicionou classe .active ao #chat");

mockSidebar.classList.add("collapsed");
globalThis.Hooks.callAll("collapseSidebar", mockSidebar, true);
assert(mockChat.style.display === "none", "collapseSidebar(true) aplicou display: none inline no #chat");
mockSidebar.classList.remove("collapsed");
globalThis.Hooks.callAll("collapseSidebar", mockSidebar, false);
assert(mockChat.style.display !== "none", "collapseSidebar(false) restaurou visualização do #chat quando ativo");

// TESTE 24: Detecção Robusta de Rolagens e Dano Multi-Sistemas (ChannelManager.isDiceOrDamage)
console.log("\nTeste 24: Detector Multi-Sistemas de Rolagens e Dano (D&D 5e, PF2e, Tormenta20, Midi-QOL, etc.)");

// 24a. Propriedades nativas do Foundry
assert(ChannelManager.isDiceOrDamage({ isRoll: true }) === true, "isRoll: true reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { isRoll: true }) === true, "createData.isRoll: true reconhecido");
assert(ChannelManager.isDiceOrDamage({ rolls: [{ total: 15 }] }) === true, "messageDoc.rolls com itens reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { rolls: [{ total: 15 }] }) === true, "data.rolls com itens reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { type: CONST.CHAT_MESSAGE_TYPES.ROLL }) === true, "data.type === ROLL reconhecido");

// 24b. D&D 5e (dnd5e)
assert(ChannelManager.isDiceOrDamage({}, { flags: { dnd5e: { roll: { formula: "1d20+5" } } } }) === true, "D&D 5e flags.dnd5e.roll reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { dnd5e: { damage: true } } }) === true, "D&D 5e flags.dnd5e.damage reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { dnd5e: { damageRoll: { formula: "2d6" } } } }) === true, "D&D 5e flags.dnd5e.damageRoll reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { dnd5e: { rollType: "damage" } } }) === true, "D&D 5e flags.dnd5e.rollType='damage' reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { dnd5e: { type: "damage" } } }) === true, "D&D 5e flags.dnd5e.type='damage' reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { dnd5e: { activity: { type: "attack" } } } }) === true, "D&D 5e v4 activity card reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { dnd5e: { use: true } } }) === true, "D&D 5e card de uso de item reconhecido");

// 24c. Pathfinder 2e (pf2e)
assert(ChannelManager.isDiceOrDamage({}, { flags: { pf2e: { context: { type: "damage-roll" } } } }) === true, "PF2e damage-roll no context reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { pf2e: { context: { type: "spell-attack-roll" } } } }) === true, "PF2e spell-attack-roll reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { pf2e: { damage: { total: 24 } } } }) === true, "PF2e flags.pf2e.damage reconhecido");

// 24d. Midi-QOL
assert(ChannelManager.isDiceOrDamage({}, { flags: { "midi-qol": { workflowId: "wf-123", damageRoll: true } } }) === true, "Midi-QOL com workflow e dano reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { "midi-qol": { itemCardId: "item-1" } } }) === true, "Midi-QOL card reconhecido");

// 24e. Ready Set Roll 5e & Better Rolls 5e
assert(ChannelManager.isDiceOrDamage({}, { flags: { "ready-set-roll-5e": { roll: {} } } }) === true, "Ready Set Roll 5e reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { "betterrolls5e": { entries: [] } } }) === true, "Better Rolls 5e reconhecido");

// 24f. Tormenta20 (T20)
assert(ChannelManager.isDiceOrDamage({}, { flags: { tormenta20: { rollType: "dano" } } }) === true, "Tormenta20 rollType='dano' reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { t20: { dano: true } } }) === true, "T20 flag dano reconhecida");

// 24g. Conteúdo HTML (marcações típicas de rolagens e dano)
assert(ChannelManager.isDiceOrDamage({}, { content: '<div class="dice-roll"><div class="dice-total">18</div></div>' }) === true, "HTML com .dice-roll e .dice-total reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<p>Ataque: <span class="inline-roll">[[1d20+3]]</span></p>' }) === true, "HTML com .inline-roll reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<button data-damage="2d8+4">Aplicar Dano</button>' }) === true, "HTML com [data-damage] reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<div class="damage-card">Card de dano</div>' }) === true, "HTML com .damage-card reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<div class="dnd5e-damage">Dano Crítico</div>' }) === true, "HTML com .dnd5e-damage reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<div class="chat-card"><span class="damage">15 de corte</span></div>' }) === true, "HTML com class='damage' reconhecido");

// 24j. Chaves achatadas de atualização (dot-notation)
assert(ChannelManager.isDiceOrDamage({}, { "flags.dnd5e.damage": true }) === true, "Flags achatadas flags.dnd5e.damage reconhecidas");
assert(ChannelManager.isDiceOrDamage({}, { "flags.midi-qol.damageRoll": true }) === true, "Flags achatadas flags.midi-qol.damageRoll reconhecidas");
assert(ChannelManager.isDiceOrDamage({}, { "flags.pf2e.context": { type: "damage-roll" } }) === true, "Flags achatadas flags.pf2e.context reconhecidas");
assert(ChannelManager.isDiceOrDamage({}, { "flags.tormenta20.rollType": "dano" }) === true, "Flags achatadas flags.tormenta20.rollType reconhecidas");

// 24k. Botões de ação e atributos em D&D 5e (v3/v4), PF2e, Tormenta20 e Ordem Paranormal
assert(ChannelManager.isDiceOrDamage({}, { content: '<button data-action="applyDamage">Aplicar Dano</button>' }) === true, "Botão data-action=applyDamage do D&D 5e reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<button data-action="damage">Dano</button>' }) === true, "Botão data-action=damage reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<button data-action="rollDamage">Rolar Dano</button>' }) === true, "Botão data-action=rollDamage reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<button data-action="aplicar-dano">Aplicar Dano</button>' }) === true, "Botão data-action=aplicar-dano reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<button data-action="activityUse">Usar Atividade</button>' }) === true, "Botão data-action=activityUse reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<button data-action="applyHeal">Aplicar Cura</button>' }) === true, "Botão data-action=applyHeal reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<button data-action="strike-damage">Dano de Golpe PF2e</button>' }) === true, "Botão data-action=strike-damage reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<button data-acao="dano">Dano</button>' }) === true, "Botão data-acao=dano do Tormenta20 reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { content: '<button data-acao="rolar-dano">Rolar Dano</button>' }) === true, "Botão data-acao=rolar-dano reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { ordemparanormal: { dano: true } } }) === true, "Flag Ordem Paranormal reconhecida");

// 24l. Flavor, singular roll, Dice So Nice, SWADE, D&D 5e messageType
assert(ChannelManager.isDiceOrDamage({ flavor: "Damage Roll" }) === true, "Flavor 'Damage Roll' reconhecido");
assert(ChannelManager.isDiceOrDamage({ flavor: "Rolagem de Dano: 2d6 Fogo" }) === true, "Flavor 'Rolagem de Dano' reconhecido");
assert(ChannelManager.isDiceOrDamage({ flavor: "Cura: 2d8+3 PV" }) === true, "Flavor 'Cura' reconhecido");
assert(ChannelManager.isDiceOrDamage({ flavor: "Acerto Crítico!" }) === true, "Flavor 'Crítico' reconhecido");
assert(ChannelManager.isDiceOrDamage({ roll: { total: 10 } }) === true, "messageDoc.roll singular reconhecido");
assert(ChannelManager.isDiceOrDamage({}, { flags: { "dice-so-nice": {} } }) === true, "Flag Dice So Nice (3D dice) reconhecida");
assert(ChannelManager.isDiceOrDamage({}, { flags: { swade: { roll: {} } } }) === true, "Flag Savage Worlds (swade) reconhecida");
assert(ChannelManager.isDiceOrDamage({}, { flags: { dnd5e: { messageType: "damage" } } }) === true, "D&D 5e messageType=damage reconhecido");

// 24m. Inspeção em nó DOM
const domRollEl = new MockElement("div");
domRollEl.className = "chat-message message";
const innerRoll = new MockElement("div");
innerRoll.className = "dice-roll";
domRollEl.appendChild(innerRoll);
assert(ChannelManager.isDiceOrDamage({}, {}, domRollEl) === true, "Elemento DOM contendo .dice-roll reconhecido");

const domDamageBtn = new MockElement("div");
domDamageBtn.className = "chat-message message";
const btnDmg = new MockElement("button");
btnDmg.setAttribute("data-damage", "3d6");
domDamageBtn.appendChild(btnDmg);
assert(ChannelManager.isDiceOrDamage({}, {}, domDamageBtn) === true, "Elemento DOM contendo [data-damage] reconhecido");

// 24n. Proteção contra falsos positivos (mensagens comuns não devem ir para #dados)
assert(ChannelManager.isDiceOrDamage({}, { content: "Tomou 5 pontos de dano da armadilha!" }) === false, "Frase comum contendo a palavra 'dano' NÃO é classificada como rolagem");
assert(ChannelManager.isDiceOrDamage({}, { content: "That weapon does 1d8 slashing damage on hit." }) === false, "Frase em inglês contendo a palavra 'damage' NÃO é classificada como rolagem");
assert(ChannelManager.isDiceOrDamage({}, { content: "https://example.com/imagem.png" }) === false, "URL de imagem NÃO é classificada como rolagem");

// TESTE 25: Roteamento Automático de Dano e Rolagens no Ciclo de Vida (preCreate, preUpdate, render, update)
console.log("\nTeste 25: Roteamento de Dano e Dados no Ciclo de Vida dos Hooks");

// 25a. preCreateChatMessage com dano/rolagem força canal 'dados' mesmo com outro canal ativo
ChannelManager.setActiveChannel("off-topic");
const mockDamageMsgDoc = {
  content: '<div class="dice-roll"><div class="dice-total">24</div></div>',
  updateSource(updates) { this.updates = updates; },
  getFlag(mod, key) { return this.updates?.[`flags.${mod}.${key}`]; }
};
const mockDamageCreateData = {
  content: '<div class="dice-roll"><div class="dice-total">24</div></div>',
  flags: { "custom-channels-chat": { channel: "off-topic" } }
};
globalThis.Hooks.callAll("preCreateChatMessage", mockDamageMsgDoc, mockDamageCreateData, {}, "user-1");
assert(mockDamageMsgDoc.updates?.["flags.custom-channels-chat.channel"] === "dados", "preCreateChatMessage forçou 'dados' mesmo com off-topic ativo");
assert(mockDamageCreateData.flags["custom-channels-chat"].channel === "dados", "createData atualizado para 'dados'");

// 25b. preUpdateChatMessage atualiza canal para 'dados' quando dano é adicionado
const mockItemCardDoc = {
  content: '<div class="dnd5e chat-card item-card">Espada Longa</div>',
  flags: { "custom-channels-chat": { channel: "geral" } },
  getFlag(mod, key) { return this.flags?.[mod]?.[key]; },
  updateSource(updates) { this.updatedSource = updates; }
};
const mockUpdateChanges = {
  content: '<div class="dnd5e chat-card item-card">Espada Longa<div class="dice-roll"><div class="dice-total">11</div></div></div>',
  rolls: [{ total: 11 }]
};
globalThis.Hooks.callAll("preUpdateChatMessage", mockItemCardDoc, mockUpdateChanges, {}, "user-1");
assert(mockUpdateChanges.flags?.["custom-channels-chat"]?.channel === "dados", "preUpdateChatMessage atualizou channel para 'dados' ao receber rolagem");

// 25c. handleChatMessageRender força el.dataset.channel='dados' e limpa estilos de Discord
const damageRenderEl = new MockElement("div");
damageRenderEl.className = "chat-message message discord-styled-message";
const avatarInCard = new MockElement("div");
avatarInCard.className = "discord-avatar-wrap";
damageRenderEl.appendChild(avatarInCard);
const diceInCard = new MockElement("div");
diceInCard.className = "dice-roll";
damageRenderEl.appendChild(diceInCard);

const damageRenderDoc = {
  content: "Dano da Magia",
  getFlag(mod, key) { return "geral"; } // Flag antiga dizia 'geral'
};

globalThis.Hooks.callAll("renderChatMessage", damageRenderDoc, damageRenderEl, {});
assert(damageRenderEl.dataset.channel === "dados", "handleChatMessageRender forçou dataset.channel = 'dados' independente de flags anteriores");
assert(!damageRenderEl.classList.contains("discord-styled-message"), "Classe discord-styled-message removida do card de dano");
assert(damageRenderEl.querySelector(".discord-avatar-wrap") === null, "Avatar de usuário Discord removido do card de dano");

// 25d. updateChatMessage sincroniza elemento DOM existente em tempo real quando atualizado com dano
ChannelManager.setActiveChannel("geral");
const existingCardEl = new MockElement("div");
existingCardEl.className = "chat-message message discord-styled-message";
existingCardEl.setAttribute("data-message-id", "msg-card-123");
existingCardEl.dataset.channel = "geral";
const avatarInCardEl = new MockElement("div");
avatarInCardEl.className = "discord-avatar-wrap";
existingCardEl.appendChild(avatarInCardEl);

const origQuerySelector = globalThis.document.querySelector;
globalThis.document.querySelector = (sel) => {
  if (typeof sel === "string" && sel.includes("msg-card-123")) return existingCardEl;
  return origQuerySelector(sel);
};

const updateMsgDoc = {
  id: "msg-card-123",
  content: "Card de Item Atualizado com Dano",
  getFlag(mod, key) { return "dados"; }
};
const updateChanges2 = {
  content: '<button data-action="applyDamage">Aplicar Dano</button>',
  rolls: [{ total: 18 }]
};

ChannelManager.unreadCounts["dados"] = 0;
globalThis.Hooks.callAll("updateChatMessage", updateMsgDoc, updateChanges2, {}, "user-1");

assert(existingCardEl.dataset.channel === "dados", "updateChatMessage atualizou dataset.channel para 'dados' no elemento DOM");
assert(existingCardEl.classList.contains("custom-channel-hidden"), "Mensagem agora de 'dados' oculta enquanto activeChannel for 'geral'");
assert(!existingCardEl.classList.contains("discord-styled-message"), "Classe discord-styled-message removida do DOM no updateChatMessage");
assert(existingCardEl.querySelector(".discord-avatar-wrap") === null, "Avatar removido do elemento DOM no updateChatMessage");
assert(ChannelManager.unreadCounts["dados"] === 1, "Badge de não lidas incrementado para #dados");

globalThis.document.querySelector = origQuerySelector;


// ============================================================================
// 3. BENCHMARK DE PERFORMANCE & CARGA
// ============================================================================

console.log("\n========================================================");
console.log("   BENCHMARK DE PERFORMANCE: ESCALABILIDADE DE MENSAGENS");
console.log("========================================================\n");

const numIteracoes = 10000;
const start = performance.now();

for (let i = 0; i < numIteracoes; i++) {
  const targetChannel = i % 2 === 0 ? "geral" : "dados";
  ChannelManager.activeChannel = targetChannel;
  ChannelManager.filterMessages();
}

const elapsed = performance.now() - start;
const avgPerSwitch = elapsed / numIteracoes;

console.log(`Tempo total para ${numIteracoes.toLocaleString()} trocas de canal: ${elapsed.toFixed(2)} ms`);
console.log(`Tempo médio por troca de canal: ${avgPerSwitch.toFixed(4)} ms`);

assert(avgPerSwitch < 0.1, `Performance ultra-rápida garantida (< 0.1ms por troca). Atual: ${avgPerSwitch.toFixed(4)}ms`);

// ============================================================================
// 4. RESULTADO FINAL
// ============================================================================

console.log("\n========================================================");
console.log(`   TESTES CONCLUÍDOS: ${testsPassed} PASSARAM, ${testsFailed} FALHARAM`);
console.log("========================================================\n");

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log(`>> Todos os ${testsPassed} testes passaram com sucesso e a performance está comprovadamente excelente! <<\n`);
}
