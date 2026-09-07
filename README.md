# Custom Channels Chat (Foundry VTT v13)

Módulo para o **Foundry Virtual Tabletop (v13.351 / v12)** que traz a experiência de bate-papo estilo Discord diretamente para a barra lateral do chat, sem misturar ou quebrar as rolagens de dados e mecânicas da mesa.

---

## 🚀 Principais Funcionalidades

1. **Canais e Abas no Chat (#geral, #off-topic, #dados):**
   - Cria uma barra de canais estilizada no topo da aba de chat.
   - O Mestre pode personalizar os nomes dos canais nas configurações do módulo.
   - Filtro instantâneo das mensagens exibidas com alternância de abas.
   - Badge indicador de novas mensagens não lidas nos outros canais.

2. **Isolamento e Preservação de Rolagens de Dados:**
   - Todas as rolagens de dados (feitas no chat com `/r`, pelas fichas de personagem ou por macros e outros módulos) são **roteadas automaticamente para a aba `#dados`**.
   - As abas de conversa ficam limpas para interpretação e bate-papo, sem perder o histórico nem interferir em módulos como *Dice So Nice* (dados 3D) ou sistemas de regras (D&D 5e, PF2e, Tormenta20, etc.).

3. **Envio Direto de Imagens (Ctrl+V e Anexo):**
   - **Colar da área de transferência:** tire um print e pressione `Ctrl+V` na caixa de texto do chat para enviar a imagem imediatamente.
   - **Botão de anexo:** ícone de clipe de papel para escolher imagens do computador.
   - **Upload seguro no servidor:** as imagens são salvas em `[Data]/worlds/<seu-mundo>/chat-uploads/` com fallback automático para Base64 caso o usuário não tenha permissões de gravação de arquivos.
   - **Visualizador Ampliado (Lightbox):** clique em qualquer imagem no chat para abri-la em tela cheia via `ImagePopout` nativo do Foundry.

4. **Identidade Real do Usuário (Estilo Discord):**
   - Conversas de texto usam o avatar e o nome da conta do jogador, garantindo uma conversa fluida sem alterar o token selecionado no mapa.

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
