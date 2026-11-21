# Chat Media & Image Viewer (Foundry VTT v13 e v12)

Módulo moderno e leve para o **Foundry Virtual Tabletop (v13.351 / v12)** para compartilhar imagens, GIFs, vídeos, áudio e arquivos no chat, sem interferir na exibição de mensagens e rolagens nativas do Foundry VTT.

---

## 🚀 Principais Funcionalidades

1. **Anexar arquivos do computador**
   - Use **Anexar**, cole um arquivo com **Ctrl+V** ou arraste-o sobre a caixa de mensagem.
   - O upload usa a pasta `[Data]/worlds/<seu-mundo>/chat-uploads/` e depende do formato aceito pelo servidor e da permissão de upload do Foundry. Imagens ainda podem ser enviadas mesmo quando o upload falha ou o jogador não tem essa permissão.
   - Arquivos animados são preservados. Imagens JPEG e BMP grandes podem ser otimizadas no cliente.

2. **Prévia e envio por link**
   - Abra **Mídia / URL** para ver a prévia de uma imagem, vídeo ou áudio antes de enviar. Também é possível colar links diretos na caixa de mensagem. O texto e os demais links da mensagem são preservados.
   - GIFs do Discord entregues em MP4 ou WebM tocam automaticamente em loop e sem som quando o navegador permite. O leitor também oferece controles de reprodução.
   - Links diretos do Tenor e do Giphy funcionam como mídia. Páginas do Giphy e links `.gifv` do Imgur são convertidos para mídia direta. No Tenor, use o endereço direto da imagem ou do vídeo para reproduzir no chat.
   - Links assinados de anexos do Discord continuam sujeitos ao vencimento definido pelo Discord.

| Tipo | Exibição no chat |
| --- | --- |
| Imagens e animações, como PNG, JPEG, GIF, APNG, WebP, SVG e AVIF | Prévia clicável com visualizador de imagem |
| Vídeo, como MP4, WebM, MOV e OGV | Leitor com controles |
| Áudio, como MP3, OGG, WAV, M4A e FLAC | Leitor com controles |
| PDF, ZIP, documentos e outros arquivos | Link para abrir ou baixar |

A prévia depende do formato e do codec suportados pelo navegador. Quando a mídia não pode ser carregada, o card exibe o link do arquivo.

### Visualizador de imagem (Lightbox)

- Clique em uma imagem ou GIF no chat para ampliar.
- **Baixar** e **Abrir Original** dão acesso ao arquivo.
- Feche com **Esc**, com o botão de fechar ou clicando no fundo.

### Chat nativo

O suporte a anexos usa os hooks de chat das versões 12 e 13 do Foundry. A incorporação automática ignora mensagens de rolagem e preserva cards com HTML próprio.

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
* **Incorporação Automática de Mídia:** ativa/desativa a conversão automática de links diretos de mídia ou arquivos em cards.
* **Visualizador de Imagem (Lightbox):** ativa/desativa o visualizador ampliado em tela cheia ao clicar em imagens.
* **Altura Máxima no Chat (px):** define a altura máxima (de 150px a 600px) de imagens e vídeos no chat para evitar poluição visual.
