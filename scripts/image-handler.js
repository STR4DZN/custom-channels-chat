/**
 * custom-channels-chat | image-handler.js
 * Tratamento de upload de imagens (Ctrl+V, botão de anexo, lightbox) para Foundry VTT v13
 */

import { ChannelManager } from "./channel-manager.js";

export class ImageHandler {
  static MODULE_ID = "custom-channels-chat";

  /**
   * Inicializa os listeners de envio de imagem no ChatLog
   * @param {Application} app
   * @param {HTMLElement|jQuery} html
   */
  static initInput(app, html) {
    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

    const textarea = root.querySelector("#chat-message");
    if (!textarea) return;

    // 1. Captura evento de Colar (Ctrl + V)
    if (!textarea.dataset.discordPasteAttached) {
      textarea.dataset.discordPasteAttached = "true";
      textarea.addEventListener("paste", async (event) => {
        const clipboard = event.clipboardData || window.clipboardData;
        if (!clipboard || !clipboard.items) return;

        for (const item of clipboard.items) {
          if (item.type.indexOf("image") === 0) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              await this.processAndSendImage(file);
            }
            break;
          }
        }
      });
    }

    // 2. Injeta botão de anexo (clipe de papel)
    const chatControls = root.querySelector("#chat-controls") || root.querySelector("#chat-form");
    if (chatControls && !root.querySelector(".custom-chat-attach-btn")) {
      const attachBtn = document.createElement("button");
      attachBtn.type = "button";
      attachBtn.className = "custom-chat-attach-btn";
      attachBtn.title = "Enviar Imagem (ou cole com Ctrl+V)";
      attachBtn.innerHTML = '<i class="fas fa-paperclip"></i>';

      // Input invisível para seleção de arquivo
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.style.display = "none";

      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          await this.processAndSendImage(file);
          fileInput.value = ""; // Limpa o input
        }
      });

      attachBtn.addEventListener("click", (e) => {
        e.preventDefault();
        fileInput.click();
      });

      // Anexa o botão antes da caixa de texto ou no painel de controles
      const rollMode = chatControls.querySelector(".roll-type-select") || chatControls.firstElementChild;
      if (rollMode) {
        rollMode.after(attachBtn);
      } else {
        chatControls.prepend(attachBtn);
      }
      chatControls.appendChild(fileInput);
    }

    // 3. Listener global de clique em imagens para Lightbox (ImagePopout)
    if (!document.body.dataset.discordImgListenerAttached) {
      document.body.dataset.discordImgListenerAttached = "true";
      document.addEventListener("click", (event) => {
        const target = event.target;
        if (target && target.classList.contains("discord-chat-img")) {
          event.preventDefault();
          event.stopPropagation();
          new ImagePopout(target.src, {
            title: "Visualização de Imagem",
            shareable: true
          }).render(true);
        }
      });
    }
  }

  /**
   * Processa o arquivo da imagem e envia para o chat
   * @param {File} file 
   */
  static async processAndSendImage(file) {
    ui.notifications.info("Enviando imagem para o chat...");

    let imageSrc = null;

    // Tenta upload no servidor do Foundry
    try {
      const uploadDir = `worlds/${game.world.id}/chat-uploads`;
      try {
        await FilePicker.createDirectory("data", uploadDir);
      } catch (dirErr) {
        // Diretório já pode existir
      }

      const response = await FilePicker.upload("data", uploadDir, file, {}, { notify: false });
      if (response && response.path) {
        imageSrc = response.path;
      }
    } catch (uploadErr) {
      console.warn("custom-channels-chat | Falha no upload para o servidor. Usando fallback Base64.", uploadErr);
    }

    // Fallback: Converte para Base64 se o upload direto falhou (ex.: sem permissão de gravação)
    if (!imageSrc) {
      imageSrc = await this.fileToBase64(file);
    }

    if (!imageSrc) {
      ui.notifications.error("Não foi possível processar a imagem selecionada.");
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
      speaker: { alias: game.user.name },
      flags: {
        "custom-channels-chat": {
          channel: currentChannel,
          isImage: true
        }
      }
    });

    ui.notifications.info("Imagem enviada com sucesso!");
  }

  /**
   * Converte um arquivo File em string Base64 Data URL
   * @param {File} file 
   * @returns {Promise<string>}
   */
  static fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
}
