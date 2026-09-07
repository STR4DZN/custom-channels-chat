/**
 * custom-channels-chat | main.js
 * Ponto de entrada do módulo Custom Channels Chat para Foundry VTT v13
 */

import { ChannelManager } from "./channel-manager.js";
import { ImageHandler } from "./image-handler.js";

const MODULE_ID = "custom-channels-chat";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando Custom Channels Chat...`);

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
        ChannelManager.renderBar(ui.chat, ui.chat.element);
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
  console.log(`${MODULE_ID} | Módulo pronto para uso no Foundry VTT v13.`);
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

    messageDoc.updateSource({
      "flags.custom-channels-chat.channel": existingChannel || activeChannel,
      // Força o nome do Usuário para conversas estilo Discord
      "speaker.alias": game.user.name,
      "speaker.actor": null,
      "speaker.token": null
    });
  }
});

/**
 * Hook disparado na renderização de cada card de mensagem
 */
Hooks.on("renderChatMessage", (messageDoc, html, data) => {
  const el = html instanceof HTMLElement ? html : html[0];
  if (!el) return;

  const isRoll = messageDoc.isRoll || el.classList.contains("dice-roll");
  const channel = messageDoc.getFlag(MODULE_ID, "channel") || (isRoll ? "dados" : "geral");
  
  el.dataset.channel = channel;

  // Filtra visibilidade de acordo com o canal atualmente aberto
  const currentActive = ChannelManager.getActiveChannel();
  if (channel !== currentActive) {
    el.style.display = "none";
  } else {
    el.style.display = "";
  }

  // Aplica avatar e estilo Discord em mensagens de conversa
  ChannelManager.formatDiscordMessage(messageDoc, el);
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
