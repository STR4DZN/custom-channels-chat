/**
 * custom-channels-chat | channel-manager.js
 * Gerenciador de abas/canais estilo Discord para a barra lateral do Foundry VTT v13 / v12
 */

export class ChannelManager {
  static MODULE_ID = "custom-channels-chat";
  static activeChannel = "geral";
  static unreadCounts = {};

  /**
   * Retorna a lista de canais configurados no mundo
   * @returns {string[]}
   */
  static getChannels() {
    const rawList = game.settings?.get(this.MODULE_ID, "channelsList") || "geral, off-topic, dados";
    const channels = rawList
      .split(",")
      .map(c => c.trim().toLowerCase().replace(/\s+/g, "-"))
      .filter(c => c.length > 0);

    // Garante que os canais 'geral' e 'dados' sempre existam
    if (!channels.includes("geral")) {
      channels.unshift("geral");
    }
    if (!channels.includes("dados")) {
      channels.push("dados");
    }

    return [...new Set(channels)];
  }

  /**
   * Retorna o canal ativo no momento
   * @returns {string}
   */
  static getActiveChannel() {
    return this.activeChannel || "geral";
  }

  /**
   * Define o canal ativo e filtra as mensagens visíveis
   * @param {string} channelName 
   */
  static setActiveChannel(channelName) {
    if (!channelName) return;
    this.activeChannel = channelName;
    this.unreadCounts[channelName] = 0;
    this.updateBarUI();
    this.filterMessages();
  }

  /**
   * Incrementa o contador de não lidos para um canal específico
   * @param {string} channelName 
   */
  static incrementUnread(channelName) {
    if (channelName === this.activeChannel) return;
    this.unreadCounts[channelName] = (this.unreadCounts[channelName] || 0) + 1;
    this.updateBarUI();
  }

  /**
   * Cria um novo canal de chat
   * @param {string} rawName 
   * @returns {Promise<{success: boolean, channel?: string, error?: string}>}
   */
  static async createChannel(rawName) {
    const cleanName = String(rawName || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-_]/g, "");

    if (!cleanName) {
      ui.notifications?.warn?.("Nome de canal inválido.");
      return { success: false, error: "invalid" };
    }

    const currentChannels = this.getChannels();
    if (currentChannels.includes(cleanName)) {
      ui.notifications?.warn?.("Este canal já existe!");
      return { success: false, error: "exists" };
    }

    // Se o usuário atual for GM, atualiza a configuração global
    if (game.user?.isGM) {
      currentChannels.push(cleanName);
      await game.settings.set(this.MODULE_ID, "channelsList", currentChannels.join(", "));
      ui.notifications?.info?.(`Canal #${cleanName} criado com sucesso!`);
    } else {
      // Se for jogador, solicita ao GM via socket
      if (game.socket) {
        game.socket.emit(`module.${this.MODULE_ID}`, {
          action: "createChannel",
          channelName: cleanName,
          userId: game.user?.id
        });
      }
      ui.notifications?.info?.(`Solicitação para criar canal #${cleanName} enviada.`);
    }

