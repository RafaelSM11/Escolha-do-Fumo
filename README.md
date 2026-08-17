# Escolha do Fumo

Painel de pedidos da live + aba de **Transmissão de tela** com permissão controlada pelo admin.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha as variáveis (veja abaixo)
npm start
```

Abra `http://localhost:3000`.

## Configurando a transmissão de tela

A aba "Transmissão" usa [LiveKit](https://livekit.io) (WebRTC) para levar sua tela a vários espectadores ao vivo. Passos:

1. Crie uma conta gratuita em https://cloud.livekit.io e um projeto.
2. Em **Settings → Keys**, copie a **API Key**, o **API Secret** e a **URL do projeto** (algo como `wss://seu-projeto.livekit.cloud`).
3. Preencha o `.env`:
   - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
   - `ADMIN_PASSWORD`: uma senha só sua, usada para entrar como admin na aba Transmissão.
4. Rode `npm start`.

Na aba Transmissão:
- Você (admin) entra marcando "Sou o admin" + sua senha, e já pode clicar em **Compartilhar minha tela**.
- Qualquer espectador pode clicar em **Pedir para transmitir**; você recebe o pedido em tempo real e aprova ou nega.
- Você pode **Encerrar** a transmissão de qualquer pessoa a qualquer momento.

## Publicando online

Este projeto agora tem um pequeno servidor Node (`server.js`), então não dá mais para hospedar só como site estático (ex: GitHub Pages puro). Sugestão: [Render](https://render.com) (plano gratuito).

1. Suba este repositório no GitHub (se ainda não estiver).
2. No Render, crie um **Web Service** apontando para o repositório.
   - Build command: `npm install`
   - Start command: `npm start`
3. Em **Environment**, adicione as mesmas variáveis do `.env` (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `ADMIN_PASSWORD`).
4. Deploy. O Render já serve tudo em HTTPS, necessário para compartilhamento de tela funcionar no navegador.
