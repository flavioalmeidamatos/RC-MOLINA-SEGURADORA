# Solutions Electron

Esta pasta contem a janela Electron usada pelo card `Solutions` no menu de simuladores.

## Fluxo atual

1. A aplicacao web publicada chama o bridge local em `http://127.0.0.1:32145`.
2. O bridge local recebe a posicao atual da janela do navegador.
3. O bridge local abre esta app Electron no mesmo monitor do sistema no Windows.
4. A janela Electron carrega `https://solutions.hcommerce.com.br/dashboard` fora do `iframe`.

## Como testar no Windows

Na raiz do projeto principal:

```bash
npm run solutions:bridge
```

Depois disso, abra a aplicacao principal e clique no card `Solutions`.

## Observacoes

- O bridge local escuta apenas em `127.0.0.1`.
- Em ambiente publicado na VPS, o backend nao abre janela nativa do usuario.
- Em ambiente local (`localhost`), o frontend ainda pode usar o fallback `/api/launch-electron`.
