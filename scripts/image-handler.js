/**
 * custom-channels-chat | image-handler.js
 * Tratamento avançado de imagens e GIFs (Upload, Ctrl+V, Drag&Drop, URLs de Tenor/Giphy, Lightbox)
 * para Foundry VTT v13 e v12
 */

import { ChannelManager } from "./channel-manager.js";

export class ImageHandler {
  static MODULE_ID = "custom-channels-chat";

  /**
   * Expressão regular para identificar URLs diretas de imagem ou plataformas suportadas (Tenor, Giphy, Imgur, Discord)
   */
  static MEDIA_URL_REGEX = /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|svg|bmp|avif)(?:\?[^\s<>"']*)?|https?:\/\/(?:www\.)?tenor\.com\/view\/[^\s<>"']+|https?:\/\/(?:media|c)\.tenor\.com\/[^\s<>"']+|https?:\/\/(?:www\.)?giphy\.com\/gifs\/[^\s<>"']+|https?:\/\/(?:media|i)\.giphy\.com\/media\/[^\s<>"']+|https?:\/\/(?:i\.)?imgur\.com\/[^\s<>"']+|https?:\/\/cdn\.discordapp\.com\/attachments\/[^\s<>"']+|https?:\/\/images-ext-\d+\.discordapp\.net\/external\/[^\s<>"']+/i;

  /**
   * Inicializa os listeners e a barra de ações de mídia no ChatLog
   * @param {Application} app
   * @param {HTMLElement|jQuery} html
   */
  static initInput(app, html) {
    const root = html instanceof HTMLElement ? html : (html && html[0] ? html[0] : document.getElementById("chat"));
    if (!root) return;

    const textarea = root.querySelector("#chat-message") || root.querySelector('textarea[name="content"]') || root.querySelector("textarea");
    const chatControls = root.querySelector("#chat-controls") || root.querySelector(".chat-controls");
    const chatForm = root.querySelector("#chat-form") || root.querySelector(".chat-form") || textarea?.closest("form");

    // 1. Injeta a barra de ferramentas de mídia logo acima da caixa de mensagem
    this.injectMediaToolbar(root, chatControls, chatForm, textarea);

    // 2. Captura evento de Colar (Ctrl + V) na caixa de texto, no chat e globalmente
    this.setupPasteHandler(root, textarea);

    // 3. Captura evento de Arrastar e Soltar (Drag & Drop) de imagens
    this.setupDragDropHandler(root, textarea);

    // 4. Listener global de clique em imagens para Lightbox (ImagePopout)
    this.setupLightboxListener();
  }

  /**
   * Injeta a barra visível de envio de Imagens e GIFs
   */
  static injectMediaToolbar(root, chatControls, chatForm, textarea) {
    // Evita duplicações
    const existing = root.querySelector ? root.querySelector(".custom-chat-media-toolbar") : document.querySelector(".custom-chat-media-toolbar");
    if (existing) return;

    const toolbar = document.createElement("div");
    toolbar.className = "custom-chat-media-toolbar";
    toolbar.setAttribute("aria-label", "Opções de Mídia do Chat");

    // Botão 1: Anexar Imagem do Computador
    const attachBtn = document.createElement("button");
    attachBtn.type = "button";
    attachBtn.className = "custom-chat-btn custom-chat-attach-btn";
    attachBtn.title = "Anexar imagem do computador (ou cole com Ctrl+V)";
    attachBtn.innerHTML = '<i class="fas fa-image"></i> <span>Imagem</span>';

    // Input de arquivo invisível
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";

    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        await this.processAndSendImage(file);
        fileInput.value = "";
      }
    });

    attachBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileInput.click();
    });

    // Botão 2: Enviar GIF ou URL de Imagem
    const gifBtn = document.createElement("button");
    gifBtn.type = "button";
    gifBtn.className = "custom-chat-btn custom-chat-gif-btn";
    gifBtn.title = "Enviar GIF ou Link de Imagem (Tenor, Giphy, web)";
    gifBtn.innerHTML = '<i class="fas fa-film"></i> <span>GIF / URL</span>';

    gifBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showImageGifModal();
    });

    toolbar.appendChild(attachBtn);
    toolbar.appendChild(gifBtn);
    toolbar.appendChild(fileInput);

    // Posiciona a toolbar prioritariamente logo acima da caixa de texto
    if (textarea) {
      textarea.before(toolbar);
    } else if (chatForm) {
      chatForm.prepend(toolbar);
    } else if (chatControls) {
      chatControls.after(toolbar);
    } else if (root.appendChild) {
      root.appendChild(toolbar);
    }
  }

  /**
   * Configura o listener de Ctrl+V (Paste) para imagens da área de transferência
   */
  static setupPasteHandler(root, textarea) {
    const handlePaste = async (event) => {
      const clipboard = event.clipboardData || window.clipboardData;
      if (!clipboard) return;

      // Extrai arquivo de imagem da área de transferência
      let imageFile = null;
      if (clipboard.files && clipboard.files.length > 0) {
        for (const file of clipboard.files) {
          if (file.type && file.type.startsWith("image/")) {
            imageFile = file;
            break;
          }
        }
      }

      if (!imageFile && clipboard.items && clipboard.items.length > 0) {
        for (const item of clipboard.items) {
          if (item.type && item.type.startsWith("image/")) {
            imageFile = item.getAsFile();
            if (imageFile) break;
          }
        }
      }

      if (imageFile) {
        event.preventDefault();
        event.stopPropagation();
        await this.processAndSendImage(imageFile);
        return;
      }
    };

    const targets = [textarea, root].filter(Boolean);
    targets.forEach(target => {
      if (target.dataset?.customPasteAttached) return;
      if (target.dataset) target.dataset.customPasteAttached = "true";
      target.addEventListener("paste", handlePaste);
    });

    // Handler global no document para garantir Ctrl+V quando a aba do chat estiver ativa
    if (typeof document !== "undefined" && !document.body?.dataset?.customGlobalPasteAttached) {
      if (document.body?.dataset) document.body.dataset.customGlobalPasteAttached = "true";
      document.addEventListener("paste", async (event) => {
        const chatElement = document.getElementById("chat");
        const isChatActive = chatElement && (chatElement.classList.contains("active") || chatElement.offsetParent !== null);
        if (!isChatActive) return;

        // Se o evento foi no textarea ou alvos diretos, o listener local já executa
        if (event.target === textarea || targets.includes(event.target)) return;

        const clipboard = event.clipboardData || window.clipboardData;
        if (!clipboard) return;

        let imageFile = null;
        if (clipboard.files && clipboard.files.length > 0) {
          for (const f of clipboard.files) {
            if (f.type && f.type.startsWith("image/")) {
              imageFile = f;
              break;
            }
          }
        }
        if (!imageFile && clipboard.items) {
          for (const it of clipboard.items) {
            if (it.type && it.type.startsWith("image/")) {
              imageFile = it.getAsFile();
              if (imageFile) break;
            }
          }
        }

        if (imageFile) {
          event.preventDefault();
          event.stopPropagation();
          await this.processAndSendImage(imageFile);
        }
      });
    }
  }

  /**
   * Configura Drag & Drop para arrastar imagens para o chat
   */
  static setupDragDropHandler(root, textarea) {
    const dropArea = textarea || root;
    if (!dropArea || dropArea.dataset.customDropAttached) return;
    dropArea.dataset.customDropAttached = "true";

    dropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropArea.classList.add("custom-chat-dragover");
    });

    dropArea.addEventListener("dragleave", () => {
      dropArea.classList.remove("custom-chat-dragover");
    });

    dropArea.addEventListener("drop", async (e) => {
      e.preventDefault();
      dropArea.classList.remove("custom-chat-dragover");

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        for (const file of files) {
          if (file.type && file.type.startsWith("image/")) {
            await this.processAndSendImage(file);
            break;
          }
        }
      }
    });
  }

  /**
   * Abre o visualizador moderno e responsivo (Lightbox) perfeitamente adaptado ao viewport
   * @param {string} src - URL ou base64 da imagem
   * @param {string} [altText]
   */
  static openLightbox(src, altText = "Visualização de Imagem") {
    if (!src) return null;

    // Remove visualizador anterior se existente para evitar sobreposição
    const existing = document.querySelector(".custom-image-lightbox-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "custom-image-lightbox-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Visualizador de Imagem");

    overlay.innerHTML = `
      <div class="custom-image-lightbox-backdrop"></div>
      <div class="custom-image-lightbox-content">
        <div class="custom-image-lightbox-toolbar">
          <a href="#" target="_blank" rel="noopener noreferrer" class="custom-lightbox-btn custom-lightbox-open-ext" title="Abrir imagem original em nova aba">
            <i class="fas fa-external-link-alt"></i> <span>Abrir Original</span>
          </a>
          <button type="button" class="custom-lightbox-btn custom-lightbox-close" title="Fechar (Esc)" aria-label="Fechar">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="custom-image-lightbox-img-wrap">
          <img class="custom-lightbox-image" />
        </div>
      </div>
    `;

    const imgEl = overlay.querySelector(".custom-lightbox-image");
    if (imgEl) {
      imgEl.src = src;
      imgEl.alt = String(altText || "Visualização de Imagem");
    }

    const openExtBtn = overlay.querySelector(".custom-lightbox-open-ext");
    if (openExtBtn) {
      openExtBtn.href = src;
      openExtBtn.addEventListener("click", (e) => {
        if (src.startsWith("data:")) {
          e.preventDefault();
          e.stopPropagation();
          const w = window.open("");
          if (w) {
            w.document.write(`
              <!DOCTYPE html>
              <html>
                <head><title>Visualização de Imagem</title><style>body{margin:0;background:#0e1015;display:flex;align-items:center;justify-content:center;height:100vh;}img{max-width:100%;max-height:100%;object-fit:contain;}</style></head>
                <body><img src="${src}" alt="Imagem Original" /></body>
              </html>
            `);
            w.document.close();
          }
        }
      });
    }

    let closed = false;
    const closeLightbox = () => {
      if (closed) return;
      closed = true;
      overlay.classList.remove("active");
      document.removeEventListener("keydown", handleKeydown);
      if (document.body?.classList) {
        document.body.classList.remove("custom-lightbox-open");
      }
      setTimeout(() => {
        if (overlay.parentElement) overlay.remove();
      }, 200);
    };

    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      }
    };

    // Fechar ao clicar no botão 'X'
    const closeBtn = overlay.querySelector(".custom-lightbox-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeLightbox();
      });
    }

    // Fechar ao clicar no fundo (fora da imagem e dos botões)
    overlay.addEventListener("click", (e) => {
      const isBtn = e.target.closest?.(".custom-lightbox-btn");
      const isImg = e.target.closest?.(".custom-lightbox-image");
      if (!isBtn && !isImg) {
        e.preventDefault();
        e.stopPropagation();
        closeLightbox();
      }
    });

    document.addEventListener("keydown", handleKeydown);
    if (document.body?.classList) {
      document.body.classList.add("custom-lightbox-open");
    }
    document.body.appendChild(overlay);

    // Animação de entrada suave
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => overlay.classList.add("active"));
    } else {
      overlay.classList.add("active");
    }

    return overlay;
  }

  /**
   * Configura o listener de clique global para visualização ampliada (Lightbox)
   */
  static setupLightboxListener() {
    if (document.body?.dataset?.customImgLightboxAttached) return;
    if (document.body?.dataset) document.body.dataset.customImgLightboxAttached = "true";

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!target) return;

      // Ignora elementos de controle ou avatar
      if (target.closest?.(".discord-avatar-wrap, .avatar, .dice-roll, .dice-icon, .message-header, button, a")) {
        return;
      }

      // Detecta imagem de chat do módulo ou qualquer imagem dentro do corpo da mensagem
      const isCustomChatImg = target.classList?.contains("discord-chat-img") || target.closest?.(".discord-image-container img");
      const isChatContentImg = target.tagName === "IMG" && target.closest?.("#chat-log, .chat-log, #chat, #chat-popout");

      const img = isCustomChatImg ? (target.tagName === "IMG" ? target : target.querySelector?.("img")) : (isChatContentImg ? target : null);

      if (img && img.src) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        this.openLightbox(img.src, img.alt || "Visualização de Imagem");
      }
    }, true); // Intercepta na fase de captura (capture: true) antes de qualquer stopPropagation
  }

  /**
   * Abre o modal interativo para envio de link de Imagem ou GIF com Live Preview
   */
  static showImageGifModal() {
    const activeChannel = ChannelManager.getActiveChannel();

    const content = `
      <div class="custom-image-modal-content" style="padding: 4px 0;">
        <div style="margin-bottom: 10px; font-size: 12px; color: #949ba4;">
          Enviando para o canal: <span style="color: #5865f2; font-weight: 600;">#${activeChannel}</span>
        </div>
        <div style="margin-bottom: 8px;">
          <input type="url" id="custom-image-url-field" placeholder="Cole o link da imagem ou GIF (Tenor, Giphy, .png, .gif)..." autofocus style="width: 100%; padding: 8px 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; font-size: 13px; box-sizing: border-box;" />
        </div>
        <div id="custom-image-preview-container" style="display: none; text-align: center; max-height: 220px; overflow: hidden; background: rgba(0,0,0,0.4); border-radius: 6px; padding: 6px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.08);">
          <img id="custom-image-preview-element" style="max-height: 200px; max-width: 100%; border-radius: 4px; object-fit: contain;" alt="Pré-visualização" />
        </div>
        <p id="custom-image-modal-hint" style="font-size: 11px; color: #80848e; margin: 0;">
          <i class="fas fa-info-circle"></i> Suporta links diretos (.png, .jpg, .gif, .webp), Giphy, Imgur e Tenor.
        </p>
      </div>
    `;

    const dialog = new Dialog({
      title: "Enviar Imagem ou GIF",
      content: content,
      buttons: {
        send: {
          icon: '<i class="fas fa-paper-plane"></i>',
          label: `Enviar para #${activeChannel}`,
          callback: async (html) => {
            const root = html instanceof HTMLElement ? html : html[0];
            const input = root.querySelector("#custom-image-url-field");
            const url = input?.value?.trim();
            if (url) {
              await this.sendImageUrl(url, activeChannel);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "send",
      render: (html) => {
        const root = html instanceof HTMLElement ? html : html[0];
        const input = root.querySelector("#custom-image-url-field");
        const previewContainer = root.querySelector("#custom-image-preview-container");
        const previewImg = root.querySelector("#custom-image-preview-element");
        const hint = root.querySelector("#custom-image-modal-hint");

        if (!input || !previewContainer || !previewImg) return;

        const updatePreview = () => {
          const rawUrl = input.value.trim();
          if (!rawUrl) {
            previewContainer.style.display = "none";
            if (hint) hint.innerHTML = '<i class="fas fa-info-circle"></i> Suporta links diretos (.png, .jpg, .gif, .webp), Giphy, Imgur e Tenor.';
            return;
          }

          if (rawUrl.includes("tenor.com/view/")) {
            previewContainer.style.display = "none";
            if (hint) {
              hint.innerHTML = '<span style="color: #faa61a;"><i class="fas fa-exclamation-circle"></i> Dica do Tenor: clique com o botão direito no GIF e escolha "Copiar endereço da imagem" para o link direto (.gif).</span>';
            }
            return;
          }

          if (ImageHandler.isMediaUrl(rawUrl)) {
            const resolved = ImageHandler.resolveMediaUrl(rawUrl);
            previewImg.onload = () => {
              previewContainer.style.display = "block";
              if (hint) hint.innerHTML = '<span style="color: #57f287;"><i class="fas fa-check-circle"></i> Imagem pronta para envio!</span>';
            };
            previewImg.onerror = () => {
              previewContainer.style.display = "none";
              if (hint) hint.innerHTML = '<span style="color: #f23f43;"><i class="fas fa-times-circle"></i> Não foi possível carregar a pré-visualização. Certifique-se de que é um link direto de imagem.</span>';
            };
            previewImg.src = resolved;
          } else {
            previewContainer.style.display = "none";
            if (hint) hint.innerHTML = '<span style="color: #f23f43;"><i class="fas fa-times-circle"></i> URL de imagem inválida ou não reconhecida.</span>';
          }
        };

        input.addEventListener("input", updatePreview);
        input.addEventListener("paste", () => setTimeout(updatePreview, 50));
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const btn = root.querySelector('.dialog-button.send');
            if (btn) btn.click();
          }
        });
      }
    });

    dialog.render(true);
  }

  /**
   * Envia uma mensagem com URL de imagem ou GIF para o canal especificado
   * @param {string} rawUrl 
   * @param {string} channel 
   */
  static async sendImageUrl(rawUrl, channel) {
    const resolvedUrl = this.resolveMediaUrl(rawUrl.trim());
    const targetChannel = channel || ChannelManager.getActiveChannel();

    const speaker = typeof ChatMessage.getSpeaker === "function" ? ChatMessage.getSpeaker() : { alias: game.user?.name || "Usuário" };

    await ChatMessage.create({
      content: `
        <div class="discord-image-container">
          <img src="${resolvedUrl}" class="discord-chat-img" alt="GIF ou Imagem" loading="lazy" />
        </div>
      `,
      speaker: speaker,
      flags: {
        "custom-channels-chat": {
          channel: targetChannel,
          isImage: true
        }
      }
    });

    ui.notifications?.info?.("Imagem enviada com sucesso!");
  }

  /**
   * Verifica se a string informada é uma URL de imagem ou plataforma de GIF
   * @param {string} str 
   * @returns {boolean}
   */
  static isMediaUrl(str) {
    if (!str || typeof str !== "string") return false;
    return this.MEDIA_URL_REGEX.test(str.trim());
  }

  /**
   * Resolve e formata links de plataformas populares (Giphy, Tenor, Imgur, etc.) para URLs de mídia utilizáveis
   * @param {string} url 
   * @returns {string}
   */
  static resolveMediaUrl(url) {
    if (!url) return "";
    let cleanUrl = url.trim().replace(/<\/?[^>]+(>|$)/g, "").trim();

    // Resolução para links de página do Giphy (ex: https://giphy.com/gifs/cat-cute-3oKIPnAiaMCws8nOsE)
    const giphyMatch = cleanUrl.match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)/i);
    if (giphyMatch && giphyMatch[1] && !cleanUrl.includes("media.giphy.com")) {
      const giphyId = giphyMatch[1];
      return `https://media.giphy.com/media/${giphyId}/giphy.gif`;
    }

    // Links do Imgur sem extensão ou links de galeria
    const imgurMatch = cleanUrl.match(/^https?:\/\/(?:i\.)?imgur\.com\/(?:gallery\/)?([a-zA-Z0-9]+)(?:\.[a-zA-Z]+)?$/i);
    if (imgurMatch && imgurMatch[1] && !cleanUrl.includes(".")) {
      return `https://i.imgur.com/${imgurMatch[1]}.png`;
    }

    return cleanUrl;
  }

  /**
   * Processa o texto da mensagem antes do salvamento e embuti imagens/GIFs automaticamente
   * @param {string} rawContent 
   * @returns {string}
   */
  static processMessageContent(rawContent) {
    if (!rawContent || typeof rawContent !== "string") return rawContent;

    const trimmed = rawContent.trim();

    // Se já estiver embutido com tag de imagem ou container de imagem, não duplica
    if (trimmed.includes("discord-image-container") || trimmed.includes("<img")) {
      return rawContent;
    }

    // Remove tags HTML básicas envoltórias (<p>...</p>) para inspeção de URL pura
    const strippedContent = trimmed.replace(/<\/?[^>]+(>|$)/g, "").trim();

    // 1. Caso a mensagem seja EXATAMENTE uma URL de imagem ou GIF
    if (this.isMediaUrl(strippedContent) && !strippedContent.includes(" ")) {
      const resolved = this.resolveMediaUrl(strippedContent);
      return `
        <div class="discord-image-container">
          <img src="${resolved}" class="discord-chat-img" alt="Imagem enviada" loading="lazy" />
        </div>
      `;
    }

    // 2. Caso a mensagem contenha texto acompanhado de um link de imagem/GIF
    const match = trimmed.match(this.MEDIA_URL_REGEX);
    if (match && match[0]) {
      const mediaUrl = match[0];
      const resolved = this.resolveMediaUrl(mediaUrl);

      // Remove a URL e extrai texto limpo
      const textWithoutUrl = trimmed.replace(mediaUrl, "").trim();
      const cleanText = textWithoutUrl.replace(/<\/?[^>]+(>|$)/g, "").trim();
      const textPart = cleanText ? `<p class="discord-message-text">${cleanText}</p>` : "";

      return `
        ${textPart}
        <div class="discord-image-container">
          <img src="${resolved}" class="discord-chat-img" alt="Imagem enviada" loading="lazy" />
        </div>
      `;
    }

    return rawContent;
  }

  /**
   * Verifica se o elemento da mensagem no DOM precisa de formatação adicional de imagem
   * @param {ChatMessage} messageDoc 
   * @param {HTMLElement} el 
   */
  static formatDomMessage(messageDoc, el) {
    if (!el) return;

    // Apenas formata se for expressamente uma mensagem de imagem do módulo
    const isImageFlag = messageDoc?.getFlag?.(this.MODULE_ID, "isImage");
    const hasContainer = el.querySelector(".discord-image-container");
    if (!isImageFlag && !hasContainer) return;

    const contentEl = el.querySelector(".message-content");
    if (!contentEl) return;

    // Garante classe discord-chat-img e container na imagem
    const existingImg = contentEl.querySelector("img");
    if (existingImg && !existingImg.classList.contains("discord-chat-img")) {
      existingImg.classList.add("discord-chat-img");
      if (!existingImg.closest(".discord-image-container")) {
        const wrap = document.createElement("div");
        wrap.className = "discord-image-container";
        existingImg.before(wrap);
        wrap.appendChild(existingImg);
      }
    }
  }

  /**
   * Processa o arquivo da imagem e envia para o chat
   * @param {File} file 
   */
  static async processAndSendImage(file) {
    if (!file) return;

    ui.notifications?.info?.("Processando imagem...");

    // Se for GIF animado, não passa por canvas para preservar a animação
    const isGif = file.type === "image/gif";
    const optimizedFile = isGif ? file : await this.optimizeImage(file);

    let imageSrc = null;

    // Tenta upload no servidor do Foundry se o usuário tiver permissão
    try {
      const hasUploadPerm = game.user?.isGM || (typeof game.user?.can === "function" && game.user.can("FILES_UPLOAD"));
      if (hasUploadPerm && typeof FilePicker !== "undefined" && game.world?.id) {
        const uploadDir = `worlds/${game.world.id}/chat-uploads`;
        try {
          await FilePicker.createDirectory("data", uploadDir);
        } catch (dirErr) {
          // Diretório já pode existir
        }

        const response = await FilePicker.upload("data", uploadDir, optimizedFile, {}, { notify: false });
        if (response && response.path) {
          imageSrc = response.path;
        }
      }
    } catch (uploadErr) {
      console.warn("custom-channels-chat | Falha no upload para o servidor. Usando fallback Base64.", uploadErr);
    }

    // Fallback: Converte o arquivo otimizado para Base64 se o upload no servidor falhar ou não tiver permissão
    if (!imageSrc) {
      imageSrc = await this.fileToBase64(optimizedFile);
    }

    if (!imageSrc) {
      ui.notifications?.error?.("Não foi possível processar a imagem selecionada.");
      return;
    }

    const currentChannel = ChannelManager.getActiveChannel();
    const speaker = typeof ChatMessage.getSpeaker === "function" ? ChatMessage.getSpeaker() : { alias: game.user?.name || "Usuário" };

    // Cria a mensagem no chat com a imagem
    await ChatMessage.create({
      content: `
        <div class="discord-image-container">
          <img src="${imageSrc}" class="discord-chat-img" alt="Imagem enviada" loading="lazy" />
        </div>
      `,
      speaker: speaker,
      flags: {
        "custom-channels-chat": {
          channel: currentChannel,
          isImage: true
        }
      }
    });

    ui.notifications?.info?.("Imagem enviada com sucesso!");
  }

  /**
   * Converte um arquivo File em string Base64 Data URL
   * @param {File|Blob} file 
   * @returns {Promise<string>}
   */
  static fileToBase64(file) {
    return new Promise((resolve, reject) => {
      if (typeof FileReader === "undefined") {
        return resolve("");
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Redimensiona e comprime imagens no cliente antes do upload
   * @param {File} file 
   * @param {number} maxWidth 
   * @param {number} maxHeight 
   * @param {number} quality 
   * @returns {Promise<File>}
   */
  static async optimizeImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.85) {
    // Se não for imagem ou for leve (< 200KB), mantém original
    if (!file.type || !file.type.startsWith("image/") || file.size < 200 * 1024) {
      return file;
    }

    // GIFs não devem ser rasterizados em canvas
    if (file.type === "image/gif") {
      return file;
    }

    if (typeof Image === "undefined" || typeof document === "undefined") {
      return file;
    }

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        let width = img.width;
        let height = img.height;

        if (width <= maxWidth && height <= maxHeight && file.size < 500 * 1024) {
          return resolve(file);
        }

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const newName = file.name ? file.name.replace(/\.[^.]+$/, ".webp") : "chat-image.webp";
              const optimized = new File([blob], newName, {
                type: "image/webp",
                lastModified: Date.now()
              });
              resolve(optimized);
            } else {
              resolve(file);
            }
          },
          "image/webp",
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };

      img.src = url;
    });
  }
}
