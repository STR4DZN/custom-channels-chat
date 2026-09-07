/**
 * custom-channels-chat | channel-manager.js
 * Gerenciador de abas/canais estilo Discord para a barra lateral do Foundry VTT v13
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
      .map(c => c.trim().toLowerCase())
      .filter(c => c.length > 0);

    // Garante que o canal 'dados' sempre exista para as rolagens
    if (!channels.includes("dados")) {
      channels.push("dados");
    }

    return channels;
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
   * Renderiza ou atualiza a barra de canais no topo do chat
   * @param {Application} app
   * @param {HTMLElement|jQuery} html
   */
  static renderBar(app, html) {
    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

    // Remove barra existente se houver para evitar duplicações em re-render
    const existing = root.querySelector(".custom-channels-bar");
    if (existing) existing.remove();

    const channels = this.getChannels();

    // Cria o elemento da barra de canais
    const nav = document.createElement("nav");
    nav.className = "custom-channels-bar";
    nav.setAttribute("aria-label", "Canais de Chat");

    channels.forEach(ch => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `custom-channel-tab ${ch === this.activeChannel ? "active" : ""}`;
      btn.dataset.channel = ch;

      const isDice = ch === "dados";
      const icon = isDice ? '<i class="fas fa-dice-d20"></i>' : '<span class="channel-hash">#</span>';
      const label = isDice ? "dados" : ch;

      const unread = this.unreadCounts[ch] || 0;
      const badgeHtml = unread > 0 ? `<span class="channel-unread-badge">${unread > 99 ? "99+" : unread}</span>` : "";

      btn.innerHTML = `${icon} <span class="channel-name">${label}</span> ${badgeHtml}`;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.setActiveChannel(ch);
      });

      nav.appendChild(btn);
    });

    // Insere a barra no topo do chat log
    const chatLog = root.querySelector("#chat-log");
    if (chatLog) {
      chatLog.before(nav);
    } else {
      root.prepend(nav);
    }

    // Aplica o filtro inicial nas mensagens existentes
    setTimeout(() => this.filterMessages(), 50);
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
      if (ch === this.activeChannel) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
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
   * Atualiza a regra CSS de alta performance O(1) para exibir apenas as mensagens do canal ativo
   */
  static filterMessages() {
    let filterStyle = document.getElementById("custom-channels-filter-style");
    if (!filterStyle) {
      filterStyle = document.createElement("style");
      filterStyle.id = "custom-channels-filter-style";
      document.head.appendChild(filterStyle);
    }

    // A regra CSS oculta instantaneamente qualquer mensagem fora do canal ativo no motor nativo C++ do navegador
    filterStyle.textContent = `
      #chat-log .message:not([data-channel="${this.activeChannel}"]) {
        display: none !important;
      }
    `;

    // Rola suavemente para o final do chat
    if (ui.chat && typeof ui.chat.scrollBottom === "function") {
      ui.chat.scrollBottom();
    }
  }

  /**
   * Formata visualmente o card da mensagem para o estilo Discord
   * @param {ChatMessage} message
   * @param {HTMLElement} el
   */
  static formatDiscordMessage(message, el) {
    if (!game.settings.get(this.MODULE_ID, "enableDiscordStyle")) return;

    // Não estiliza rolagens de dados com visual Discord
    if (message.isRoll || el.classList.contains("dice-roll")) return;

    el.classList.add("discord-styled-message");

    // Avatar do autor (Usuário real)
    const author = message.author || game.users.get(message.user);
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
