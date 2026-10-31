# Acompanhamento de testes por cliente e módulo — alpha.60

O Core envia observações dos módulos com o consentimento Fleet já registrado.
O relatório inclui o catálogo completo, a presença observada dos módulos e o
último status verificado pela autoridade. A coleta ocorre após a inicialização
do HA e a cada minuto, sem iniciar, renovar ou remover trials.

O identificador do Core e o identificador de trial são diferentes. A interface
administrativa associa os registros somente pelo vínculo oficial de enrollment,
com provas das duas identidades. Nome, e-mail ou semelhança de IDs não fazem essa
associação. Vínculos ambíguos permanecem separados para revisão.

As datas de início, bloqueio e remoção vêm do ledger da autoridade. O cliente
não calcula o início a partir do prazo final, do primeiro contato ou da instalação
de um módulo. Uma consulta indisponível é apresentada como não confirmada.
Presença no inventário não comprova operação física ou trial ativo.

## Atualização

1. No HACS, habilite pré-lançamentos e atualize CloudPelizzon para
   **7.0.0-alpha.60**. Na instalação manual, substitua somente a pasta da integração
   usando o pacote da release.
2. Reinicie o Home Assistant para carregar o Core atualizado.
3. Preserve a integração, os registros `.storage`, as identidades e as chaves
   locais. Não é necessário refazer o cadastro nem reiniciar um teste.
4. Com o consentimento Fleet existente, o próximo envio informará as observações.
   Clientes que não consentiram continuam sem envio; atualizar não concede
   consentimento automaticamente.

O servidor privado precisa do receptor de metadados e do coletor administrativo
correspondentes. Esses serviços, seus bancos, motores e credenciais não fazem
parte do repositório público ou do ZIP para clientes. O coletor consulta os
ledgers somente para leitura e gera uma projeção filtrada para a interface.

Publicar a release disponibiliza a atualização; não força sua instalação ou o
reinício do HA dos clientes. Instalações antigas podem ter suas datas já exibidas
pelo vínculo oficial, mas as novas observações exigem carregar esta versão.
