/**
 * custom-channels-chat | image-handler.js
 * Envio e visualização de mídia no chat do Foundry VTT v13 e v12
 * Suporta imagens, vídeos, áudios e anexos. Upload de arquivo, Links/URLs (Tenor, Giphy, Imgur, Discord, Web),
 * Área de Transferência (Ctrl+V), Arrastar e Soltar (Drag & Drop) e Visualizador Lightbox.
 */

import { describeFile, describeLink, escapeHtml } from "./media-types.js";

export class ImageHandler {
  static MODULE_ID = "custom-channels-chat";

  static localize(key, fallback) {
    const id = `CUSTOM_CHANNELS_CHAT.${key}`;
    const translated = game.i18n?.localize(id);
    return translated && translated !== id ? translated : fallback;
  }

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

    // 4. Listener global de clique em imagens para Lightbox
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
    attachBtn.title = this.localize("Buttons.AttachTitle", "Anexar arquivo do computador ou colar com Ctrl+V");
    attachBtn.innerHTML = `<i class="fas fa-paperclip"></i> <span>${this.localize("Buttons.AttachImage", "Anexar")}</span>`;

    // Input de arquivo invisível
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.style.display = "none";

    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        fileInput.value = "";
        await this.processAndSendImage(file);
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
    gifBtn.title = this.localize("Buttons.LinkTitle", "Enviar link de mídia ou arquivo");
    gifBtn.innerHTML = `<i class="fas fa-link"></i> <span>${this.localize("Buttons.SendGif", "Mídia / URL")}</span>`;

    gifBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showImageGifModal();
    });

    toolbar.appendChild(attachBtn);
    toolbar.appendChild(gifBtn);
    toolbar.appendChild(fileInput);

    // Posiciona a toolbar logo acima da caixa de texto
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

  /** Captura arquivos da área de transferência sem interferir na colagem de texto. */
  static setupPasteHandler(root, textarea) {
    const handlePaste = async (event) => {
      const clipboard = event.clipboardData || window.clipboardData;
      if (!clipboard || event.defaultPrevented) return;

      const file = clipboard.files?.[0]
        ?? Array.from(clipboard.items ?? []).find(item => item.kind === "file")?.getAsFile();
      if (!file) return;

      event.preventDefault();
      event.stopPropagation();
      await this.processAndSendImage(file);
    };

    for (const target of [textarea, root].filter(Boolean)) {
      if (target.dataset.customPasteAttached) continue;
      target.dataset.customPasteAttached = "true";
      target.addEventListener("paste", handlePaste);
    }

    if (!document.body.dataset.customGlobalPasteAttached) {
      document.body.dataset.customGlobalPasteAttached = "true";
      document.addEventListener("paste", (event) => {
        if (event.target?.closest?.("input, textarea, [contenteditable='true']")) return;
        const chat = document.getElementById("chat");
        if (chat && (chat.classList.contains("active") || chat.offsetParent !== null)) {
          return handlePaste(event);
        }
      });
    }
  }

  /** Captura apenas arquivos arrastados para o chat. */
  static setupDragDropHandler(root, textarea) {
    const dropArea = textarea || root;
    if (dropArea.dataset.customDropAttached) return;
    dropArea.dataset.customDropAttached = "true";

    dropArea.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      event.preventDefault();
      dropArea.classList.add("custom-chat-dragover");
    });

    dropArea.addEventListener("dragleave", () => {
      dropArea.classList.remove("custom-chat-dragover");
    });

    dropArea.addEventListener("drop", async (event) => {
      dropArea.classList.remove("custom-chat-dragover");
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;

      event.preventDefault();
      event.stopPropagation();
      await this.processAndSendImage(file);
    });
  }

  /**
   * Abre o visualizador moderno e responsivo (Lightbox) adaptado ao viewport
   * @param {string} src - URL ou base64 da imagem
   * @param {string} [altText]
   */
  static openLightbox(src, altText = "Visualização de Imagem") {
    if (!src) return null;

    const enableLightbox = game.settings?.get(this.MODULE_ID, "enableLightbox") ?? true;
    if (!enableLightbox) return null;

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
          <a href="#" class="custom-lightbox-btn custom-lightbox-download" title="Baixar imagem no computador">
            <i class="fas fa-download"></i> <span>Baixar</span>
          </a>
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

    // Botão de Download
    const downloadBtn = overlay.querySelector(".custom-lightbox-download");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          const a = document.createElement("a");
          a.href = src;
          a.download = `chat-media-${Date.now()}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (err) {
          window.open(src, "_blank");
        }
      });
    }

    // Botão de Abrir Original em Nova Aba
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

    // Fechar ao clicar no fundo (fora dos botões e da imagem)
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

      // Ignora avatares, dados e botões interativos
      if (target.closest?.(".discord-avatar-wrap, .avatar, .dice-roll, .dice-icon, .message-header, button, a")) {
        return;
      }

      // Detecta imagem de chat do módulo ou qualquer imagem dentro do corpo da mensagem
      const isCustomChatImg = target.classList?.contains("discord-chat-img") || target.closest?.(".discord-image-container img");
      const isChatContentImg = target.tagName === "IMG" && target.closest?.("#chat-log, .chat-log, #chat, #chat-popout, .chat-messages");

      const img = isCustomChatImg ? (target.tagName === "IMG" ? target : target.querySelector?.("img")) : (isChatContentImg ? target : null);

      if (img?.src && (game.settings?.get(this.MODULE_ID, "enableLightbox") ?? true)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        this.openLightbox(img.src, img.alt || "Visualização de Imagem");
      }
    }, true);
  }

  /** Abre a prévia do mesmo tipo de mídia que será exibido no chat. */
  static showImageGifModal() {
    const placeholder = this.localize("Modals.SendImagePlaceholder", "Cole o link da mídia ou do arquivo");
    const help = this.localize("Modals.LinkHelp", "Cole um link direto do Discord, Tenor, Giphy ou de outro site.");
    const content = `
      <div class="custom-image-modal-content">
        <input type="url" id="custom-image-url-field" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(placeholder)}" autofocus>
        <div id="custom-image-preview-container" class="custom-chat-preview" hidden></div>
        <p id="custom-image-modal-hint">${escapeHtml(help)}</p>
      </div>
    `;

    new Dialog({
      title: this.localize("Modals.SendImageTitle", "Enviar mídia ou arquivo"),
      content,
      buttons: {
        send: {
          icon: '<i class="fas fa-paper-plane"></i>',
          label: this.localize("Modals.Send", "Enviar para o chat"),
          callback: (html) => {
            const root = html instanceof HTMLElement ? html : html[0];
            return this.sendImageUrl(root.querySelector("#custom-image-url-field").value);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: this.localize("Modals.Cancel", "Cancelar")
        }
      },
      default: "send",
      render: (html) => {
        const root = html instanceof HTMLElement ? html : html[0];
        const input = root.querySelector("#custom-image-url-field");
        const preview = root.querySelector("#custom-image-preview-container");
        const hint = root.querySelector("#custom-image-modal-hint");

        input.addEventListener("input", () => {
          const source = input.value.trim();
          const item = describeLink(source, { explicit: true });
          preview.replaceChildren();
          preview.hidden = true;
          hint.textContent = help;
          if (!source) return;

          if (!item) {
            hint.textContent = this.localize("Modals.InvalidLink", "Use um endereço HTTP ou HTTPS válido.");
            return;
          }
          if (item.kind === "file") {
            hint.textContent = item.tenorPage
              ? this.localize("Modals.TenorPage", "Para reproduzir no chat, copie o endereço direto do GIF ou vídeo do Tenor.")
              : this.localize("Modals.FileLink", "O arquivo será enviado como link.");
            return;
          }

          const media = this.createPreview(item);
          media.addEventListener("error", () => {
            if (media.parentElement !== preview) return;
            preview.hidden = true;
            hint.textContent = this.localize("Modals.PreviewError", "Sem prévia. Confira se o link ainda funciona ou envie como link.");
          }, { once: true });
          preview.appendChild(media);
          preview.hidden = false;
        });

        input.addEventListener("keydown", event => {
          if (event.key === "Enter") {
            event.preventDefault();
            root.querySelector(".dialog-button.send")?.click();
          }
        });
      }
    }).render(true);
  }

  static async sendImageUrl(rawUrl) {
    const item = describeLink(rawUrl?.trim(), { explicit: true });
    if (!item) {
      ui.notifications?.warn?.(this.localize("Modals.InvalidLink", "Use um endereço HTTP ou HTTPS válido."));
      return;
    }

    await this.sendMedia(item);
  }

  static async sendMedia(item) {
    const speaker = typeof ChatMessage.getSpeaker === "function" ? ChatMessage.getSpeaker() : { alias: game.user?.name || "Usuário" };
    await ChatMessage.create({
      content: this.mediaCard(item),
      speaker,
      flags: { [this.MODULE_ID]: { isImage: item.kind === "image" } }
    });
    ui.notifications?.info?.(this.localize("Notifications.UploadSuccess", "Arquivo enviado."));
  }

  static isMediaUrl(source) {
    return typeof source === "string" && !!describeLink(source.trim());
  }

  static resolveMediaUrl(source) {
    return describeLink(source?.trim(), { explicit: true })?.src ?? "";
  }

  static mediaCard(item) {
    const src = escapeHtml(item.src);
    const name = escapeHtml(item.name);
    const image = item.kind === "image"
      ? `<img src="${src}" class="discord-chat-img" alt="${name}" loading="lazy">`
      : "";
    const link = item.src.startsWith("data:") ? ""
      : `<a class="custom-chat-file-link" href="${src}" data-media-kind="${item.kind}"${item.loop ? ' data-media-loop="true"' : ''} target="_blank" rel="noopener noreferrer">${name}</a>`;
    return `<div class="discord-image-container">${image}${link}</div>`;
  }

  static createPreview({ kind, src, name, loop }) {
    const media = document.createElement(kind === "image" ? "img" : kind);
    if (kind === "image") {
      media.alt = name;
    } else {
      media.controls = true;
      media.preload = "metadata";
      media.setAttribute("aria-label", name);
      if (kind === "video") {
        media.playsInline = true;
        media.loop = loop;
        media.defaultMuted = loop;
        media.muted = loop;
        media.autoplay = loop;
      }
    }
    media.src = src;
    return media;
  }

  /**
   * Incorpora links de mensagens de texto. Cards e conteúdo rico passam pelo Foundry.
   */
  static processMessageContent(rawContent) {
    if (typeof rawContent !== "string" || !rawContent) return rawContent;

    let content = rawContent;
    if (/<[a-z/!]/i.test(content)) {
      const wrapper = content.trim().match(/^<p>([^<>]*)<\/p>$/i);
      if (!wrapper) return rawContent;
      const decoder = document.createElement("textarea");
      decoder.innerHTML = wrapper[1];
      content = decoder.value;
    }

    const cards = [];
    const body = content.replace(/https?:\/\/[^\s<>"']+/gi, match => {
      // Mantém pontuação do texto e parênteses que fazem parte do endereço.
      let source = match.replace(/[.,;!?]+$/, "");
      for (const [opening, closing] of [["(", ")"], ["[", "]"]]) {
        while (source.endsWith(closing) && source.split(closing).length > source.split(opening).length) {
          source = source.slice(0, -1);
        }
      }
      const item = describeLink(source);
      if (!item) return match;
      cards.push(this.mediaCard(item));
      return match.slice(source.length);
    }).trim();

    if (!cards.length) return rawContent;
    const text = body ? `<p class="discord-message-text">${escapeHtml(body)}</p>` : "";
    return text + cards.join("");
  }

  /**
   * Mantém o link original no histórico e cria os leitores na hora de renderizar.
   */
  static formatDomMessage(messageDoc, el) {
    const content = el?.querySelector(".message-content");
    if (!content) return;

    const maxHeight = game.settings?.get(this.MODULE_ID, "maxImageHeight") || 300;
    for (const img of content.querySelectorAll("img")) {
      const container = img.closest(".discord-image-container");
      const item = container && describeLink(img.getAttribute("src") ?? "");
      // Versões anteriores salvaram MP4 do Discord e outros anexos como imagens.
      if (item && item.kind !== "image" && !container.querySelector(".custom-chat-file-link")) {
        const link = document.createElement("a");
        link.className = "custom-chat-file-link";
        link.href = item.src;
        link.textContent = item.name;
        if (item.loop) link.dataset.mediaLoop = "true";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        img.replaceWith(link);
        continue;
      }

      img.classList.add("discord-chat-img");
      img.style.setProperty("--custom-chat-media-height", `${maxHeight}px`);
      if (!container) {
        const wrap = document.createElement("div");
        wrap.className = "discord-image-container";
        img.before(wrap);
        wrap.appendChild(img);
      }
    }

    for (const link of content.querySelectorAll(".discord-image-container .custom-chat-file-link")) {
      if (link.dataset.previewBound) continue;
      link.dataset.previewBound = "true";
      const container = link.closest(".discord-image-container");
      const item = link.hasAttribute("href") && describeLink(link.href, { explicit: true });
      if (!item) continue;

      const kind = link.dataset.mediaKind ?? item.kind;
      let media = container.querySelector("img");
      if (!media && ["image", "video", "audio"].includes(kind)) {
        media = this.createPreview({ ...item, kind, loop: item.loop || link.dataset.mediaLoop === "true" });
        media.className = kind === "image" ? "discord-chat-img" : "custom-chat-player";
        media.style.setProperty("--custom-chat-media-height", `${maxHeight}px`);
        link.before(media);
      }
      if (!media) continue;

      const showLink = () => {
        media.hidden = true;
        link.hidden = false;
      };
      link.hidden = true;
      media.addEventListener("error", showLink, { once: true });
      if (media.error || (media.tagName === "IMG" && media.complete && !media.naturalWidth)) showLink();
    }
  }

  static async processAndSendImage(file) {
    if (!file) return;

    ui.notifications?.info?.(this.localize("Notifications.UploadingImage", "Processando arquivo..."));
    try {
      const item = describeFile(file);
      const upload = item.kind === "image" ? await this.optimizeImage(file) : file;
      const hasUploadPerm = game.user?.isGM || game.user?.can?.("FILES_UPLOAD");
      const picker = globalThis.foundry?.applications?.apps?.FilePicker ?? globalThis.FilePicker;
      let src;
      if (hasUploadPerm && picker && game.world?.id) {
        const directory = `worlds/${game.world.id}/chat-uploads`;
        try {
          await picker.createDirectory("data", directory);
        } catch {
          // O diretório pode já existir. O upload informa se ainda houver um erro.
        }

        try {
          src = (await picker.upload("data", directory, upload, {}, { notify: false }))?.path;
        } catch (error) {
          console.warn("custom-channels-chat | Falha no upload.", error);
        }
      }

      // Mantém o fluxo de colar imagens para jogadores sem permissão de upload.
      if (!src && item.kind === "image") src = await this.fileToBase64(upload);
      if (!src) {
        ui.notifications?.error?.(this.localize("Notifications.FileUploadError", "O Foundry não aceitou o upload. Confira o formato e a permissão ou envie um link."));
        return;
      }

      await this.sendMedia({ ...item, src });
    } catch (error) {
      console.warn("custom-channels-chat | Falha no envio.", error);
      ui.notifications?.error?.(this.localize("Notifications.UploadError", "Não foi possível enviar o arquivo."));
    }
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
   * Redimensiona e comprime imagens no cliente antes do upload para otimização
   * @param {File} file 
   * @param {number} maxWidth 
   * @param {number} maxHeight 
   * @param {number} quality 
   * @returns {Promise<File>}
   */
  static async optimizeImage(file, maxWidth = 1600, maxHeight = 1600, quality = 0.88) {
    // Converte apenas formatos estáticos para preservar animações, vetores e transparência.
    if (!["image/jpeg", "image/bmp"].includes(file.type) || file.size < 250 * 1024) {
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

        if (width <= maxWidth && height <= maxHeight && file.size < 600 * 1024) {
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
