/**
 * custom-channels-chat | main.js
 * Ponto de entrada do módulo Custom Channels Chat para Foundry VTT v13 e v12
 */

import { ChannelManager } from "./channel-manager.js";
import { ImageHandler } from "./image-handler.js";

const MODULE_ID = "custom-channels-chat";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando Custom Channels Chat v1.4.0...`);

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
 * Garante que a barra e a toolbar estejam ativas ao trocar para a aba do chat
 */
Hooks.on("changeSidebarTab", (app) => {
  const tabName = app?.tabName || (app && app[0]?.dataset?.tab) || (typeof app === "string" ? app : null);
  const chatEl = document.getElementById("chat");
  const isChatTab = tabName === "chat" || (!tabName && chatEl?.classList?.contains("active"));

  if (isChatTab && chatEl) {
    if (chatEl.scrollTop > 0) chatEl.scrollTop = 0;
    if (chatEl.scrollLeft > 0) chatEl.scrollLeft = 0;
    if (!chatEl.querySelector(".custom-channels-bar")) {
      ChannelManager.renderBar(ui.chat, chatEl);
    } else {
      ChannelManager.updateBarUI();
    }
    if (!chatEl.querySelector(".custom-chat-media-toolbar")) {
      ImageHandler.initInput(ui.chat, chatEl);
    }
  }
});

/**
 * Garante re-renderização ao expandir a barra lateral
 */
Hooks.on("collapseSidebar", (sidebar, collapsed) => {
  if (!collapsed) {
    const chatEl = document.getElementById("chat");
    if (chatEl) {
      if (chatEl.scrollTop > 0) chatEl.scrollTop = 0;
      if (!chatEl.querySelector(".custom-channels-bar")) {
        ChannelManager.renderBar(ui.chat, chatEl);
      } else {
        ChannelManager.updateBarUI();
      }
    }
  }
});

/**
 * Garante que qualquer ImagePopout nativo do Foundry VTT seja centralizado e contido no viewport
 */
Hooks.on("renderImagePopout", (app, html, data) => {
  const el = html instanceof HTMLElement ? html : (html && html[0] ? html[0] : app?.element?.[0] || app?.element);
  if (!el) return;

  try {
    const maxWidth = Math.floor(window.innerWidth * 0.9);
    const maxHeight = Math.floor(window.innerHeight * 0.9);
    if (app?.position) {
      const currentW = app.position.width || el.offsetWidth || 400;
      const currentH = app.position.height || el.offsetHeight || 300;
      const newW = Math.min(currentW, maxWidth);
      const newH = Math.min(currentH, maxHeight);
      app.setPosition({
        width: newW,
        height: newH,
        left: Math.max(10, Math.floor((window.innerWidth - newW) / 2)),
        top: Math.max(10, Math.floor((window.innerHeight - newH) / 2))
      });
    }
  } catch (e) {}
});

/**
 * Hook disparado antes de qualquer mensagem ser gravada no banco
 */
Hooks.on("preCreateChatMessage", (messageDoc, createData, options, userId) => {
  const autoRoute = game.settings?.get(MODULE_ID, "autoRouteRolls") ?? true;
  const isDiceOrDamage = ChannelManager.isDiceOrDamage(messageDoc, createData);

  if (isDiceOrDamage && autoRoute) {
    // Rolagens e cards de dano vão sempre para o canal de dados
    if (typeof messageDoc.updateSource === "function") {
      messageDoc.updateSource({
        [`flags.${MODULE_ID}.channel`]: "dados"
      });
    }
    if (createData) {
      createData.flags = createData.flags || {};
      createData.flags[MODULE_ID] = createData.flags[MODULE_ID] || {};
      createData.flags[MODULE_ID].channel = "dados";
      createData[`flags.${MODULE_ID}.channel`] = "dados";
    }
    if (messageDoc.flags) {
      messageDoc.flags[MODULE_ID] = messageDoc.flags[MODULE_ID] || {};
      messageDoc.flags[MODULE_ID].channel = "dados";
    }
  } else {
    // Mensagens normais recebem o canal ativo no cliente do autor
    const activeChannel = ChannelManager.getActiveChannel();
    const existingChannel = (createData?.flags?.[MODULE_ID]?.channel) || (createData?.[`flags.${MODULE_ID}.channel`]);
    const channelToSet = existingChannel || activeChannel;

    // Detecta e embuti URLs diretas de imagens/GIFs (Tenor, Giphy, direct links) no conteúdo
    const rawContent = messageDoc.content || createData?.content || "";
    const processedContent = ImageHandler.processMessageContent(rawContent);

    const updates = {
      [`flags.${MODULE_ID}.channel`]: channelToSet
    };

    if (processedContent !== rawContent) {
      updates.content = processedContent;
      if (createData) createData.content = processedContent;
      updates[`flags.${MODULE_ID}.isImage`] = true;
    }

    if (typeof messageDoc.updateSource === "function") {
      messageDoc.updateSource(updates);
    }
    if (createData) {
      createData.flags = createData.flags || {};
      createData.flags[MODULE_ID] = createData.flags[MODULE_ID] || {};
      createData.flags[MODULE_ID].channel = channelToSet;
    }
  }
});

/**
 * Hook disparado antes de qualquer mensagem ser atualizada (ex: automação adicionando dano/rolagens ao card)
 */
Hooks.on("preUpdateChatMessage", (messageDoc, changes, options, userId) => {
  const autoRoute = game.settings?.get(MODULE_ID, "autoRouteRolls") ?? true;
  if (!autoRoute) return;

  // Se a atualização contiver rolagem ou card de dano (ex: Midi-QOL, PF2e, D&D 5e, Tormenta20)
  if (ChannelManager.isDiceOrDamage(messageDoc, changes)) {
    const currentChannel = (typeof messageDoc?.getFlag === "function" ? messageDoc.getFlag(MODULE_ID, "channel") : null)
      || messageDoc?.flags?.[MODULE_ID]?.channel
      || changes?.flags?.[MODULE_ID]?.channel
      || changes?.[`flags.${MODULE_ID}.channel`];

    if (currentChannel !== "dados") {
      changes.flags = changes.flags || {};
      changes.flags[MODULE_ID] = changes.flags[MODULE_ID] || {};
      changes.flags[MODULE_ID].channel = "dados";
      changes[`flags.${MODULE_ID}.channel`] = "dados";
      if (typeof messageDoc.updateSource === "function") {
        messageDoc.updateSource({
          [`flags.${MODULE_ID}.channel`]: "dados"
        });
      }
      if (messageDoc.flags) {
        messageDoc.flags[MODULE_ID] = messageDoc.flags[MODULE_ID] || {};
        messageDoc.flags[MODULE_ID].channel = "dados";
      }
    }
  }
});

/**
 * Função utilitária para aplicar o tratamento do card da mensagem
 */
function handleChatMessageRender(messageDoc, html) {
  const el = html instanceof HTMLElement ? html : (html && html[0] ? html[0] : null);
  if (!el) return;

  const autoRoute = game.settings?.get(MODULE_ID, "autoRouteRolls") ?? true;
  const isDiceOrDamage = ChannelManager.isDiceOrDamage(messageDoc, messageDoc?._source || {}, el);

  let channel;
  if (autoRoute && isDiceOrDamage) {
    // Para qualquer tipo de dado ou dano, força estritamente o canal 'dados'
    channel = "dados";
  } else {
    channel = (typeof messageDoc?.getFlag === "function" ? messageDoc.getFlag(MODULE_ID, "channel") : null)
      || messageDoc?.flags?.[MODULE_ID]?.channel
      || (isDiceOrDamage ? "dados" : "geral");
  }
  
  // Atributo data-channel para filtragem CSS O(1) e classe auxiliar
  el.dataset.channel = channel;
  const active = ChannelManager.getActiveChannel();
  el.classList.toggle("custom-channel-hidden", channel !== active);

  // Aplica estilo Discord e imagem apenas para mensagens normais de bate-papo
  if (!isDiceOrDamage) {
    ChannelManager.formatDiscordMessage(messageDoc, el);
    ImageHandler.formatDomMessage(messageDoc, el);
  } else {
    // Garante que nenhum elemento de avatar Discord permaneça em card de rolagem/dano
    const discordAvatar = el.querySelector(".discord-avatar-wrap");
    if (discordAvatar) discordAvatar.remove();
    el.classList.remove("discord-styled-message");
  }
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
  const autoRoute = game.settings?.get(MODULE_ID, "autoRouteRolls") ?? true;
  const isDiceOrDamage = ChannelManager.isDiceOrDamage(messageDoc, messageDoc?._source || {});
  const channel = (autoRoute && isDiceOrDamage) 
    ? "dados" 
    : ((typeof messageDoc?.getFlag === "function" ? messageDoc.getFlag(MODULE_ID, "channel") : null) || messageDoc?.flags?.[MODULE_ID]?.channel || (isDiceOrDamage ? "dados" : "geral"));
  const activeChannel = ChannelManager.getActiveChannel();

  if (channel !== activeChannel) {
    ChannelManager.incrementUnread(channel);
  } else {
    if (ui.chat && typeof ui.chat.scrollBottom === "function") {
      ui.chat.scrollBottom();
    }
  }
});

/**
 * Hook disparado quando uma mensagem é atualizada em tempo real (ex: card que recebeu dano)
 */
Hooks.on("updateChatMessage", (messageDoc, changes, options, userId) => {
  const autoRoute = game.settings?.get(MODULE_ID, "autoRouteRolls") ?? true;
  const isDiceOrDamage = ChannelManager.isDiceOrDamage(messageDoc, changes);
  const channel = (autoRoute && isDiceOrDamage) 
    ? "dados" 
    : ((typeof messageDoc?.getFlag === "function" ? messageDoc.getFlag(MODULE_ID, "channel") : null) || messageDoc?.flags?.[MODULE_ID]?.channel || (isDiceOrDamage ? "dados" : "geral"));
  const activeChannel = ChannelManager.getActiveChannel();

  // Localiza e sincroniza o elemento DOM da mensagem se já estiver renderizado no chat
  const messageId = messageDoc.id || messageDoc._id;
  if (messageId) {
    const el = document.querySelector ? (document.querySelector(`[data-message-id="${messageId}"], li[data-message-id="${messageId}"]`)) : null;
    if (el) {
      el.dataset.channel = channel;
      el.classList.toggle("custom-channel-hidden", channel !== activeChannel);
      if (isDiceOrDamage) {
        const discordAvatar = el.querySelector(".discord-avatar-wrap");
        if (discordAvatar) discordAvatar.remove();
        el.classList.remove("discord-styled-message");
      }
    }
  }

  if (channel !== activeChannel && isDiceOrDamage) {
    ChannelManager.incrementUnread(channel);
  } else if (channel === activeChannel) {
    if (ui.chat && typeof ui.chat.scrollBottom === "function") {
      ui.chat.scrollBottom();
    }
  }
});
