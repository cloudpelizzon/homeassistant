# Notas de versão

## 7.0.0-alpha.59 — estabilidade da telemetria

- Corrige bloqueios prolongados da interface do HA durante a coleta periódica de telemetria. A coleta passa a iterar o cadastro de dispositivos uma única vez e usa uma tabela local para os cruzamentos por entidade.
- Mantém compatibilidade com as versões que expõem o cadastro como mapeamento e com as que iteram os dispositivos diretamente. Não altera a seleção ou as contagens do diagnóstico.
- Filtra os manuais e notas de módulos na aba Atualizações pelas licenças confirmadas pelo servidor. Core e documentação geral permanecem disponíveis.
- Inclui regressões com 12.000 entidades e 1.000 dispositivos, preservando as contagens e rejeitando o uso das consultas obsoletas. Não inicia Trials nem modifica licenças ou cadastros.

## 7.0.0-alpha.58 — inicialização da Iluminação

- Remove o registro duplicado dos controles de Iluminação durante a inicialização do cliente público.
- Mantém um único responsável pelo registro e pela liberação dos comandos. Falhas de registro não deixam perfil ou comandos parciais pendurados.
- Inclui testes de inicialização conjunta do transporte e perfil, conflito com comando preexistente e a cadeia de registro do Runtime. Nenhum Trial ou dispositivo é acionado nos testes.

## 7.0.0-alpha.57 — atualização de instalações legadas

- Mantém a entrada existente, opções e arquivos locais; não exige excluir a integração para atualizar o cadastro técnico.
- Instalações antigas sem identidade SDK apresentam a confirmação nativa no Home Assistant. Sem consentimento não há provisionamento nem envio ao Fleet.
- A atualização exige uma identidade Core existente válida e não inicia ou renova Trials. Cadastros legados ficam preservados; conversão de dados entre motores precisa de validação própria.

## 7.0.0-alpha.56 — TRIAL — 26/10/2026

### Cliente e navegação

- Reúne as cinco interfaces desenvolvidas com seus adaptadores públicos, incluindo Iluminação.
- Reduz a renderização de módulos ocultos, agrega atualizações de estado e preserva a navegação mais recente.
- Mantém aberta a apresentação de um módulo durante atualizações em segundo plano, com navegação entre as apresentações e descrições correspondentes.
- Usa as imagens oficiais do catálogo e distingue Segurança Pro desenvolvida de Segurança base em desenvolvimento.
- Oferece controle de animações no cabeçalho, com preferência do navegador, e atualiza o diálogo de licenças e os links de documentação.
- Preserva os relatórios financeiros, exportações, topologia Solar e controles explícitos de Segurança e Automações.

### Iluminação

- Inclui GRAFITE, FLUX e NEO SOFT sobre uma configuração compartilhada.
- Conecta inventário, ambientes, cadastro e controles nativos do HA por adaptadores públicos que exigem autorização remota assinada.
- Verifica a integridade da interface pelo mesmo inventário fechado utilizado pelos demais módulos.
- Exclui o bootstrap privado exclusivo de homologação e a migração específica de relés de uma residência. Nenhuma configuração de cliente é usada como padrão.

### Distribuição e autorização

- Publica somente o cliente TRIAL; motores comerciais, dados e segredos permanecem privados.
- Mantém a ativação explícita, a autoridade remota, os prazos do teste, as permissões nativas e a separação entre Trial e licença paga.
- Inclui pacote de instalação HACS/manual, verificações SHA-256 e inventário de origem revisado.

### Serviços externos

O registro de interesses, os e-mails, o Portal e a documentação são serviços independentes. Suas correções não são cópias de código de servidor dentro do pacote HA. Esta distribuição utiliza esses serviços pelos canais já autorizados.

### Validação

Os resultados da validação desta versão constam nos checks do commit da release. Os testes não ativam Trials reais, não enviam e-mails nem comandam dispositivos. A versão permanece em pré-lançamento; não equivale a aceite físico de todos os equipamentos ou de todas as instalações de clientes.
