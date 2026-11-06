# CloudPelizzon para Home Assistant

![CloudPelizzon](custom_components/cloudpelizzon/ui/core/cloudpelizzon-logo.png)

## 7.0.1 — versão estável do cliente CloudPelizzon

O **Inventário** acrescenta cadastro gratuito permanente de até dez equipamentos, sem Trial. Inclui diagrama manual e planta 2D básica de até três cômodos em um andar. Organização automática, plantas avançadas/3D e demais funções comerciais permanecem bloqueadas até a contratação e instalação autorizada do motor privado. [Conheça os limites e a versão completa](docs/inventario-gratuito-alpha61.md).

Os testes dos cinco módulos anteriores continuam disponíveis nos seus fluxos próprios. Cliente público completo para os cinco módulos desenvolvidos: **Inteligência Solar, Manutenção Residencial Preventiva, Central de Segurança Pro, Central Inteligente de Automações e Iluminação Inteligente**. A Central de Segurança base e os demais módulos anunciados como em desenvolvimento continuam indisponíveis para instalação.

O pacote reúne as interfaces, os recursos visuais e os adaptadores de comunicação. Os motores comerciais do teste executam nos servidores privados da CloudPelizzon e não fazem parte deste repositório. Os identificadores técnicos legados de Segurança são preservados para compatibilidade com as autorizações assinadas; a apresentação comercial distingue a versão Pro já desenvolvida da versão base em desenvolvimento.

### Instalação pelo Marketplace / HACS

[![Abrir no Marketplace / HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=cloudpelizzon&repository=homeassistant&category=integration)

No HA 2026.11 ou posterior, use **Configurações → Marketplace**; em versões anteriores, use o HACS. O link acima oferece o cadastro do repositório personalizado quando ele ainda não existe na instalação.

1. Adicione `https://github.com/cloudpelizzon/homeassistant` como repositório personalizado do tipo **Integração**.
2. Selecione a versão estável **7.0.1**. Não é necessário habilitar pré-lançamentos. Quem já usa uma alpha pode atualizar pelo mesmo cadastro, preservando a integração e seus dados.
3. Baixe a integração e reinicie o Home Assistant.
4. Em **Configurações → Dispositivos e serviços → Adicionar integração**, procure **CloudPelizzon**.
5. Leia os consentimentos, conclua o cadastro e a vinculação da instalação e abra o painel CloudPelizzon.
6. Na Visão Geral, escolha um módulo disponível, confira os requisitos de conexão e confirme explicitamente o início do teste.

O arquivo `cloudpelizzon.zip` contém somente os arquivos da integração, com `manifest.json` na raiz. Para instalação manual, extraia seu conteúdo em `custom_components/cloudpelizzon/` e reinicie o HA. Preserve os dados existentes em `.storage`; não copie configurações ou chaves de outra instalação.

### Como funciona o teste

- Sete dias por módulo, segundo o prazo confirmado pelo serviço de autorização. Consultas de status, atualização, reinstalação e novo pareamento não reiniciam um teste.
- Instalar ou atualizar não ativa um teste nem concede licença paga. O cadastro e a identidade precisam ser aceitos pelo serviço CloudPelizzon.
- As operações exigem autorização assinada atual, vínculo da instalação e permissões do usuário no HA. Ler sensores e controlar dispositivos são permissões distintas.
- Iluminação usa uma configuração compartilhada entre **GRAFITE, FLUX e NEO SOFT**, com cadastro de ambientes, cenas e acesso às automações nativas do HA.
- Pedidos de módulos em desenvolvimento registram interesse; não representam compra nem instalação. A confirmação e o acompanhamento dependem dos serviços do Portal.
- Os módulos licenciados que exigem execução local continuam dependendo de seu pacote privado assinado, obtido pelos canais autorizados. Nenhum motor pago vem dentro deste ZIP.

### Segurança da distribuição

O pacote público não inclui chaves privadas, tokens, bancos de dados, configurações de clientes, automações pessoais ou motores proprietários. As chaves de identidade são geradas e armazenadas privadamente no HA; os verificadores do cliente contêm somente material público de verificação.

Cada versão inclui `SHA256SUMS` e um inventário fechado dos recursos da interface. Alterações de arquivos não correspondentes ao inventário são rejeitadas. A licença do repositório se aplica ao código público aqui distribuído; os componentes privados não integram esta distribuição.

Esta é a versão estável do cliente público. O Inventário Free não tem Trial; os testes opcionais dos outros módulos continuam com os prazos e permissões comerciais existentes. Atualizar não inicia nem renova testes. O pacote pago compatível continua separado do ZIP público. As notas registram os testes e seus limites: a validação automatizada não substitui a conferência dos dispositivos de cada residência.

[Notas de versão](CHANGELOG.md) · [Segurança](SECURITY.md) · [Site](https://cloudpelizzon.com.br) · [Documentação](https://documentacao.cloudpelizzon.com.br) · [Portal do Cliente](https://cliente.cloudpelizzon.com.br)

Acompanhamento por cliente e módulo: veja [o guia da alpha.60](docs/acompanhamento-trials-alpha60.md). As datas de trials vêm da autoridade e não são reiniciadas pela atualização.


## 7.0.1 — mapas básicos no Inventário Free

- O Free abre um diagrama real de até dez equipamentos, com posições e ligações manuais salvas localmente. Clique no equipamento para editar seu cadastro.
- Planta 2D de um andar com até três cômodos editáveis: nome, medidas, alocação e movimentação dos equipamentos.
- Cadastro básico simplificado, incluindo tipo, IP, fabricante, modelo, série e observações. Seleção dos dispositivos já registrados no HA preservada.
- Organização automática, plantas avançadas/3D, impressão, descoberta ativa e demais integrações continuam exclusivos da versão completa. O Free não tem Trial e não inclui motores comerciais.
- Validação no servidor dos limites, vínculos e coordenadas; gravação atômica com revisão para impedir sobrescrita silenciosa entre sessões.
