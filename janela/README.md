# POC — Teste de Abertura Externa em Janela Dimensionada

> **Projeto isolado e independente.** Não está conectado ao sistema principal.

---

## Objetivo

Verificar se uma URL externa abre corretamente em uma janela real do navegador
com dimensões controladas via `window.open()`, como alternativa ao carregamento
em `<iframe>`.

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) versão 18 ou superior
- npm (incluído com o Node.js)

---

## Como executar

```bash
# 1. Entre na pasta do projeto
cd "APRENDIZADO APP/JANELA"

# 2. Instale as dependências (apenas na primeira vez)
npm install

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

Após executar `npm run dev`, abra o endereço exibido no terminal
(normalmente **http://localhost:5173**) em qualquer navegador.

> **Importante:** O clique no botão "Abrir janela de teste" é obrigatório
> para que o navegador permita a abertura da popup. Popups disparadas
> automaticamente são bloqueadas por padrão em todos os navegadores modernos.

---

## Onde alterar as configurações padrão

Abra o arquivo **`src/main.js`** e localize o bloco `CONFIG` no início do arquivo:

```js
const CONFIG = {
  /** URL carregada inicialmente no campo de texto. */
  urlPadrao: 'https://solutions.hcommerce.com.br/',   // ← altere a URL aqui

  /** Largura padrão da popup em pixels. */
  larguraPadrao: 1024,                                 // ← largura inicial

  /** Altura padrão da popup em pixels. */
  alturaPadrao: 760,                                   // ← altura inicial

  /**
   * Presets de tamanho.
   * Adicione ou remova objetos para criar novos botões de preset.
   * Lembre-se de adicionar o botão correspondente no index.html.
   */
  presets: [
    { id: 'preset-small',  largura: 800,  altura: 600 },  // ← Pequena
    { id: 'preset-medium', largura: 1024, altura: 760 },  // ← Média
    { id: 'preset-large',  largura: 1280, altura: 850 },  // ← Grande
  ],
  ...
};
```

| O que alterar             | Onde no `main.js`          |
|---------------------------|----------------------------|
| URL padrão                | `CONFIG.urlPadrao`         |
| Largura padrão            | `CONFIG.larguraPadrao`     |
| Altura padrão             | `CONFIG.alturaPadrao`      |
| Presets de tamanho        | Array `CONFIG.presets`     |
| Dimensão mínima permitida | `CONFIG.minDimensao`       |

---

## Estrutura do projeto

```
JANELA/
├── index.html          ← Página principal (estrutura HTML)
├── package.json        ← Dependências e scripts npm
├── README.md           ← Este arquivo
└── src/
    ├── main.js         ← Toda a lógica JavaScript (window.open, validações, etc.)
    └── style.css       ← Estilos (design system, componentes, responsividade)
```

---

## Cenários de resultado

Após abrir a janela de teste, selecione na interface o cenário observado:

| Cenário | O que aconteceu | Conclusão |
|---------|----------------|-----------|
| **A** | URL abriu normalmente | O problema estava no iframe; a janela externa é uma alternativa viável |
| **B** | Mesmo bloqueio na popup | O bloqueio é independente do iframe (IP, sessão, regra da plataforma) |
| **C** | Abriu em nova aba | O navegador ignorou as dimensões; comportamento dependente do browser |

---

## Observações técnicas

- A função `window.open()` pode ser bloqueada se chamada fora de um evento de clique.
- Navegadores baseados em Chromium (Chrome, Edge, Brave) tendem a abrir popups com
  dimensões respeitadas quando o usuário clica explicitamente no botão.
- Firefox pode exibir um aviso na barra de endereços sobre popups bloqueadas.
- A janela aberta é monitorada a cada 800 ms para detectar quando o usuário a fecha.

---

*POC independente · Vite + JavaScript puro · Sem iframe · Sem proxy reverso*
