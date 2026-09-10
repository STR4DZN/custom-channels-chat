/**
 * custom-channels-chat | main.js
 * Ponto de entrada do módulo para Foundry VTT v13 e v12
 * Foco exclusivo em envio e visualização de imagens/GIFs (Upload, URL, Ctrl+V, Drag&Drop e Lightbox)
 */

import { ImageHandler } from "./image-handler.js";

const MODULE_ID = "custom-channels-chat";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando Chat Media & Image Viewer v2.0.0...`);

  // Configuração: Incorporação automática de links de imagem/GIF
  game.settings.register(MODULE_ID, "autoEmbedUrls", {
    name: "CUSTOM_CHANNELS_CHAT.Settings.AutoEmbedUrls.Name",
    hint: "CUSTOM_CHANNELS_CHAT.Settings.AutoEmbedUrls.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  // Configuração: Visualizador Lightbox
  game.settings.register(MODULE_ID, "enableLightbox", {
    name: "CUSTOM_CHANNELS_CHAT.Settings.EnableLightbox.Name",
    hint: "CUSTOM_CHANNELS_CHAT.Settings.EnableLightbox.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  // Configuração: Altura máxima das imagens no chat
  game.settings.register(MODULE_ID, "maxImageHeight", {
    name: "CUSTOM_CHANNELS_CHAT.Settings.MaxImageHeight.Name",
    hint: "CUSTOM_CHANNELS_CHAT.Settings.MaxImageHeight.Hint",
    scope: "client",
    config: true,
    type: Number,
    default: 300,
    range: {
      min: 150,
      max: 600,
      step: 25
    }
  });
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Módulo de Mídia e Visualizador pronto para uso no Foundry VTT.`);

  // Garante que o elemento #chat não tenha estilos inline bloqueando a renderização nativa
  const chatEl = document.getElementById("chat");
  if (chatEl?.style?.display) {
    chatEl.style.removeProperty("display");
  }
  if (chatEl?.hasAttribute?.("hidden") && chatEl?.classList?.contains("active")) {
    chatEl.removeAttribute("hidden");
  }

  // Se houver style tag antiga de filtro de canal residual, remove
  const oldFilter = document.getElementById("custom-channels-filter-style");
  if (oldFilter) oldFilter.remove();
  const oldBar = document.querySelector(".custom-channels-bar");
  if (oldBar) oldBar.remove();
});

/**
 * Sincroniza a barra de ferramentas de mídia e remove bloqueios visuais residuais
 * @param {string|null} [activeTabName]
 */
export function syncChatVisibility(activeTabName = null) {
  if (typeof document === "undefined") return;
  const chatEl = document.getElementById("chat");
  if (!chatEl) return;

  if (chatEl.style?.display) {
    chatEl.style.removeProperty("display");
  }

  const isPopout = chatEl.closest?.("#chat-popout") || chatEl.closest?.(".chat-popout") || chatEl.id === "chat-popout";
  if (isPopout) return;

  const isChat = activeTabName === "chat" || (!activeTabName && (chatEl.classList?.contains("active") || globalThis.ui?.sidebar?.activeTab === "chat"));
  if (isChat) {
    if (!chatEl.querySelector(".custom-chat-media-toolbar")) {
      ImageHandler.initInput(globalThis.ui?.chat, chatEl);
    }
  }
}

/**
 * Hook disparado na renderização do painel do ChatLog
 */
Hooks.on("renderChatLog", (app, html, data) => {
  const el = html instanceof HTMLElement ? html : (html && html[0] ? html[0] : document.getElementById("chat"));
  if (el?.style?.display) {
    el.style.removeProperty("display");
  }
  ImageHandler.initInput(app, html);
});

/**
 * Garante que a toolbar esteja presente ao alternar abas da sidebar
 */
Hooks.on("changeSidebarTab", (app) => {
  const tabName = app?.tabName || (app && app[0]?.dataset?.tab) || (typeof app === "string" ? app : null) || app?.id;
  syncChatVisibility(tabName);
});

/**
 * Garante re-renderização ao expandir a barra lateral
 */
