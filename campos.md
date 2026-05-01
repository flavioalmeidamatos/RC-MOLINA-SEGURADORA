# Mapeamento de campos de entrada de dados

Leitura realizada em 2026-05-01 a partir dos componentes em `src/components`, rotas em `src/App.tsx`, APIs em `api` e servidor local `server.ts`.

## Observacoes gerais

- O frontend principal usa React/Vite.
- Autenticacao, perfis, auditoria e avatars usam Supabase.
- O cabecalho mantem apenas um botao visual com icone do WhatsApp, sem integracao ativa.
- O cadastro multipagina de cliente ainda nao persiste em banco no codigo atual: o botao Salvar valida campos e exibe feedback dizendo que o proximo passo e conectar ao Supabase.
- Alguns inputs estao desabilitados ou ocultos, mas foram incluidos porque fazem parte do fluxo de entrada de dados.

## Rotas/telas

| Rota/area | Componente | Finalidade |
|---|---|---|
| `/login` | `Login.tsx` | Login por senha ou codigo seguro por e-mail |
| `/cadastro` | `Cadastro.tsx` | Criacao de usuario/perfil |
| `/recuperar-senha` | `RecuperarSenha.tsx` | Solicitar link de redefinicao de senha |
| `/atualizar-senha` | `AtualizarSenha.tsx` | Definir nova senha apos reset |
| `/dashboard` | `SCR_MENUPRINCIPAL.tsx` | Menu principal, agenda, cadastro cliente e importacao |
| Global/rodape | `FooterAdmin.tsx` | Acesso administrativo oculto e edicao de perfis |

## Login

Fonte: `src/components/Login.tsx`

| Campo | Estado/chave | Tipo | Obrigatorio | Validacao/mascara | Destino/uso |
|---|---|---|---|---|---|
| E-mail | `email` | `email` | Sim | RFC 5322 via `validarEmailRFC5322`; normaliza com `trim().toLowerCase()` | `supabase.auth.signInWithPassword`, `supabase.auth.signInWithOtp`, consulta `perfis.email` |
| Senha | `password` | `password` ou `text` | Sim no login por senha | Minimo 8 caracteres no blur | `supabase.auth.signInWithPassword` |
| E-mail cadastrado | `email` | `email` | Sim no fluxo OTP | RFC 5322; verifica existencia em `perfis` | `supabase.auth.signInWithOtp` |
| Codigo de acesso | `otpCode` | `text` | Sim no fluxo OTP | Apenas digitos; `maxLength=8`; exige 6 a 8 digitos | `supabase.auth.verifyOtp` |

## Cadastro de usuario

Fonte: `src/components/Cadastro.tsx`

| Campo | Estado/chave | Tipo | Obrigatorio | Validacao/mascara | Destino/uso |
|---|---|---|---|---|---|
| Foto/avatar | `avatarFile`, `avatarUrl` | `file` | Nao | `accept="image/*"` | Upload em Supabase Storage bucket `avatars`; URL salva em `perfis.avatar_url` |
| Nome completo | `formData.nome` | `text` | Sim | Letras e espacos; convertido para maiusculas; minimo 2 palavras | `auth.signUp.options.data.full_name`, `perfis.nome_completo` |
| E-mail | `formData.email` | `email` | Sim | RFC 5322; normaliza com `trim().toLowerCase()`; verifica duplicidade em `perfis.email` | `auth.signUp.email`, `perfis.email` |
| Senha | `formData.senha` | `password` ou `text` | Sim | Minimo 8; exige maiuscula, minuscula, numero e caractere especial | `auth.signUp.password` |
| Redigite sua senha | `formData.confirmarSenha` | `password` ou `text` | Sim | Deve ser igual a senha | Validacao local |
| Nome da organizacao | `formData.organizacao` | `text` | Nao | Letras e espacos; convertido para maiusculas | `auth.signUp.options.data.organization`, `perfis.organizacao` |

## Recuperar senha

Fonte: `src/components/RecuperarSenha.tsx`

| Campo | Estado/chave | Tipo | Obrigatorio | Validacao/mascara | Destino/uso |
|---|---|---|---|---|---|
| E-mail cadastrado | `email` | `email` | Sim | RFC 5322; cooldown de 60s | Consulta `perfis.id`; `supabase.auth.resetPasswordForEmail`; registra `auditoria.detalhes.email` |

## Atualizar senha

Fonte: `src/components/AtualizarSenha.tsx`

