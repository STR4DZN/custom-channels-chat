/**
 * custom-channels-chat | channel-manager.js
 * Gerenciador de abas/canais estilo Discord para a barra lateral do Foundry VTT v13 / v12
 */

export class ChannelManager {
  static MODULE_ID = "custom-channels-chat";
  static activeChannel = "geral";
  static unreadCounts = {};
  static localChannels = new Set();

  /**
   * Helper estático para extrair flags mescladas tanto em formato aninhado quanto em chaves planas (dot-notation)
   * @param {object} [doc]
   * @param {object} [data]
   * @returns {object}
   */
  static extractAllFlags(doc = {}, data = {}) {
    const merged = {};
    const ingest = (obj) => {
      if (!obj || typeof obj !== "object") return;

      // Objeto direto de flags
      if (obj.flags && typeof obj.flags === "object") {
        for (const [k, v] of Object.entries(obj.flags)) {
          merged[k] = typeof v === "object" && v !== null ? { ...(merged[k] || {}), ...v } : v;
        }
      }

      // Chaves em notação de ponto (ex: "flags.dnd5e.roll", "flags.midi-qol.workflowId")
      for (const [key, val] of Object.entries(obj)) {
        if (key.startsWith("flags.")) {
          const parts = key.slice(6).split(".");
          let curr = merged;
          for (let i = 0; i < parts.length - 1; i++) {
            curr[parts[i]] = curr[parts[i]] || {};
            curr = curr[parts[i]];
          }
          curr[parts[parts.length - 1]] = val;
        }
      }

      // Método getFlag nativo do Foundry Document se disponível
      if (typeof obj.getFlag === "function") {
        const knownScopes = [
          "dnd5e", "pf2e", "midi-qol", "midiqol", "ready-set-roll-5e",
          "betterrolls5e", "tormenta20", "t20", "dice-so-nice", "swade", "pf1", "cpr", "coc7"
        ];
        for (const scope of knownScopes) {
          const flagVal = obj.getFlag(scope);
          if (flagVal !== undefined && flagVal !== null) {
            merged[scope] = typeof flagVal === "object" ? { ...(merged[scope] || {}), ...flagVal } : flagVal;
          }
        }
      }
    };

    ingest(doc);
    ingest(data);
    return merged;
  }

