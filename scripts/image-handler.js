/**
 * custom-channels-chat | image-handler.js
 * Tratamento avançado de imagens e GIFs (Upload, Ctrl+V, Drag&Drop, URLs de Tenor/Giphy, Lightbox)
 * para Foundry VTT v13 e v12
 */

import { ChannelManager } from "./channel-manager.js";

export class ImageHandler {
  static MODULE_ID = "custom-channels-chat";

  /**
   * Expressão regular para identificar URLs diretas de imagem ou plataformas suportadas (Tenor, Giphy, Imgur)
   */
  static MEDIA_URL_REGEX = /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:\?[^\s<>"']*)?|https?:\/\/(?:www\.)?tenor\.com\/view\/[^\s<>"']+|https?:\/\/(?:media|c)\.tenor\.com\/[^\s<>"']+|https?:\/\/(?:www\.)?giphy\.com\/gifs\/[^\s<>"']+|https?:\/\/(?:media|i)\.giphy\.com\/media\/[^\s<>"']+|https?:\/\/(?:i\.)?imgur\.com\/[^\s<>"']+/i;

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

    // 1. Injeta a barra de ferramentas de mídia (Botão Imagem + Botão GIF/URL)
    this.injectMediaToolbar(root, chatControls, chatForm, textarea);

    // 2. Captura evento de Colar (Ctrl + V) tanto na caixa de texto quanto no painel do chat
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
    if (root.querySelector(".custom-chat-media-toolbar")) return;

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