| Campo | Estado/chave | Tipo | Obrigatorio | Validacao/mascara | Destino/uso |
|---|---|---|---|---|---|
| Nova senha | `password` | `password` ou `text` | Sim | Minimo 8; exige maiuscula, minuscula, numero e caractere especial | `supabase.auth.updateUser({ password })` |
| Confirme a nova senha | `confirmPassword` | `password` ou `text` | Sim | Deve ser igual a nova senha | Validacao local |

## Rodape administrativo

Fonte: `src/components/FooterAdmin.tsx`

| Campo | Estado/chave | Tipo | Obrigatorio | Validacao/mascara | Destino/uso |
|---|---|---|---|---|---|
| Senha administrativa | `adminPassword` | `password` | Sim | SHA-256 comparado com hash fixo | Libera painel administrativo |
| Selecionar usuario | `selectedUserId` | `select` | Sim para editar/excluir | Opcoes vindas de `perfis` | Define usuario alvo |
| Foto do usuario | `avatarFile`, `avatarUrl` | `file` | Nao | `accept="image/*"` | Upload em Storage `avatars`; enviado para RPC |
| Nome completo | `formData.nome` | `text` | Sim | Letras e espacos; convertido para maiusculas | RPC `admin_update_user.p_nome` |
| E-mail | `formData.email` | `email` | Sim | RFC 5322; normalizado | RPC `admin_update_user.p_email` |
| Organizacao | `formData.organizacao` | `text` | Nao | Letras e espacos; convertido para maiusculas | RPC `admin_update_user.p_org` |

## Cadastro multipagina de cliente

Fonte: `src/components/ClientRegistrationMultipage.tsx`

### Controle do formulario

| Acao/campo | Estado/chave | Tipo | Observacao |
|---|---|---|---|
| Novo cliente | `isClientFormEnabled` | Botao | Libera o fieldset do formulario |
| Importar | `showImportModal` | Botao/modal | Abre importacao do Sistema Quer |
| Salvar | `saveClient()` | Botao | Valida CPF/RG/CNPJ/data/contatos; nao persiste em banco atualmente |

### Aba Geral

| Campo | Estado/chave | Tipo | Obrigatorio | Validacao/mascara | Destino/uso |
|---|---|---|---|---|---|
| Nome | `formState.nome` | `text` | Visualmente sim (`Nome*`) | Apenas letras e espacos; convertido para maiusculas | Estado local; preenchido por importacao |
| CPF | `formState.cpf` | `text` numerico | Nao | `formatarCPF`; `maxLength=14`; valida `validarCPF` no blur/salvar | Estado local; preenchido por importacao |
| RG | `formState.rg` | `text` | Nao | `formatarRG`; `maxLength=10`; valida `validarRG` | Estado local |
| CNPJ | `formState.cnpj` | `text` numerico | Nao | `formatarCNPJ`; `maxLength=18`; valida `validarCNPJ` | Estado local; preenchido por importacao |
| Data de nascimento | `formState.dataNascimento` | `text` numerico | Nao | `formatarDataBR`; `maxLength=10`; valida `validarDataNascimentoBR` | Estado local; preenchido por importacao |
| Tipo de contato | `contacts[].type` | `select` | Sim por linha | Opcoes: Celular, E-mail, Residencial, Comercial | Estado local |
| Contato | `contacts[].value` | `text` | Visualmente sim (`Contatos*`), mas aceita vazio na validacao atual | Se E-mail: RFC 5322. Se telefone: mascara celular/residencial e exige 11/10 digitos quando preenchido | Estado local; preenchido por importacao |
| Complemento do contato | `contacts[].extra` | `text` | Nao | Convertido para maiusculas | Estado local |
| Observacoes do contato | `contacts[].notes` | `text` | Nao | Convertido para maiusculas | Estado local |
| Observacoes | `formState.observacoes` | `textarea` | Nao | Convertido para maiusculas | Estado local; preenchido por importacao |
| Codigo | `formState.codigo` | `text` numerico | Nao | Apenas digitos; maximo 6 | Estado local; preenchido por `indicacao_id` importado |
| Data de cadastro | `formState.dataCadastro` | `text` numerico | Nao | `formatarDataBR`; `maxLength=10` | Estado local; importacao usa data atual |

### Aba Endereco

