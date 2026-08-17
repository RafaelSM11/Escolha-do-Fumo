# Transmissão de Tela

Site simples para você compartilhar sua tela ao vivo com dezenas ou centenas de
pessoas assistindo ao mesmo tempo, usando [LiveKit Cloud](https://cloud.livekit.io)
como infraestrutura de transmissão (WebRTC/SFU). O plano gratuito da LiveKit Cloud
inclui 100 conexões simultâneas e 5.000 minutos de WebRTC por mês, o que já cobre
uma transmissão com dezenas a ~100 espectadores por algumas horas.

Duas páginas:

- `/broadcast.html` — quem vai apresentar, compartilha a tela.
- `/watch.html` — quem vai assistir, entra pelo link que o apresentador compartilha.

## 1. Criar uma conta gratuita na LiveKit Cloud

1. Acesse https://cloud.livekit.io e crie uma conta (não pede cartão de crédito).
2. Crie um projeto.
3. Em **Settings → Keys**, copie o `API Key`, o `API Secret` e a `WebSocket URL`
   do projeto (algo como `wss://seu-projeto.livekit.cloud`).

## 2. Configurar o projeto

```bash
npm install
cp .env.example .env
```

Edite o `.env` e preencha:

```
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=wss://seu-projeto.livekit.cloud
HOST_PASSWORD=escolha-uma-senha   # opcional: protege quem pode começar a transmitir
```

## 3. Rodar localmente (para testar)

```bash
npm start
```

Abra http://localhost:3000. Isso funciona para testar sozinho, mas para que outras
pessoas entrem pela internet o site precisa estar hospedado publicamente — veja o
passo 4.

## 4. Colocar o site no ar (para outras pessoas acessarem)

O jeito mais simples é usar um serviço gratuito de hospedagem Node, por exemplo o
[Render](https://render.com):

1. Suba esta pasta para um repositório no GitHub.
2. No Render, clique em **New → Web Service**, conecte o repositório.
3. Build command: `npm install` — Start command: `npm start`.
4. Em **Environment**, adicione as mesmas variáveis do `.env`
   (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `HOST_PASSWORD`).
5. Depois do deploy, você terá uma URL pública tipo `https://seu-site.onrender.com`.

Alternativas equivalentes: Railway, Fly.io, ou qualquer host que rode uma aplicação
Node.js com uma porta HTTP exposta.

## 5. Como usar

1. Você (apresentador) abre `https://seu-site/broadcast.html`, escolhe um nome de
   sala, digita a senha (se configurou uma) e clica em **Iniciar transmissão**. O
   navegador vai pedir para escolher qual tela/janela compartilhar.
2. A página mostra um link para compartilhar, algo como
   `https://seu-site/watch.html?room=aula-hoje`. Envie esse link para quem for
   assistir (WhatsApp, e-mail, etc.).
3. Cada pessoa abre o link, digita o nome e clica em **Entrar** — a tela aparece
   ao vivo, sem poder falar ou compartilhar nada (modo somente visualização).

## Limites e escala

- **Gratuito:** até ~100 conexões simultâneas via LiveKit Cloud free tier.
- Se a plateia crescer além disso (centenas a milhares), o próximo passo é o plano
  pago da LiveKit Cloud (a partir de $50/mês) ou considerar um serviço de streaming
  tipo Twitch/YouTube Live com CDN de verdade.
- A senha de apresentador (`HOST_PASSWORD`) é uma proteção simples para impedir que
  qualquer pessoa com o link do site inicie uma transmissão em seu nome. Qualquer
  pessoa com o link de um espectador só consegue assistir, nunca publicar.

## Estrutura do projeto

```
server.js            servidor Express: gera tokens de acesso da LiveKit
public/index.html     página inicial com os dois links
public/broadcast.html  página do apresentador
public/watch.html      página de quem assiste
public/style.css       estilos compartilhados
```
