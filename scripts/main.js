/**
 * custom-channels-chat | main.js
 * Ponto de entrada do módulo Custom Channels Chat para Foundry VTT v13 e v12
 */

import { ChannelManager } from "./channel-manager.js";
import { ImageHandler } from "./image-handler.js";

const MODULE_ID = "custom-channels-chat";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando Custom Channels Chat v1.2.0...`);

  // Configuração: Lista de canais
  game.settings.register(MODULE_ID, "channelsList", {
    name: "Canais do Chat",
    hint: "Lista de canais separados por vírgula. O canal 'dados' é reservado automaticamente para rolagens.",
    scope: "world",
    config: true,
    type: String,
    default: "geral, off-topic, dados",
    onChange: () => {
      if (ui.chat?.rendered) {
        ChannelManager.renderBar(ui.chat, ui.chat.element || document.getElementById("chat"));
      }
    }
  });

  // Configuração: Roteamento automático de rolagens
  game.settings.register(MODULE_ID, "autoRouteRolls", {
    name: "Roteamento Automático de Rolagens",
    hint: "Envia automaticamente todas as rolagens de dados (fichas, macros e chat) para a aba #dados.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // Configuração: Estilo visual Discord
  game.settings.register(MODULE_ID, "enableDiscordStyle", {
    name: "Estilo Visual Discord",
    hint: "Aplica avatar do usuário e layout limpo nas mensagens de conversa.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Módulo pronto para uso no Foundry VTT.`);

  // Configuração do socket para sincronização de novos canais criados por jogadores
  if (game.socket) {
    game.socket.on(`module.${MODULE_ID}`, async (data) => {
      if (!game.user?.isGM) return;

      // Se houver múltiplos GMs conectados, apenas o primeiro ativo executa a alteração
      const activeGMs = game.users ? Array.from(game.users.values()).filter(u => u.isGM && u.active) : [];
      const isPrimaryGM = activeGMs.length > 0 ? activeGMs[0].id === game.user.id : true;
      if (!isPrimaryGM) return;

      if (data?.action === "createChannel" && data.channelName) {
        const cleanName = String(data.channelName).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "");
        if (!cleanName) return;

        const currentChannels = ChannelManager.getChannels();
        if (!currentChannels.includes(cleanName)) {
          currentChannels.push(cleanName);
          await game.settings.set(MODULE_ID, "channelsList", currentChannels.join(", "));
          ui.notifications?.info?.(`Jogador solicitou e o canal #${cleanName} foi criado.`);
        }
      }
    });
  }
});

/**
 * Hook disparado na renderização do painel do ChatLog
 */
Hooks.on("renderChatLog", (app, html, data) => {
  ChannelManager.renderBar(app, html);
  ImageHandler.initInput(app, html);
});

/**
 * Hook disparado antes de qualquer mensagem ser gravada no banco
 */
Hooks.on("preCreateChatMessage", (messageDoc, createData, options, userId) => {
  const autoRoute = game.settings.get(MODULE_ID, "autoRouteRolls");
  const isRoll = messageDoc.isRoll || (createData.rolls && createData.rolls.length > 0) || createData.type === CONST.CHAT_MESSAGE_TYPES?.ROLL;

  if (isRoll && autoRoute) {
    // Rolagens vão sempre para o canal de dados
    messageDoc.updateSource({
      "flags.custom-channels-chat.channel": "dados"
    });
  } else {
    // Mensagens normais recebem o canal ativo no cliente do autor
    const activeChannel = ChannelManager.getActiveChannel();
    const existingChannel = createData.flags?.[MODULE_ID]?.channel;
    const channelToSet = existingChannel || activeChannel;

    // Detecta e embuti URLs diretas de imagens/GIFs (Tenor, Giphy, direct links) no conteúdo
    const rawContent = messageDoc.content || createData.content || "";
    const processedContent = ImageHandler.processMessageContent(rawContent);

    const updates = {
      "flags.custom-channels-chat.channel": channelToSet
    };

    if (processedContent !== rawContent) {
      updates.content = processedContent;
      createData.content = processedContent;
      updates["flags.custom-channels-chat.isImage"] = true;
    }

    messageDoc.updateSource(updates);
  }
});

/**
 * Função utilitária para aplicar o tratamento do card da mensagem
 */
function handleChatMessageRender(messageDoc, html) {
  const el = html instanceof HTMLElement ? html : (html && html[0] ? html[0] : null);
  if (!el) return;

  const isRoll = messageDoc.isRoll || el.classList.contains("dice-roll") || el.querySelector?.(".dice-roll") !== null;
  const channel = messageDoc.getFlag(MODULE_ID, "channel") || (isRoll ? "dados" : "geral");
  
  // Atributo data-channel para filtragem CSS O(1) e classe auxiliar
  el.dataset.channel = channel;
  const active = ChannelManager.getActiveChannel();
  el.classList.toggle("custom-channel-hidden", channel !== active);

  // Aplica estilo Discord e imagem caso necessário
  ChannelManager.formatDiscordMessage(messageDoc, el);
  ImageHandler.formatDomMessage(messageDoc, el);
}

/**
 * Hook legado para Foundry v12 e versões anteriores
 */
Hooks.on("renderChatMessage", (messageDoc, html, data) => {
  handleChatMessageRender(messageDoc, html);
});

/**
 * Novo hook oficial do Foundry VTT v13 (ApplicationV2)
 */
Hooks.on("renderChatMessageHTML", (messageDoc, html, context) => {
  handleChatMessageRender(messageDoc, html);
});

/**
 * Hook disparado quando uma nova mensagem é criada em tempo real
 */
Hooks.on("createChatMessage", (messageDoc, options, userId) => {
  const isRoll = messageDoc.isRoll;
  const channel = messageDoc.getFlag(MODULE_ID, "channel") || (isRoll ? "dados" : "geral");
  const activeChannel = ChannelManager.getActiveChannel();

  if (channel !== activeChannel) {
    ChannelManager.incrementUnread(channel);
  } else {
    if (ui.chat && typeof ui.chat.scrollBottom === "function") {
      ui.chat.scrollBottom();
    }
  }
});
