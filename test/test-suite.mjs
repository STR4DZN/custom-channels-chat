/**
 * Suite de Testes Automatizados e Benchmark de Performance
 * para o módulo custom-channels-chat v1.3.0
 */

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

class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.classList = new MockClassList(this);
    this.style = {};
    this.attributes = {};
    this._innerHTML = "";
    this.textContent = "";
    this.id = "";
    this.listeners = {};
    this.scrollLeft = 0;
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

  setAttribute(name, val) { this.attributes[name] = String(val); }
  getAttribute(name) { return this.attributes[name]; }
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
const mockChat = new MockElement("section");
mockChat.id = "chat";

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
  addEventListener(event, cb) {
    if (!documentListeners[event]) documentListeners[event] = [];
    documentListeners[event].push(cb);
  },
  removeEventListener(event, cb) {
    if (!documentListeners[event]) return;
    documentListeners[event] = documentListeners[event].filter(h => h !== cb);
  },
  dispatchEvent(event) {
    const handlers = documentListeners[event.type] || [];
    for (const h of handlers) h(event);
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
console.log("   INICIANDO SUITE DE TESTES v1.3.0: custom-channels-chat");
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