| Campo | Estado/chave | Tipo | Obrigatorio | Validacao/mascara | Destino/uso |
|---|---|---|---|---|---|
| CEP | `formState.enderecoCep` | `text` numerico | Nao | Mascara `00000-000`; consulta ViaCEP com 8 digitos | Preenche rua, bairro, UF e cidade |
| Endereco | `formState.enderecoRua` | `text` desabilitado | Nao | Convertido para maiusculas; preenchido via CEP/importacao | Estado local |
| Numero | `formState.enderecoNumero` | `text` | Nao | Convertido para maiusculas | Estado local; preenchido por importacao |
| Complemento | `formState.enderecoComplemento` | `text` | Nao | Convertido para maiusculas | Estado local |
| Ponto de referencia | `formState.enderecoReferencia` | `text` | Nao | Convertido para maiusculas | Estado local |
| Bairro | `formState.enderecoBairro` | `text` desabilitado | Nao | Convertido para maiusculas; preenchido via CEP/importacao | Estado local |
| Cidade | `formState.enderecoCidade` | `text` desabilitado | Nao | Convertido para maiusculas; preenchido via CEP/importacao | Estado local |
| Estado | `formState.enderecoEstado` | `select` desabilitado | Nao | Lista de UFs | Estado local |

### Aba Extras

| Campo | Estado/chave | Tipo | Obrigatorio | Validacao/mascara | Destino/uso |
|---|---|---|---|---|---|
| Marcacoes | `formState.marcacoes` | `text` | Nao | Convertido para maiusculas | Estado local |
| Como nos conheceu? | `formState.comoConheceu` | `select` | Nao | Opcoes: `0 - Nao informado`, `1 - Indicacao`, `2 - Google`, `3 - Instagram`, `4 - Evento` | Estado local |
| Permite agendar online? | `formState.permiteAgendarOnline` | Botao booleano | Nao | `true`/`false`; padrao `true` | Estado local |
| Status | `formState.status` | Botao enum | Nao | `ATIVO` ou `INATIVO`; padrao `ATIVO` | Estado local |
| Data de atualizacao | `formState.dataAtualizacao` | `text` | Nao | Placeholder `dd/mm/aaaa`; sem mascara aplicada no codigo atual | Estado local |

### Aba Documentacao

| Campo | Estado/chave | Tipo | Obrigatorio | Validacao/mascara | Destino/uso |
|---|---|---|---|---|---|
| Arquivos anexados | `uploadedDocuments[]` | `file` multiplo/drag-and-drop | Nao | Aceita `.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv` | Estado local com preview; nao persiste atualmente |
| Documentacao | `formState.documentacao` | `textarea` | Nao | Convertido para maiusculas | Estado local |

## Importacao Sistema Quer

Fontes: `src/components/SistemaQuerImportModal.tsx`, bloco legado em `SCR_MENUPRINCIPAL.tsx`, `api/import-lead.ts`, `server.ts`

### Modal atual reutilizavel

| Campo | Estado/chave | Tipo | Obrigatorio | Validacao/mascara | Destino/uso |
|---|---|---|---|---|---|
| Login | `credential.login` | `text` desabilitado | Sim | Valor padrao fixo no componente | Enviado para `/api/import-lead` |
| Senha | `credential.senha` | `password` desabilitado | Sim | Valor padrao fixo no componente | Enviado para `/api/import-lead` |
| URL da indicacao / ID | `credential.indicationId` | `text` numerico | Sim | Exatamente 6 digitos; preserva zeros a esquerda | Monta `leadUrl` no formato `http://sistemaquer.com.br/alterar-indicacao.php?indicacao_id=...` |

### Bloco legado no menu principal

| Campo | Estado/chave | Tipo | Obrigatorio | Validacao/mascara | Destino/uso |
|---|---|---|---|---|---|
| Login | `credential.login` | `text` | Sim | Sem mascara | Enviado para `/api/import-lead` |
| Senha | `credential.senha` | `password` | Sim | Sem mascara | Enviado para `/api/import-lead` |
| URL da indicacao | `credential.leadUrl` | `url` | Sim | Browser valida URL | Enviado para `/api/import-lead` |

### Dados retornados pela importacao

Tipo `SistemaQuerLeadData`:

| Campo importado | Destino no cadastro de cliente |
|---|---|
| `nome` | `formState.nome` |
| `telefone` | `contacts[0].value` e `contacts[0].type` |
| `email` | Novo contato do tipo `E-mail`, se valido |
| `cpf_cnpj` | `formState.cpf` se 11 digitos; `formState.cnpj` se 14 digitos |
| `nascimento` | `formState.dataNascimento` |
| `endereco` | `formState.enderecoRua` |
| `numero` | `formState.enderecoNumero` |
| `bairro` | `formState.enderecoBairro` |
| `cidade` | `formState.enderecoCidade` |
| `estado` | `formState.enderecoEstado` |
| `observacao` | `formState.observacoes` |
| `indicacao_id` | `formState.codigo` |
| `anuncio_url` | Thumbnail/visualizacao no modal |
| `vidas` | Exibicao no modal, nao aplicado ao formulario atual |

## Agenda

Fonte: `src/components/Agenda/AgendaSidebar.tsx` e atalho em `SCR_MENUPRINCIPAL.tsx`

