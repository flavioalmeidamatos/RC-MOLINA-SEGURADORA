# RCMolinaApp

Este é um projeto WPF moderno que contém uma Sidebar customizada e um WebView2 para carregar sites de terceiros sem perder o encapsulamento Desktop.

## Requisitos
- Windows 10/11
- [.NET 8.0 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
- Visual Studio 2022 (opcional, recomendado para desenvolvimento)

## Como executar via linha de comando
1. Abra o terminal na pasta do projeto (onde está o arquivo `RCMolinaApp.csproj`).
2. Execute o comando para restaurar os pacotes e compilar:
   ```bash
   dotnet build
   ```
3. Para rodar a aplicação, execute:
   ```bash
   dotnet run
   ```

## Nota
A imagem do avatar deve estar no caminho `Assets/Images/avatar.png` e marcada como Resource no Visual Studio para funcionar corretamente.
Você precisará adicionar a imagem real no diretório do projeto, pois o repositório contém apenas as pastas.

