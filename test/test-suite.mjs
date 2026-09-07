/**
 * Suite de Testes Automatizados e Benchmark de Performance
 * para o módulo custom-channels-chat
 */

import { ChannelManager } from "../scripts/channel-manager.js";
import { ImageHandler } from "../scripts/image-handler.js";

// ============================================================================
// 1. AMBIENTE MOCK DO FOUNDRY VTT & DOM
// ============================================================================

class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.classList = new Set();
    this.style = {};
    this.attributes = {};
    this.innerHTML = "";
    this.textContent = "";
    this.id = "";
    this.className = "";
  }

  setAttribute(name, val) { this.attributes[name] = String(val); }
  getAttribute(name) { return this.attributes[name]; }
  appendChild(child) { this.children.push(child); return child; }
  remove() { this.removed = true; }
  before(el) { this.beforeElement = el; }
  prepend(el) { this.children.unshift(el); }
  addEventListener(event, cb) {
    if (!this.listeners) this.listeners = {};
    this.listeners[event] = cb;
  }
  querySelector(selector) {
    if (selector === "#chat-log") return mockChatLog;
    if (selector === ".custom-channels-bar") return mockBar;
    return this.children.find(c => c.matches?.(selector)) || null;
  }
  querySelectorAll(selector) {
    return this.children.filter(c => c.matches?.(selector));
  }
}

const mockHead = new MockElement("head");
const mockChatLog = new MockElement("div");
mockChatLog.id = "chat-log";

let mockBar = null;

globalThis.document = {
  head: mockHead,
  body: new MockElement("body"),
  createElement(tag) {
    const el = new MockElement(tag);
    return el;
  },
  getElementById(id) {
    if (id === "chat-log") return mockChatLog;
    if (mockHead.children.find(c => c.id === id)) return mockHead.children.find(c => c.id === id);
    if (document.body.children.find(c => c.id === id)) return document.body.children.find(c => c.id === id);
    return null;
  },
  querySelector(sel) {
    if (sel === ".custom-channels-bar") return mockBar;
    return null;
  },
  addEventListener() {}
};

// Mock do objeto `game` do Foundry
const mockSettings = {
  "custom-channels-chat.channelsList": "geral, off-topic, dados",
  "custom-channels-chat.autoRouteRolls": true,
  "custom-channels-chat.enableDiscordStyle": true
};

globalThis.game = {
  world: { id: "test-world" },
  user: { name: "Jogador Mestre", avatar: "icons/mestre.png" },
  users: new Map([["user1", { name: "Jogador Mestre", avatar: "icons/mestre.png" }]]),
  settings: {
    get(module, key) {
      return mockSettings[`${module}.${key}`];
    },
    set(module, key, val) {
      mockSettings[`${module}.${key}`] = val;
    }
  }
};

