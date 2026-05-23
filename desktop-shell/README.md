# RC Molina Desktop Shell

Shell Electron da aplicacao principal.

## Objetivo

Abrir o RC Molina dentro de uma janela Electron e renderizar o `Solutions` na mesma janela, abaixo do cabecalho do sistema.

## Como iniciar no Windows

Na raiz do projeto:

```bash
npm run desktop:start
```

Por padrao, o shell carrega:

```text
https://rcmolinaseguros.resolveplanilhas.com.br/dashboard
```

Para apontar para uma instancia local:

```bash
set RC_MOLINA_DESKTOP_URL=http://127.0.0.1:3000/dashboard
npm run desktop:start
```