  /**
   * Detector abrangente para identificar se uma mensagem é uma rolagem de dados ou card de dano.
   * Suporta sistemas como D&D 5e (v2/v3/v4), PF2e, Tormenta20, módulos de automação (Midi-QOL, Ready Set Roll, Better Rolls, DSN)
   * e inspeção avançada de conteúdo HTML, botões de ação e nós DOM.
   * @param {ChatMessage|object} [messageDoc] 
   * @param {object} [data] 
   * @param {HTMLElement} [el] 
   * @returns {boolean}
   */
  static isDiceOrDamage(messageDoc = {}, data = {}, el = null) {
    // 1. Verificação direta de flags ou propriedades booleanas de rolagem
    if (messageDoc?.isRoll || data?.isRoll) return true;
    if (messageDoc?.roll || data?.roll) return true;

    // Rolagens em coleções ou arrays (Foundry v10, v11, v12, v13)
    const msgRolls = messageDoc?.rolls || messageDoc?._rolls;
    if (msgRolls && (msgRolls.length > 0 || (typeof msgRolls.size === "number" && msgRolls.size > 0))) return true;

    const dataRolls = data?.rolls || data?._rolls;
    if (dataRolls && (dataRolls.length > 0 || (typeof dataRolls.size === "number" && dataRolls.size > 0))) return true;

    // Tipos e estilos de mensagem CONST (ROLL)
    if (typeof CONST !== "undefined") {
      const rollType = CONST.CHAT_MESSAGE_TYPES?.ROLL;
      if (rollType !== undefined && (messageDoc?.type === rollType || data?.type === rollType)) return true;

      const rollStyle = CONST.CHAT_MESSAGE_STYLES?.ROLL;
      if (rollStyle !== undefined && (messageDoc?.style === rollStyle || data?.style === rollStyle)) return true;
    }
    if (messageDoc?.type === 5 || data?.type === 5 || messageDoc?.style === 5 || data?.style === 5) return true;

    // Inspeção de flavor (muito usado em rolagens de dano por fichas ou macros)
    const flavor = data?.flavor || messageDoc?.flavor;
    if (flavor && typeof flavor === "string") {
      if (/(?:damage|dano|roll|rolagem|attack|ataque|check|teste|save|salvaguarda|resistencia|resistência|cura|heal|healing|critical|critico|crítico|hit|acerto|erro|miss)\b/i.test(flavor)) return true;
    }

    // 2. Flags de sistemas e módulos de automação (qualquer atividade mecânica de ficha/item/dano)
    const flags = this.extractAllFlags(messageDoc, data);

    // D&D 5e: qualquer card de item, atividade, ataque, dano, uso de magia, etc.
    if (flags.dnd5e) {
      const d = flags.dnd5e;
      if (d.roll || d.damage || d.damageRoll || d.rollType || d.type || d.messageType || d.targets || d.item || d.activity || d.use) return true;
    }

    // Pathfinder 2e: qualquer contexto, dano, strike, magia
    if (flags.pf2e) return true;

    // Midi-QOL: automações completas de ataque e dano
    if (flags["midi-qol"] || flags.midiqol) return true;

    // Ready Set Roll 5e
    if (flags["ready-set-roll-5e"]) return true;

    // Better Rolls 5e
    if (flags.betterrolls5e || flags["betterrolls5e"]) return true;

    // Tormenta20 / T20 / Ordem Paranormal
    if (flags.tormenta20 || flags.t20 || flags.ordemparanormal || flags.op) return true;

    // Dice So Nice (3D dice)
    if (flags["dice-so-nice"] || flags.dsn) return true;

    // Savage Worlds (SWADE)
    if (flags.swade) return true;

    // Call of Cthulhu / CoC / Cyberpunk / Cypher
    if (flags.coc7 || flags["cyberpunk-red-core"] || flags.cyphersystem) return true;

    // Tabelas ou rolagens core
    if (flags.core?.RollTable || flags.core?.roll) return true;

    // 3. Inspeção de conteúdo HTML por padrões de rolagem, cards de itens ou dano
    const content = data?.content || messageDoc?.content;
    if (content && typeof content === "string") {
      const DAMAGE_DICE_REGEX = /dice-roll|dice-result|dice-total|dice-formula|dice-tooltip|inline-roll|damage-roll|damage-card|damage-total|dnd5e-damage|dnd5e-roll|card-damage|target-damage|damage-application|damage-apply|chat-damage-buttons|rolagem-dano|dano-total|card-dano|aplicar-dano|data-damage|data-roll|data-dano|data-formula|chat-card|item-card|data-item-id|data-action=["'](?:damage|applyDamage|apply-damage|rollDamage|roll-damage|aplicar-dano|attack|rollAttack|save|activityUse|use|heal|applyHeal|apply-heal|strike-damage|strike-critical)["']|data-acao=["'](?:dano|aplicar-dano|rolar-dano|ataque|rolar-ataque|teste|cura)["']|data-roll-type=["'](?:damage|attack|heal)["']|inline-dsn-hidden|class=["'][^"']*\b(?:damage|dano|dice-roll|item-card|chat-card)\b|\[\[/i;
      if (DAMAGE_DICE_REGEX.test(content)) return true;
    }

    // 4. Inspeção no elemento DOM renderizado (se fornecido)
    if (el) {
      if (el.classList?.contains?.("dice-roll") || el.classList?.contains?.("damage") || el.classList?.contains?.("dano") || el.classList?.contains?.("damage-card") || el.classList?.contains?.("chat-card") || el.classList?.contains?.("item-card")) return true;
      if (typeof el.querySelector === "function") {
        const rollEl = el.querySelector(
          ".dice-roll, .dice-result, .dice-total, .dice-formula, .inline-roll, " +
          "[data-damage], [data-roll], [data-dano], [data-formula], [data-damage-type], [data-tipo-dano], " +
          ".damage-roll, .damage-card, .damage-total, .dano-total, .damage, .dnd5e-damage, .chat-card, .item-card, " +
          ".chat-damage-buttons, .apply-damage, .aplicar-dano, " +
          '[data-action="applyDamage"], [data-action="damage"], [data-action="apply-damage"], [data-action="rollDamage"], [data-action="aplicar-dano"], [data-action="attack"], [data-action="activityUse"], [data-action="use"], [data-action="heal"], [data-action="applyHeal"], [data-action="strike-damage"], ' +
          '[data-acao="dano"], [data-acao="aplicar-dano"], [data-acao="rolar-dano"], [data-acao="ataque"], [data-acao="rolar-ataque"], [data-acao="teste"], [data-acao="cura"], [data-roll-type="damage"], [data-item-id]'
        );
        if (rollEl !== null) return true;
      }
    }

    return false;
  }

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

    // Inclui canais locais adicionados nesta sessão (otimista para jogadores)
    for (const local of this.localChannels) {
      if (!channels.includes(local)) {
        channels.push(local);
      }
    }

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
      .replace(/[^a-z0-9\-_]/g, "")
      .slice(0, 30);

    if (!cleanName) {
      ui.notifications?.warn?.("Nome de canal inválido.");
      return { success: false, error: "invalid" };
    }

    const currentChannels = this.getChannels();
    if (currentChannels.includes(cleanName)) {
      ui.notifications?.warn?.("Este canal já existe!");
      return { success: false, error: "exists" };
    }

    // Adiciona localmente de forma imediata (visível instantaneamente para quem criou)
    this.localChannels.add(cleanName);

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

    // Define o canal novo como ativo imediatamente e atualiza a barra
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

    this.localChannels.delete(channelName);
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
      default: "create",
      render: (html) => {
        const root = html instanceof HTMLElement ? html : html[0];
        const input = root.querySelector("#new-channel-name-input");
        if (input) {
          input.focus?.();
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const btn = root.querySelector(".dialog-button.create");
              if (btn) btn.click();
            }
          });
        }
      }
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

    // Localiza o container do chat e o elemento das mensagens
    const chatContainer = (root.id === "chat" || root.id === "chat-popout" ? root : root.closest?.("#chat, #chat-popout")) || document.getElementById("chat");
    const scope = chatContainer || root;

    // Remove barras existentes APENAS dentro deste container para não afetar outras janelas (ex: popout)
    const existingBars = scope.querySelectorAll ? Array.from(scope.querySelectorAll(".custom-channels-bar")) : [];
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

      // Renderiza conteúdo visível do botão
      btn.innerHTML = `${icon} <span class="channel-name">${label}</span>${badgeHtml}${delBtnHtml}`;

      // Listener no botão com tratamento prioritário de exclusão
      btn.addEventListener("click", (e) => {
        const delIcon = e.target?.closest?.(".channel-del-icon");
        if (delIcon) {
          e.preventDefault?.();
          e.stopPropagation?.();
          const targetChannel = delIcon.dataset.channel || ch;
          Dialog.confirm({
            title: "Excluir Canal",
            content: `<p>Tem certeza que deseja excluir o canal <strong>#${targetChannel}</strong>?</p>`,
            yes: () => this.deleteChannel(targetChannel),
            defaultYes: false
          });
          return;
        }

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

    // Suporte a rolagem horizontal via roda do mouse (wheel) e trackpads para sidebars estreitas
    nav.addEventListener("wheel", (e) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta) {
        e.preventDefault();
        nav.scrollLeft += delta;
      }
    }, { passive: false });

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

    // Localiza o elemento das mensagens dentro do container
    const chatLog = (chatContainer && chatContainer.querySelector ? (chatContainer.querySelector("#chat-log, .chat-log") || chatContainer.querySelector("ol, ul")) : null)
      || (root.querySelector ? (root.querySelector("#chat-log, .chat-log") || root.querySelector("ol, ul")) : null);

    if (chatLog && chatLog.parentElement && typeof chatLog.parentElement.insertBefore === "function") {
      chatLog.parentElement.insertBefore(nav, chatLog);
    } else if (chatLog && typeof chatLog.before === "function") {
      chatLog.before(nav);
    } else if (chatContainer && typeof chatContainer.prepend === "function") {
      chatContainer.prepend(nav);
    } else if (root.prepend) {
      root.prepend(nav);
    } else if (root.appendChild) {
      root.appendChild(nav);
    }

    // Previne que o container pai (#chat) acumule qualquer rolagem indevida e trava no topo
    if (chatContainer) {
      chatContainer.scrollTop = 0;
      chatContainer.scrollLeft = 0;
      if (!chatContainer.dataset?.customScrollLockAttached) {
        if (chatContainer.dataset) chatContainer.dataset.customScrollLockAttached = "true";
        chatContainer.addEventListener("scroll", () => {
          if (chatContainer.scrollTop !== 0) chatContainer.scrollTop = 0;
          if (chatContainer.scrollLeft !== 0) chatContainer.scrollLeft = 0;
        }, { passive: true });
      }
    }

    // Assegura que o botão do canal ativo esteja visível sem rolar os containers pais
    const activeTab = nav.querySelector(`.custom-channel-tab[data-channel="${this.activeChannel}"]`);
    if (activeTab) {
      this.scrollToTab(nav, activeTab);
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
    const autoRoute = game.settings?.get(this.MODULE_ID, "autoRouteRolls") ?? true;
    messages.forEach(msgEl => {
      const messageId = msgEl.dataset?.messageId || msgEl.getAttribute?.("data-message-id");
      const msgDoc = messageId && game.messages ? game.messages.get(messageId) : null;
      const isDiceOrDamage = this.isDiceOrDamage(msgDoc, msgDoc?._source || {}, msgEl);

      if (autoRoute && isDiceOrDamage) {
        msgEl.dataset.channel = "dados";
      } else if (!msgEl.dataset?.channel) {
        const channel = (typeof msgDoc?.getFlag === "function" ? msgDoc.getFlag(this.MODULE_ID, "channel") : null)
          || msgDoc?.flags?.[this.MODULE_ID]?.channel
          || (isDiceOrDamage ? "dados" : "geral");
        msgEl.dataset.channel = channel;
      }
    });
  }

  /**
   * Rola a barra de canais suavemente para manter a aba visível sem afetar containers pais
   * @param {HTMLElement} nav 
   * @param {HTMLElement} tab 
   */
  static scrollToTab(nav, tab) {
    if (!nav || !tab) return;
    try {
      const tabLeft = tab.offsetLeft ?? 0;
      const tabRight = tabLeft + (tab.offsetWidth || 80);
      const navLeft = nav.scrollLeft ?? 0;
      const navWidth = nav.clientWidth || 300;
      const navRight = navLeft + navWidth;

      if (tabLeft < navLeft) {
        const target = Math.max(0, tabLeft - 8);
        if (typeof nav.scrollTo === "function") {
          nav.scrollTo({ left: target, behavior: "smooth" });
        } else {
          nav.scrollLeft = target;
        }
      } else if (tabRight > navRight) {
        const target = tabRight - navWidth + 8;
        if (typeof nav.scrollTo === "function") {
          nav.scrollTo({ left: target, behavior: "smooth" });
        } else {
          nav.scrollLeft = target;
        }
      }
    } catch (e) {}
  }

  /**
   * Atualiza as classes ativas e os badges na barra de canais
   */
  static updateBarUI() {
    const bars = document.querySelectorAll ? Array.from(document.querySelectorAll(".custom-channels-bar")) : [document.querySelector(".custom-channels-bar")].filter(Boolean);
    if (!bars.length) {
      const chat = document.getElementById("chat");
      if (chat) this.renderBar(ui.chat, chat);
      return;
    }

    bars.forEach(bar => {
      const buttons = bar.querySelectorAll(".custom-channel-tab");
      buttons.forEach(btn => {
        const ch = btn.dataset.channel;
        const isActive = ch === this.activeChannel;
        if (isActive) {
          btn.classList.add("active");
          btn.setAttribute("aria-selected", "true");
          this.scrollToTab(bar, btn);
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
            const delIcon = btn.querySelector(".channel-del-icon");
            if (delIcon) {
              btn.insertBefore(badge, delIcon);
            } else {
              btn.appendChild(badge);
            }
          }
          badge.textContent = unread > 99 ? "99+" : unread;
        } else if (badge) {
          badge.remove();
        }
      });
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

    const active = this.activeChannel;
    const autoRoute = game.settings?.get(this.MODULE_ID, "autoRouteRolls") ?? true;

    if (filterStyle) {
      // Regras CSS abrangentes cobrindo todas as variações do Foundry VTT (v12, v13, ApplicationV2)
      filterStyle.textContent = `
        #chat-log .chat-message:not([data-channel="${active}"]),
        #chat-log .message:not([data-channel="${active}"]),
        #chat-log li[data-message-id]:not([data-channel="${active}"]),
        .chat-log [data-message-id]:not([data-channel="${active}"]),
        #chat [data-message-id]:not([data-channel="${active}"]) {
          display: none !important;
        }
        li.custom-channel-hidden,
        .custom-channel-hidden {
          display: none !important;
        }
      `;
    }

    const chatLog = document.getElementById("chat-log") || document.querySelector?.(".chat-log");
    if (chatLog) {
      const messages = chatLog.children ? Array.from(chatLog.children) : this.getMessageElements(chatLog);
      for (let i = 0; i < messages.length; i++) {
        const el = messages[i];
        if (!el.dataset) continue;
        const messageId = el.dataset.messageId || el.getAttribute?.("data-message-id");
        const msgDoc = messageId && game.messages ? game.messages.get(messageId) : null;
        const isDiceOrDamage = this.isDiceOrDamage(msgDoc, msgDoc?._source || {}, el);

        if (autoRoute && isDiceOrDamage) {
          el.dataset.channel = "dados";
        } else if (!el.dataset.channel) {
          el.dataset.channel = (typeof msgDoc?.getFlag === "function" ? msgDoc.getFlag(this.MODULE_ID, "channel") : null)
            || msgDoc?.flags?.[this.MODULE_ID]?.channel
            || (isDiceOrDamage ? "dados" : "geral");
        }
        const channel = el.dataset.channel || "geral";
        el.classList.toggle("custom-channel-hidden", channel !== active);
      }
      chatLog.scrollTop = chatLog.scrollHeight;
    }

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
    if (!game.settings?.get(this.MODULE_ID, "enableDiscordStyle")) return;

    // Não estiliza rolagens de dados ou cards de dano com visual Discord
    if (this.isDiceOrDamage(message, {}, el)) return;

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
