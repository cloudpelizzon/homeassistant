# CloudPelizzon para Home Assistant

![CloudPelizzon](custom_components/cloudpelizzon/ui/core/cloudpelizzon-logo.png)

## TRIAL — 7.0.0-alpha.60

Cliente público completo para os cinco módulos desenvolvidos: **Inteligência Solar, Manutenção Residencial Preventiva, Central de Segurança Pro, Central Inteligente de Automações e Iluminação Inteligente**. A Central de Segurança base e os demais módulos anunciados como em desenvolvimento continuam indisponíveis para instalação.

O pacote reúne as interfaces, os recursos visuais e os adaptadores de comunicação. Os motores comerciais do teste executam nos servidores privados da CloudPelizzon e não fazem parte deste repositório. Os identificadores técnicos legados de Segurança são preservados para compatibilidade com as autorizações assinadas; a apresentação comercial distingue a versão Pro já desenvolvida da versão base em desenvolvimento.

### Instalação pelo HACS

1. Adicione `https://github.com/cloudpelizzon/homeassistant` como repositório personalizado do tipo **Integração**.
2. Habilite a exibição de versões de pré-lançamento e selecione **7.0.0-alpha.60**.
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

Esta é uma versão de pré-lançamento TRIAL, não uma versão estável. As notas de versão registram os testes realizados e suas limitações; validação automatizada não substitui o aceite da instalação, das integrações e dos dispositivos de cada residência.

[Notas de versão](CHANGELOG.md) · [Segurança](SECURITY.md) · [Site](https://cloudpelizzon.com.br) · [Documentação](https://documentacao.cloudpelizzon.com.br) · [Portal do Cliente](https://cliente.cloudpelizzon.com.br)

Acompanhamento por cliente e módulo: veja [o guia da alpha.60](docs/acompanhamento-trials-alpha60.md). As datas de trials vêm da autoridade e não são reiniciadas pela atualização.
