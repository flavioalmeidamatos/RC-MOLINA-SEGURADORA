# Integracao Links com aplicativo desktop

Esta aplicacao abre os portais da opcao **Links** por meio de um cliente desktop Electron rodando na maquina Windows do usuario.

## Fluxo

1. O usuario acessa **Links** na aplicacao web.
2. Ao escolher um portal, o frontend tenta chamar `http://127.0.0.1:43125/open`.
3. Se o cliente desktop ainda nao estiver aberto, o backend chama `desktop-client/open-desktop.cmd --background`.
4. O frontend aguarda o agente local responder e envia novamente a URL.
5. Se nao for possivel iniciar o desktop, a aplicacao abre o portal em uma nova aba como contingencia.

## Desenvolvimento local

```bash
npm install
npm run desktop:install
npm run dev
```

O cliente desktop pode ser iniciado manualmente com:

```bash
npm run desktop:dev
```

## Ambiente Windows do cliente

No `.env.local`, deixe:

```env
ENABLE_LOCAL_DESKTOP_START="true"
```

## VPS Linux

Na VPS, mantenha:

```env
ENABLE_LOCAL_DESKTOP_START="false"
```

A VPS nao deve tentar abrir janelas locais. O cliente desktop precisa rodar na maquina Windows do usuario que esta usando a aplicacao.