Hooks.on("collapseSidebar", (sidebar, collapsed) => {
  const chatEl = document.getElementById("chat");
  if (chatEl?.style?.display) {
    chatEl.style.removeProperty("display");
  }
  if (!collapsed) {
    syncChatVisibility();
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
 * Incorpora URLs de imagem ou GIF automaticamente quando habilitado
 */
Hooks.on("preCreateChatMessage", (messageDoc, createData, options, userId) => {
  const autoEmbed = game.settings?.get(MODULE_ID, "autoEmbedUrls") ?? true;
  if (!autoEmbed) return;

  // Não altera mensagens que sejam rolagens de dados
  const isRoll = (messageDoc.rolls && messageDoc.rolls.length > 0)
    || (createData?.rolls && createData.rolls.length > 0)
    || !!createData?.roll
    || messageDoc.type === 5 /* CONST.CHAT_MESSAGE_TYPES.ROLL */;
  if (isRoll) return;

  const rawContent = messageDoc.content || createData?.content || "";
  if (!rawContent || typeof rawContent !== "string") return;

  const processedContent = ImageHandler.processMessageContent(rawContent);
  if (processedContent && processedContent !== rawContent) {
    const updates = {
      content: processedContent,
      [`flags.${MODULE_ID}.isImage`]: true,
      flags: {
        [MODULE_ID]: {
          isImage: true
        }
      }
    };

    if (typeof messageDoc.updateSource === "function") {
      try {
        messageDoc.updateSource(updates);
      } catch (err) {
        console.warn(`${MODULE_ID} | preCreateChatMessage updateSource erro:`, err);
      }
    }

    if (createData && typeof createData === "object") {
      createData.content = processedContent;
      createData.flags = createData.flags || {};
      createData.flags[MODULE_ID] = createData.flags[MODULE_ID] || {};
      createData.flags[MODULE_ID].isImage = true;
    }
  }
});

/**
 * Função utilitária para renderização e formatação de cards de mensagem
 */
function handleChatMessageRender(messageDoc, html) {
  try {
    const el = html instanceof HTMLElement ? html : (html && html[0] ? html[0] : null);
    if (!el) return;

    if (el.style?.display === "none") {
      el.style.removeProperty("display");
    }

    // Formata imagens enviadas ou incorporadas
    ImageHandler.formatDomMessage(messageDoc, el);
  } catch (err) {
    console.warn(`${MODULE_ID} | handleChatMessageRender erro:`, err);
  }
}

/**
 * Hook para Foundry v12 e versões anteriores
 */
Hooks.on("renderChatMessage", (messageDoc, html, data) => {
  handleChatMessageRender(messageDoc, html);
});

/**
 * Hook oficial do Foundry VTT v13 (ApplicationV2)
 */
Hooks.on("renderChatMessageHTML", (messageDoc, html, context) => {
  handleChatMessageRender(messageDoc, html);
});

/**
 * Hook disparado quando uma nova mensagem é criada em tempo real
 */
Hooks.on("createChatMessage", (messageDoc, options, userId) => {
  const messageId = messageDoc.id || messageDoc._id;
  if (messageId) {
    const el = document.querySelector ? document.querySelector(`li.chat-message[data-message-id="${messageId}"], [data-message-id="${messageId}"]`) : null;
    if (el) {
      ImageHandler.formatDomMessage(messageDoc, el);
    }
  }

  // Rola o chat para o final
  if (ui.chat && typeof ui.chat.scrollBottom === "function") {
    ui.chat.scrollBottom();
  }
});

/**
 * Hook disparado quando uma mensagem é atualizada
 */
Hooks.on("updateChatMessage", (messageDoc, changes, options, userId) => {
  const messageId = messageDoc.id || messageDoc._id;
  if (messageId) {
    const el = document.querySelector ? document.querySelector(`li.chat-message[data-message-id="${messageId}"], [data-message-id="${messageId}"]`) : null;
    if (el) {
      ImageHandler.formatDomMessage(messageDoc, el);
    }
  }
});
