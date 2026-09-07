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

1. Abra a pasta de dados do seu Foundry VTT:
   - No Windows, o caminho padrão geralmente é:
     `%localappdata%\FoundryVTT\Data\modules\`
2. Copie a pasta `custom-channels-chat` para dentro do diretório `modules/`:
   ```
   FoundryVTT/
   └── Data/
       └── modules/
           └── custom-channels-chat/
               ├── module.json
               ├── scripts/
               ├── styles/
               └── ...
   ```
3. Inicie o Foundry VTT e abra o seu Mundo de jogo.
4. Vá na aba de **Configurações do Jogo** (`Game Settings`) > **Gerenciar Módulos** (`Manage Modules`).
5. Procure por **Custom Channels Chat** e marque a caixa para ativá-lo.
6. Salve as alterações do módulo e o chat será atualizado com a barra de canais!

---

## ⚙️ Configurações Disponíveis

No menu **Configurações do Jogo > Opções de Módulos**:
* **Canais do Chat:** Permite definir a lista de canais separados por vírgula (ex: `geral, narrativa, off-topic, dados`).
* **Roteamento Automático de Rolagens:** Ativa/desativa o envio automático de rolagens para o canal `#dados`.
* **Estilo Visual Discord:** Ativa/desativa o layout com avatar arredondado e borda temática nas mensagens de bate-papo.
