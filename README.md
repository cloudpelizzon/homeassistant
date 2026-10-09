# CloudPelizzon para Home Assistant

Integração CloudPelizzon para Home Assistant. Este repositório distribui o **bootstrap público** da integração, incluindo os componentes de inicialização, Core, Update Center e Security Agent necessários ao pacote-base.

## Instalação pelo HACS

1. Faça um backup do Home Assistant e, para a primeira instalação, prefira um ambiente de testes.
2. Confirme que o [HACS](https://www.hacs.dev/) já está instalado e configurado.
3. No HACS, abra o menu de três pontos e escolha **Repositórios personalizados (Custom repositories)**.
4. Informe `https://github.com/cloudpelizzon/homeassistant`, selecione o tipo **Integração (Integration)** e adicione.
5. Localize **CloudPelizzon** no HACS e instale a versão disponibilizada.
6. Reinicie o Home Assistant quando solicitado para carregar a integração.
7. Em **Configurações > Dispositivos e serviços**, procure **CloudPelizzon** e siga o fluxo de configuração disponível.

## Escopo da distribuição

Este repositório **não distribui o código comercial** dos módulos:

- **Energy** — Inteligência de Energia
- **Maintenance** — Manutenção Residencial
- **Security** — Central de Segurança

A presença de elementos demonstrativos ou pré-visualizações no Core não significa que o respectivo módulo comercial esteja incluído ou habilitado. A disponibilidade dos módulos depende dos processos de distribuição e autorização da CloudPelizzon.

## Atualizações e segurança

As atualizações do bootstrap público são distribuídas por este repositório e podem ser acompanhadas pelo HACS. Não substitua módulos comerciais por cópias não autorizadas nem publique credenciais, chaves, identificadores de instalações ou dados de clientes.

Para problemas relativos ao pacote público, utilize [Issues](https://github.com/cloudpelizzon/homeassistant/issues), sem incluir informações sensíveis.

Site: [cloudpelizzon.com.br](https://cloudpelizzon.com.br).