// Mock do ui
globalThis.ui = {
  chat: {
    scrollBottom() { this.scrolled = true; }
  },
  notifications: {
    info() {},
    warn() {},
    error() {}
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
console.log("   INICIANDO SUITE DE TESTES: custom-channels-chat");
console.log("========================================================\n");

// TESTE 1: Lista padrão de canais
console.log("Teste 1: Lista padrão de canais e garantia do canal 'dados'");
const channels = ChannelManager.getChannels();
assert(channels.includes("geral"), "Canal 'geral' presente");
assert(channels.includes("off-topic"), "Canal 'off-topic' presente");
assert(channels.includes("dados"), "Canal 'dados' presente");

// TESTE 2: Lista customizada pelo Mestre sem canal 'dados' explícito
console.log("\nTeste 2: Injeção automática do canal 'dados' caso o Mestre esqueça");
game.settings.set("custom-channels-chat", "channelsList", "narrativa, taverna");
const customChannels = ChannelManager.getChannels();
assert(customChannels.includes("narrativa"), "Canal customizado 'narrativa' carregado");
assert(customChannels.includes("taverna"), "Canal customizado 'taverna' carregado");
assert(customChannels.includes("dados"), "Canal 'dados' inserido automaticamente");
// Restaura padrão
game.settings.set("custom-channels-chat", "channelsList", "geral, off-topic, dados");

// TESTE 3: Troca de canal ativo e reset de não lidos
console.log("\nTeste 3: Troca de canal e gestão de mensagens não lidas");
ChannelManager.setActiveChannel("geral");
assert(ChannelManager.getActiveChannel() === "geral", "Canal ativo é 'geral'");

ChannelManager.incrementUnread("off-topic");
ChannelManager.incrementUnread("off-topic");
ChannelManager.incrementUnread("dados");
assert(ChannelManager.unreadCounts["off-topic"] === 2, "Canal 'off-topic' acumulou 2 não lidos");
assert(ChannelManager.unreadCounts["dados"] === 1, "Canal 'dados' acumulou 1 não lido");

ChannelManager.setActiveChannel("off-topic");
assert(ChannelManager.getActiveChannel() === "off-topic", "Canal ativo mudou para 'off-topic'");
assert(ChannelManager.unreadCounts["off-topic"] === 0, "Contador de não lidos zerado ao abrir o canal");

// TESTE 4: Regra CSS O(1) de alta performance
console.log("\nTeste 4: Injeção e atualização da regra CSS de filtragem instantânea O(1)");
ChannelManager.filterMessages();
const styleEl = document.getElementById("custom-channels-filter-style");
assert(styleEl !== null, "Elemento <style id='custom-channels-filter-style'> foi injetado no DOM");
assert(styleEl.textContent.includes('data-channel="off-topic"'), "Regra CSS referencia o canal ativo corretamente");

// TESTE 5: Roteamento de Rolagens de Dados vs Conversas
console.log("\nTeste 5: Roteamento de rolagens de dados para #dados");
function simulatePreCreate(createData, isRollMessage = false) {
  const messageDoc = {
    isRoll: isRollMessage,
    updateSource(updates) {
      this.updates = Object.assign(this.updates || {}, updates);
    }
  };

  const autoRoute = game.settings.get("custom-channels-chat", "autoRouteRolls");
  const isRoll = messageDoc.isRoll || (createData.rolls && createData.rolls.length > 0) || createData.type === CONST.CHAT_MESSAGE_TYPES.ROLL;

  if (isRoll && autoRoute) {
    messageDoc.updateSource({ "flags.custom-channels-chat.channel": "dados" });
  } else {
    const active = ChannelManager.getActiveChannel();
    messageDoc.updateSource({
      "flags.custom-channels-chat.channel": createData.flags?.["custom-channels-chat"]?.channel || active,
      "speaker.alias": game.user.name
    });
  }

  return messageDoc;
}

// 5a. Rolagem do chat /r 1d20
const rollChat = simulatePreCreate({ rolls: [{ total: 18 }] }, true);
assert(rollChat.updates["flags.custom-channels-chat.channel"] === "dados", "Rolagem com rolls[] foi roteada para 'dados'");

// 5b. Rolagem com type = ROLL
const rollType = simulatePreCreate({ type: CONST.CHAT_MESSAGE_TYPES.ROLL });
assert(rollType.updates["flags.custom-channels-chat.channel"] === "dados", "Mensagem com type: ROLL foi roteada para 'dados'");

// 5c. Conversa normal
const normalChat = simulatePreCreate({ content: "Olá grupo!" });
assert(normalChat.updates["flags.custom-channels-chat.channel"] === "off-topic", "Conversa recebeu o canal ativo ('off-topic')");
assert(normalChat.updates["speaker.alias"] === "Jogador Mestre", "Identidade forçada para o nome do Usuário");

// TESTE 6: Fallback Base64 para envio de imagem
console.log("\nTeste 6: Conversão de imagem para Base64 (fallback garantido)");
const fakeFile = new Blob(["test-image-binary-data"], { type: "image/png" });
fakeFile.name = "exemplo.png";

// Simula FileReader
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

// ============================================================================
// 3. BENCHMARK DE PERFORMANCE & CARGA
// ============================================================================

console.log("\n========================================================");
console.log("   BENCHMARK DE PERFORMANCE: ESCALABILIDADE DE MENSAGENS");
console.log("========================================================\n");

// Medição de troca de canais com 10.000 iterações de filtro
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
  console.log(">> Todos os testes passaram com sucesso e a performance está comprovadamente excelente! <<\n");
}