    // Insere a toolbar em posição estratégica e visível
    if (chatControls) {
      chatControls.appendChild(toolbar);
    } else if (textarea) {
      textarea.before(toolbar);
    } else if (chatForm) {
      chatForm.prepend(toolbar);
    }
  }

  /**
   * Configura o listener de Ctrl+V (Paste) para imagens da área de transferência
   */
  static setupPasteHandler(root, textarea) {
    const targets = [textarea, root].filter(Boolean);

    targets.forEach(target => {
      if (target.dataset.customPasteAttached) return;
      target.dataset.customPasteAttached = "true";

      target.addEventListener("paste", async (event) => {
        const clipboard = event.clipboardData || window.clipboardData;
        if (!clipboard) return;

        // Verifica se há arquivos de imagem na área de transferência (prints, screenshots, cópia direta)
        if (clipboard.items && clipboard.items.length > 0) {
          for (const item of clipboard.items) {
            if (item.type && item.type.startsWith("image/")) {
              event.preventDefault();
              event.stopPropagation();
              const file = item.getAsFile();
              if (file) {
                await this.processAndSendImage(file);
              }
              return;
            }
          }
        }

        // Se o usuário colou texto, verifica se é um link direto de imagem/GIF
        const pastedText = clipboard.getData("text/plain")?.trim();
        if (pastedText && this.isMediaUrl(pastedText) && target === textarea) {
          // Se for uma URL pura de imagem, permite o fluxo normal (será tratada e embutida ao enviar)
          console.log("custom-channels-chat | Link de mídia detectado no paste:", pastedText);
        }
      });
    });
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
   * Configura o listener de clique global para visualização ampliada (Lightbox)
   */
  static setupLightboxListener() {
    if (document.body?.dataset.customImgLightboxAttached) return;
    if (document.body) document.body.dataset.customImgLightboxAttached = "true";

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (target && target.classList && target.classList.contains("discord-chat-img")) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof ImagePopout !== "undefined") {
          new ImagePopout(target.src, {
            title: "Visualização de Imagem",
            shareable: true
          }).render(true);
        }
      }
    });
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
          <input type="url" id="custom-image-url-field" placeholder="Cole o link da imagem ou GIF (Tenor, Giphy, .png, .gif)..." autofocus style="width: 100%; padding: 8px 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; font-size: 13px;" />
        </div>
        <div id="custom-image-preview-container" style="display: none; text-align: center; max-height: 220px; overflow: hidden; background: rgba(0,0,0,0.4); border-radius: 6px; padding: 6px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.08);">
          <img id="custom-image-preview-element" style="max-height: 200px; max-width: 100%; border-radius: 4px; object-fit: contain;" alt="Pré-visualização" />
        </div>
        <p style="font-size: 11px; color: #80848e; margin: 0;">
          <i class="fas fa-info-circle"></i> Suporta links diretos (.png, .jpg, .gif, .webp), Tenor e Giphy.
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

        if (!input || !previewContainer || !previewImg) return;

        const updatePreview = () => {
          const rawUrl = input.value.trim();
          if (rawUrl && ImageHandler.isMediaUrl(rawUrl)) {
            const resolved = ImageHandler.resolveMediaUrl(rawUrl);
            previewImg.src = resolved;
            previewContainer.style.display = "block";
          } else {
            previewContainer.style.display = "none";
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

    await ChatMessage.create({
      content: `
        <div class="discord-image-container">
          <img src="${resolvedUrl}" class="discord-chat-img" alt="GIF ou Imagem" loading="lazy" />
        </div>
      `,
      speaker: { alias: game.user?.name || "Usuário" },
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
   * Resolve e formata links de plataformas populares (Giphy, Tenor, etc.) para URLs de mídia utilizáveis
   * @param {string} url 
   * @returns {string}
   */
  static resolveMediaUrl(url) {
    if (!url) return "";
    let cleanUrl = url.trim();

    // Resolução para links de página do Giphy (ex: https://giphy.com/gifs/cat-cute-3oKIPnAiaMCws8nOsE)
    const giphyMatch = cleanUrl.match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)/i);
    if (giphyMatch && giphyMatch[1] && !cleanUrl.includes("media.giphy.com")) {
      const giphyId = giphyMatch[1];
      return `https://media.giphy.com/media/${giphyId}/giphy.gif`;
    }

    // Links do Imgur sem extensão
    if (/^https?:\/\/imgur\.com\/([a-zA-Z0-9]+)$/i.test(cleanUrl)) {
      const match = cleanUrl.match(/^https?:\/\/imgur\.com\/([a-zA-Z0-9]+)$/i);
      if (match && match[1]) {
        return `https://i.imgur.com/${match[1]}.png`;
      }
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

    // Se já estiver embutido com tag de imagem, não duplica
    if (trimmed.includes("discord-image-container") || trimmed.includes("<img")) {
      return rawContent;
    }

    // 1. Caso a mensagem seja EXATAMENTE uma URL de imagem ou GIF
    if (this.isMediaUrl(trimmed) && !trimmed.includes(" ")) {
      const resolved = this.resolveMediaUrl(trimmed);
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

      // Remove a URL crua do texto ou substitui por link formatado
      const textWithoutUrl = trimmed.replace(mediaUrl, "").trim();
      const textPart = textWithoutUrl ? `<p class="discord-message-text">${textWithoutUrl}</p>` : "";

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

    const contentEl = el.querySelector(".message-content");
    if (!contentEl) return;

    // Se já possui imagem, garante classe
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

    // Tenta upload no servidor do Foundry
    try {
      if (typeof FilePicker !== "undefined" && game.world?.id) {
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

    // Fallback: Converte o arquivo otimizado para Base64 se o upload no servidor falhar
    if (!imageSrc) {
      imageSrc = await this.fileToBase64(optimizedFile);
    }

    if (!imageSrc) {
      ui.notifications?.error?.("Não foi possível processar a imagem selecionada.");
      return;
    }

    const currentChannel = ChannelManager.getActiveChannel();

    // Cria a mensagem no chat com a imagem
    await ChatMessage.create({
      content: `
        <div class="discord-image-container">
          <img src="${imageSrc}" class="discord-chat-img" alt="Imagem enviada" loading="lazy" />
        </div>
      `,
      speaker: { alias: game.user?.name || "Usuário" },
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