    // Define o canal novo como ativo imediatamente
    this.setActiveChannel(cleanName);
    this.renderBar(ui.chat, ui.chat?.element || document);
    return { success: true, channel: cleanName };
  }

  /**
   * Exclui um canal existente (apenas GM, exceto 'geral' e 'dados')
   * @param {string} channelName 
   * @returns {Promise<boolean>}
   */
  static async deleteChannel(channelName) {
    if (channelName === "geral" || channelName === "dados") {
      ui.notifications?.warn?.("Os canais #geral e #dados não podem ser excluídos.");
      return false;
    }

    if (!game.user?.isGM) {
      ui.notifications?.warn?.("Apenas o Mestre pode excluir canais.");
      return false;
    }

    const channels = this.getChannels().filter(c => c !== channelName);
    await game.settings.set(this.MODULE_ID, "channelsList", channels.join(", "));
    ui.notifications?.info?.(`Canal #${channelName} excluído.`);

    if (this.activeChannel === channelName) {
      this.setActiveChannel("geral");
    } else {
      this.renderBar(ui.chat, ui.chat?.element || document);
    }

    return true;
  }

  /**
   * Abre a janela modal para criação de novo canal diretamente pela UI
   */
  static showCreateChannelDialog() {
    const content = `
      <div class="custom-channel-dialog-content" style="padding: 6px 0;">
        <p style="margin-bottom: 8px; color: #dbdee1; font-size: 13px;">Digite o nome do novo canal de texto:</p>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 4px 8px;">
          <span style="font-weight: bold; font-size: 16px; color: #5865f2;">#</span>
          <input type="text" id="new-channel-name-input" placeholder="ex: rumores, anotacoes, taverna" autofocus style="flex: 1; background: transparent; border: none; color: #fff; outline: none; font-size: 14px;" />
        </div>
      </div>
    `;

    new Dialog({
      title: "Criar Novo Canal",
      content: content,
      buttons: {
        create: {
          icon: '<i class="fas fa-plus"></i>',
          label: "Criar Canal",
          callback: async (html) => {
            const root = html instanceof HTMLElement ? html : html[0];
            const input = root.querySelector("#new-channel-name-input");
            if (input && input.value) {
              await this.createChannel(input.value);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "create"
    }).render(true);
  }

  /**
   * Renderiza ou atualiza a barra de canais no topo do chat
   * @param {Application} app
   * @param {HTMLElement|jQuery} html
   */
  static renderBar(app, html) {
    const root = html instanceof HTMLElement ? html : (html && html[0] ? html[0] : document.getElementById("chat"));
    if (!root) return;

    // Remove barras existentes em todo o container para evitar duplicações em re-render
    const existingBars = root.querySelectorAll ? root.querySelectorAll(".custom-channels-bar") : [];
    existingBars.forEach(b => b.remove());

    const channels = this.getChannels();

    // Cria o elemento da barra de canais
    const nav = document.createElement("nav");
    nav.className = "custom-channels-bar";
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Canais de Chat");

    // Botões de canais
    channels.forEach(ch => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `custom-channel-tab ${ch === this.activeChannel ? "active" : ""}`;
      btn.dataset.channel = ch;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", ch === this.activeChannel ? "true" : "false");

      const isDice = ch === "dados";
      const icon = isDice ? '<i class="fas fa-dice-d20"></i>' : '<span class="channel-hash">#</span>';
      const label = isDice ? "dados" : ch;

      const unread = this.unreadCounts[ch] || 0;
      const badgeHtml = unread > 0 ? `<span class="channel-unread-badge">${unread > 99 ? "99+" : unread}</span>` : "";

      // Botão de exclusão para GM (exceto geral e dados)
      const canDelete = game.user?.isGM && ch !== "geral" && ch !== "dados";
      const delBtnHtml = canDelete ? `<span class="channel-del-icon" title="Excluir canal" data-channel="${ch}"><i class="fas fa-times"></i></span>` : "";

      // Listener direto no botão como garantia adicional
      btn.addEventListener("click", (e) => {
        e.preventDefault?.();
        e.stopPropagation?.();
        this.setActiveChannel(ch);
      });

      nav.appendChild(btn);
    });

    // Botão "+" para criar novo canal diretamente pela UI
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "custom-channel-add-btn";
    addBtn.title = "Criar novo canal de texto";
    addBtn.setAttribute("aria-label", "Criar novo canal");
    addBtn.innerHTML = '<i class="fas fa-plus"></i>';
    addBtn.addEventListener("click", (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      this.showCreateChannelDialog();
    });
    nav.appendChild(addBtn);

    // Delegação de eventos de clique com alta confiabilidade na barra
    nav.addEventListener("click", (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();

      const target = e.target || e.currentTarget || nav;
      if (!target || !target.closest) return;

      // Clique no botão de excluir canal
      const delIcon = target.closest(".channel-del-icon");
      if (delIcon && delIcon.dataset.channel) {
        const targetChannel = delIcon.dataset.channel;
        Dialog.confirm({
          title: "Excluir Canal",
          content: `<p>Tem certeza que deseja excluir o canal <strong>#${targetChannel}</strong>?</p>`,
          yes: () => this.deleteChannel(targetChannel),
          defaultYes: false
        });
        return;
      }

      // Clique no botão de adicionar canal
      const clickedAdd = target.closest(".custom-channel-add-btn");
      if (clickedAdd) {
        this.showCreateChannelDialog();
        return;
      }

      // Clique em uma aba de canal
      const tab = target.closest(".custom-channel-tab");
      if (tab && tab.dataset.channel) {
        this.setActiveChannel(tab.dataset.channel);
      }
    });

    // Menu de contexto (botão direito) no canal para GM excluir rapidamente
    nav.addEventListener("contextmenu", (e) => {
      const target = e.target || e.currentTarget || nav;
      if (!target || !target.closest) return;
      const tab = target.closest(".custom-channel-tab");
      if (!tab || !game.user?.isGM) return;

      const ch = tab.dataset.channel;
      if (ch === "geral" || ch === "dados") return;

      e.preventDefault();
      e.stopPropagation();

      Dialog.confirm({
        title: "Excluir Canal",
        content: `<p>Deseja excluir o canal <strong>#${ch}</strong>?</p>`,
        yes: () => this.deleteChannel(ch),
        defaultYes: false
      });
    });

    // Insere a barra no topo do chat log
    const chatLog = root.querySelector ? (root.querySelector("#chat-log") || root.querySelector(".chat-log")) : null;
    if (chatLog) {
      chatLog.before(nav);
    } else if (root.prepend) {
      root.prepend(nav);
    } else if (root.appendChild) {
      root.appendChild(nav);
    }

    // Inicializa marcação das mensagens existentes e aplica o filtro
    this.tagExistingMessages(root);
    setTimeout(() => this.filterMessages(), 30);
  }

  /**
   * Obtém todos os elementos de mensagem dentro de um container com suporte a múltiplas estruturas do Foundry
   * @param {HTMLElement} [container] 
   * @returns {HTMLElement[]}
   */
  static getMessageElements(container = document) {
    if (!container || !container.querySelectorAll) return [];
    try {
      return Array.from(container.querySelectorAll("[data-message-id], #chat-log > li, .chat-message"));
    } catch (e) {
      return [];
    }
  }

  /**
   * Garante que todas as mensagens no DOM possuam o atributo data-channel
   * @param {HTMLElement} [root] 
   */
  static tagExistingMessages(root) {
    const messages = this.getMessageElements(root || document);
    messages.forEach(msgEl => {
      if (!msgEl.dataset.channel) {
        const messageId = msgEl.dataset.messageId || msgEl.getAttribute?.("data-message-id");
        const msgDoc = messageId && game.messages ? game.messages.get(messageId) : null;
        
        const isRoll = msgDoc?.isRoll || msgEl.classList.contains("dice-roll") || msgEl.querySelector?.(".dice-roll") !== null;
        const channel = msgDoc?.getFlag?.(this.MODULE_ID, "channel") || (isRoll ? "dados" : "geral");
        msgEl.dataset.channel = channel;
      }
    });
  }

  /**
   * Atualiza as classes ativas e os badges na barra de canais
   */
  static updateBarUI() {
    const bar = document.querySelector(".custom-channels-bar");
    if (!bar) return;

    const buttons = bar.querySelectorAll(".custom-channel-tab");
    buttons.forEach(btn => {
      const ch = btn.dataset.channel;
      const isActive = ch === this.activeChannel;
      if (isActive) {
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
      } else {
        btn.classList.remove("active");
        btn.setAttribute("aria-selected", "false");
      }

      // Atualiza badge
      const unread = this.unreadCounts[ch] || 0;
      let badge = btn.querySelector(".channel-unread-badge");
      if (unread > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "channel-unread-badge";
          btn.appendChild(badge);
        }
        badge.textContent = unread > 99 ? "99+" : unread;
      } else if (badge) {
        badge.remove();
      }
    });
  }

  /**
   * Atualiza a regra CSS de alta performance O(1) e a visibilidade direta das mensagens
   */
  static filterMessages() {
    let filterStyle = document.getElementById("custom-channels-filter-style");
    if (!filterStyle && document.head) {
      filterStyle = document.createElement("style");
      filterStyle.id = "custom-channels-filter-style";
      document.head.appendChild(filterStyle);
    }

    if (filterStyle) {
      // Regras CSS abrangentes cobrindo todas as variações do Foundry VTT (v12, v13, ApplicationV2)
      filterStyle.textContent = `
        #chat-log .chat-message:not([data-channel="${this.activeChannel}"]),
        #chat-log .message:not([data-channel="${this.activeChannel}"]),
        #chat-log li[data-message-id]:not([data-channel="${this.activeChannel}"]),
        .chat-log [data-message-id]:not([data-channel="${this.activeChannel}"]),
        #chat [data-message-id]:not([data-channel="${this.activeChannel}"]) {
          display: none !important;
        }
        li.custom-channel-hidden,
        .custom-channel-hidden {
          display: none !important;
        }
      `;
    }

    // Sincronização direta de classe e marcação em cada mensagem em passagem única
    const messages = this.getMessageElements(document);
    messages.forEach(el => {
      if (!el.dataset.channel) {
        const messageId = el.dataset.messageId || el.getAttribute?.("data-message-id");
        const msgDoc = messageId && game.messages ? game.messages.get(messageId) : null;
        const isRoll = msgDoc?.isRoll || el.classList.contains("dice-roll") || el.querySelector?.(".dice-roll") !== null;
        el.dataset.channel = msgDoc?.getFlag?.(this.MODULE_ID, "channel") || (isRoll ? "dados" : "geral");
      }
      const channel = el.dataset.channel || "geral";
      el.classList.toggle("custom-channel-hidden", channel !== this.activeChannel);
    });

    // Rola suavemente para o final do chat
    if (ui.chat && typeof ui.chat.scrollBottom === "function") {
      ui.chat.scrollBottom();
    }
    const chatLog = document.getElementById("chat-log") || document.querySelector(".chat-log");
    if (chatLog) {
      chatLog.scrollTop = chatLog.scrollHeight;
    }
  }

  /**
   * Formata visualmente o card da mensagem para o estilo Discord
   * @param {ChatMessage} message
   * @param {HTMLElement} el
   */
  static formatDiscordMessage(message, el) {
    if (!game.settings?.get(this.MODULE_ID, "enableDiscordStyle")) return;

    // Não estiliza rolagens de dados com visual Discord
    if (message.isRoll || el.classList.contains("dice-roll") || el.querySelector?.(".dice-roll") !== null) return;

    el.classList.add("discord-styled-message");

    // Avatar do autor (Usuário real)
    const author = message.author || (message.user && game.users?.get(message.user));
    const avatarSrc = author?.avatar || "icons/svg/mystery-man.svg";
    const authorName = author?.name || message.alias || "Desconhecido";

    // Verifica se já inseriu o cabeçalho discord
    if (!el.querySelector(".discord-avatar-wrap")) {
      const avatarWrap = document.createElement("div");
      avatarWrap.className = "discord-avatar-wrap";
      avatarWrap.innerHTML = `<img src="${avatarSrc}" class="discord-avatar" alt="${authorName}" />`;

      const header = el.querySelector(".message-header");
      if (header) {
        header.prepend(avatarWrap);
      } else {
        el.prepend(avatarWrap);
      }
    }
  }
}
