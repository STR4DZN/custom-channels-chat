# Custom Channels Chat (Foundry VTT v13 e v12)

Módulo para o **Foundry Virtual Tabletop (v13.351 / v12)** que traz a experiência de bate-papo estilo Discord diretamente para a barra lateral do chat, sem misturar ou quebrar as rolagens de dados e mecânicas da mesa.

---

## 🚀 Principais Funcionalidades

1. **Canais e Abas no Chat (#geral, #off-topic, #dados):**
   - Cria uma barra de canais estilizada no topo da aba de chat, fixada com `sticky` e rolagem horizontal suave para garantir compatibilidade com sidebars estreitas e qualquer resolução de tela.
   - **Criar novos chats diretamente pela UI:** botão `+` na barra de canais para criar canais instantaneamente sem precisar acessar configurações do mundo.
   - **Gerenciar/Excluir canais:** o Mestre pode excluir canais criados (com proteção automática para os canais `#geral` e `#dados`).
   - Sincronização em tempo real via Sockets e World Settings entre Mestre e Jogadores.
   - Badge indicador de novas mensagens não lidas nos outros canais.

2. **Isolamento e Preservação de Rolagens de Dados:**
   - Todas as rolagens de dados (feitas no chat com `/r`, pelas fichas de personagem ou por macros e outros módulos) são **roteadas automaticamente para a aba `#dados`**.
   - As abas de conversa ficam limpas para interpretação e bate-papo, sem perder o histórico nem interferir em módulos como *Dice So Nice* (dados 3D) ou sistemas de regras (D&D 5e, PF2e, Tormenta20, etc.).

3. **Área Dedicada de Mídia (Imagens, GIFs e Links):**
   - **Barra de Ferramentas de Mídia:** botões dedicados `Imagem` e `GIF / URL` visíveis no painel de envio do chat.
   - **Modal com Live Preview:** ao clicar em `GIF / URL`, digite ou cole qualquer link e veja a imagem renderizar em tempo real antes de enviar.
   - **Incorporação Automática de Links:** envie links de imagens diretas (`.png`, `.jpg`, `.gif`, `.webp`), Tenor ou Giphy no chat e eles são convertidos automaticamente em cards visuais.
   - **Colar da área de transferência (Ctrl+V):** tire um print ou copie uma imagem e pressione `Ctrl+V` em qualquer lugar do chat para enviar.
   - **Arrastar e Soltar (Drag & Drop):** arraste imagens do seu computador diretamente para a caixa de chat.
   - **Upload seguro no servidor:** as imagens são salvas em `[Data]/worlds/<seu-mundo>/chat-uploads/` com fallback automático em Base64 otimizado.
   - **Visualizador Ampliado (Lightbox Responsivo):** clique em qualquer imagem ou GIF para abri-la em um visualizador moderno com fundo translúcido escurecido, perfeitamente adaptado e limitado ao viewport (`max-width: 90vw; max-height: 90vh;`), suporte a tecla Esc, clique fora para fechar e botão de Abrir Original.

4. **Identidade Real do Usuário (Estilo Discord):**
   - Conversas de texto usam o avatar e o nome da conta do jogador, garantindo uma conversa fluida sem alterar o token selecionado no mapa.
   - Compatibilidade completa com Foundry VTT v13 (ApplicationV2) e v12.

---

## 📦 Como Instalar e Testar no Foundry VTT

### Método 1: Instalação Direta pelo Manifest URL (Recomendado)
1. Abra o Foundry VTT na tela inicial de **Setup** (Gerenciador de Mundos/Sistemas).
2. Vá na aba **Add-on Modules** (Módulos Adicionais) e clique em **Install Module** (Instalar Módulo).
3. No campo **Manifest URL** no rodapé da janela, cole o link:
   ```text
   https://github.com/STR4DZN/custom-channels-chat/releases/latest/download/module.json
   ```
4. Clique em **Install** e o Foundry baixará e instalará o módulo automaticamente!

### Método 2: Instalação Manual (Pasta Local)
1. Copie a pasta `custom-channels-chat` para o diretório de dados do Foundry:
   - No Windows: `%localappdata%\FoundryVTT\Data\modules\custom-channels-chat` (ou o seu diretório de dados configurado).
2. Inicie o mundo e ative o módulo em **Gerenciar Módulos**.

---

## ⚙️ Configurações Disponíveis

No menu **Configurações do Jogo > Opções de Módulos**:
* **Canais do Chat:** Permite definir a lista de canais separados por vírgula (ex: `geral, narrativa, off-topic, dados`).
* **Roteamento Automático de Rolagens:** Ativa/desativa o envio automático de rolagens para o canal `#dados`.
* **Estilo Visual Discord:** Ativa/desativa o layout com avatar arredondado e borda temática nas mensagens de bate-papo.