### Sidebar da agenda

| Campo | Tipo | Obrigatorio | Validacao/mascara | Observacao |
|---|---|---|---|---|
| Data do calendario | `date` | Nao | Formato nativo `yyyy-mm-dd` | Atualiza `currentDate` e muda para visao mensal |
| Cliente | `text` | Nao | Sem estado/controlador no codigo atual | Campo visual de busca |
| Telefone | `text` | Nao | Placeholder `(__) ____-____`; sem mascara no codigo atual | Campo visual |
| Nascimento | `text` | Nao | Sem mascara no codigo atual | Campo visual |
| Servico | `text` | Nao | Sem estado/controlador no codigo atual | Campo visual |
| Data do agendamento | `text` | Nao | `defaultValue="03/04/2026"` | Campo visual |
| Hora | `text` | Nao | `defaultValue="00:00"` | Campo visual |
| Duracao | `select` | Nao | Opcao inicial `Duracao...` | Campo visual |
| Profissional/usuario | `select` | Nao | Opcao `FLAVIO ALMEIDA MATOS` | Campo visual |
| Observacao | `textarea` | Nao | Sem estado/controlador no codigo atual | Campo visual |
| Repetir? | `select` | Nao | Opcao inicial `Repetir?` | Campo visual |
| Frequencia | `select` | Nao | Opcao inicial `Nunca` | Campo visual |
| Status | `select` | Nao | Opcao inicial `Agendado` | Campo visual |
| Enviar SMS | Botoes Sim/Nao | Nao | Padrao visual em `Nao` | Campo visual |

### Agenda do dia no menu principal

| Campo | Tipo | Obrigatorio | Validacao/mascara | Observacao |
|---|---|---|---|---|
| Nova tarefa | `text` | Nao | Sem estado/controlador no codigo atual | Campo visual |
| Hora | `text` | Nao | Sem mascara | Campo visual |
| Min. | `text` | Nao | Sem mascara | Campo visual |

## Endpoints gerais que recebem dados

| Endpoint/origem | Metodo | Campos | Observacao |
|---|---|---|---|
| `server.ts` `/api/import-lead` | POST | `login`, `senha`, `leadUrl` | Endpoint Express usado no dev server |
| `api/import-lead.ts` | POST | `login`, `senha`, `leadUrl` | Function Vercel equivalente |
| Supabase Auth signup | SDK | `email`, `password`, `data.full_name`, `data.organization` | Criacao de conta |
| Supabase tabela `perfis` insert | SDK | `id`, `email`, `nome_completo`, `organizacao`, `avatar_url` | Criacao de perfil |
| Supabase Auth login | SDK | `email`, `password` | Login por senha |
| Supabase Auth OTP | SDK | `email`, `token` | Login por codigo |
| Supabase Auth reset | SDK | `email`, `redirectTo` | Recuperacao de senha |
| Supabase RPC `admin_update_user` | SDK/RPC | `p_id`, `p_nome`, `p_email`, `p_org`, `p_avatar_url`, `p_admin_hash` | Edicao administrativa |
| Supabase RPC `admin_delete_user` | SDK/RPC | `p_id`, `p_admin_hash` | Exclusao administrativa de perfil |

## Campos tecnicos/importantes por armazenamento

### Supabase `perfis`

| Campo | Origem |
|---|---|
| `id` | `signUpData.user.id` ou usuario selecionado |
| `email` | Cadastro/edicao administrativa |
| `nome_completo` | Cadastro/edicao administrativa |
| `organizacao` | Cadastro/edicao administrativa |
| `avatar_url` | Upload de avatar |

### Supabase `auditoria`

| Campo | Origem |
|---|---|
| `perfil_id` | Perfil encontrado por e-mail em recuperar senha |
| `acao` | Valor fixo `SOLICITAR_RESET_SENHA` |
| `detalhes.email` | E-mail informado no reset |

### LocalStorage

| Chave | Campo relacionado |
|---|---|
| `rcmolina_otp_cooldown` | Cooldown do OTP |
| `rcmolina_reset_cooldown` | Cooldown de recuperacao de senha |

## Pendencias visiveis no codigo

- Cadastro multipagina de cliente nao grava no Supabase ainda.
- Agenda possui campos visuais sem estado/controlador e sem persistencia.
- Bloco legado de importacao Sistema Quer no `SCR_MENUPRINCIPAL.tsx` ainda aceita login/senha/link livre, enquanto o modal atual usa login/senha desabilitados e ID de 6 digitos.
- Algumas mensagens/textos no codigo aparecem com encoding corrompido em arquivos fonte, mas isso nao altera a identificacao dos campos.
