# Chat Media & Image Viewer (Foundry VTT v13 e v12)

Módulo moderno e leve para o **Foundry Virtual Tabletop (v13.351 / v12)** dedicado ao envio direto, incorporação e visualização de imagens e GIFs no chat, sem interferir na exibição de mensagens e rolagens nativas do Foundry VTT.

---

## 🚀 Principais Funcionalidades

1. **Envio de Imagens do Computador:**
   - Botão visível **`Imagem`** posicionado diretamente acima da caixa de mensagem do chat.
   - Suporte para todos os formatos de imagem e animação comuns (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.avif`, `.bmp`).
   - Preservação total de GIFs animados (não sofrem recompressão em canvas, mantendo todas as frames).
   - Otimização inteligente para imagens pesadas (> 250KB) com conversão rápida no cliente para WebP de alta fidelidade.
   - Upload automático no servidor do Foundry (`[Data]/worlds/<seu-mundo>/chat-uploads/`) com fallback transparente para Base64 caso o usuário não tenha permissão de upload.

2. **Envio por Link / URL de Mídia (GIF / URL):**
   - Botão dedicado **`GIF / URL`** que abre um modal com campo de endereço e **Live Preview em tempo real**.
   - Resolução inteligente de links de plataformas populares:
     - **Tenor:** links diretos de GIFs com detecção e dicas.
     - **Giphy:** converte links de páginas do Giphy (`giphy.com/gifs/...`) automaticamente para URLs diretas de GIF animado.
     - **Imgur:** resolução direta de URLs sem extensão.
     - **Discord CDN, Reddit e URLs diretas:** exibição imediata.
   - Pressione **Enter** para enviar ou **Esc** para fechar o modal.

3. **Incorporação Automática de Links no Chat (Auto-Embed):**
   - Ao colar ou digitar uma URL de imagem ou GIF diretamente no campo de texto normal do chat, a mensagem é renderizada automaticamente como um card visual de mídia.
   - Se a mensagem contiver texto acompanhado do link, o texto é preservado no cabeçalho e a imagem exibida logo abaixo.

4. **Colar da Área de Transferência (Ctrl + V):**
   - Copie qualquer imagem da internet, do Discord ou capture um print de tela e pressione **Ctrl + V** com o chat aberto para enviá-la instantaneamente.

5. **Arrastar e Soltar (Drag & Drop):**
   - Arraste um arquivo de imagem do seu computador e solte sobre a caixa de texto do chat para enviar.

6. **Visualizador Moderno de Imagem (Lightbox Responsivo):**
   - Clique em qualquer imagem ou GIF no histórico do chat para abri-la em visualização ampliada de alta qualidade.
   - Fundo escurecido translúcido com desfoque (`backdrop-filter: blur(8px)`).
   - Perfeitamente contido e centralizado no viewport (`max-width: 92vw; max-height: 92vh;`).
   - Barra de ferramentas superior com:
     - **Baixar:** faz download do arquivo da imagem diretamente no seu computador.
     - **Abrir Original:** abre a imagem em resolução nativa em uma nova aba do navegador.
     - **Fechar (X) / Esc:** feche rapidamente clicando no X, no fundo da tela ou pressionando a tecla `Escape`.

7. **Compatibilidade Total e Preservação do Chat Nativo:**
   - 100% compatível com o Foundry VTT v13 (ApplicationV2) e v12.
   - Nenhuma mensagem, rolagem de dado, sussurro ou card de sistema é ocultado ou alterado.
   - Compatível com todos os módulos de rolagens 3D (ex: *Dice So Nice*) e sistemas (D&D 5e, Pathfinder 2e, Tormenta20, CoC, etc.).

---

## 📦 Como Instalar no Foundry VTT

### Método 1: Instalação pelo Manifest URL (Recomendado)
1. No menu principal ou na tela de configuração do Foundry VTT, acesse a aba **Add-on Modules** (Módulos Adicionais).
2. Clique no botão **Install Module** (Instalar Módulo).
3. No campo **Manifest URL** (no rodapé da janela), cole o endereço:
   ```text
   https://github.com/STR4DZN/custom-channels-chat/releases/latest/download/module.json
   ```
4. Clique em **Install** e aguarde o download.
5. Inicie seu mundo e ative o módulo em **Gerenciar Módulos**.

### Método 2: Instalação Manual
1. Baixe o arquivo `module.zip` da última release do repositório.
2. Extraia o conteúdo na pasta de módulos do seu Foundry VTT:
   - Windows: `%localappdata%\FoundryVTT\Data\modules\custom-channels-chat`
3. Reinicie o Foundry VTT e ative o módulo no seu mundo.

---

## ⚙️ Configurações do Módulo

No menu **Configurações do Jogo > Opções de Módulos > Chat Media & Image Viewer**:
* **Incorporação Automática de Mídia:** ativa/desativa a conversão automática de links de imagens/GIFs digitados no chat em cards visuais.
* **Visualizador de Imagem (Lightbox):** ativa/desativa o visualizador ampliado em tela cheia ao clicar em imagens.
* **Altura Máxima no Chat (px):** define a altura máxima (de 150px a 600px) dos cards de imagem no chat para evitar poluição visual.
