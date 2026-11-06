# Inventário — gratuito permanente e versão completa

O Inventário não tem Trial. O acesso gratuito permite manter até dez equipamentos, com cadastro básico local e seleção de dispositivos já registrados no Home Assistant. A versão gratuita não executa varreduras de rede, não deduz ligações, não cria a planta da casa e não exporta os relatórios comerciais.

Todos os menus permanecem visíveis. As funções comerciais mostram sua finalidade e ficam bloqueadas: mapa de rede, planta 2D/3D, coberturas, descoberta agendada, patrimônio e depreciação, conectores, manutenção, histórico, resolução de conflitos e impressão. Alterar um botão no navegador não disponibiliza o motor privado ausente do pacote.

Os dados básicos ficam no armazenamento privado do Home Assistant. O conector gratuito exige um administrador ativo, limita os cadastros no backend e não concede licenças nem inicia testes dos outros módulos.

## Versão completa

A versão completa depende de contratação, autorização comercial válida e instalação controlada do pacote privado compatível. O ZIP público inclui interfaces, adaptadores e verificadores; não inclui os motores comerciais, suas bibliotecas compiladas nem uma autorização de homologação. O fluxo de distribuição dos motores compilados continua controlado por instalação; a presença de uma licença na interface não prova que um pacote compatível já foi entregue.

Instalações que já possuem os pacotes comerciais compilados e seu cadastro de migração preservam as verificações de assinatura, identidade e permissões locais. O cliente público não cria esse cadastro de migração, não copia identidades de outra casa e não transforma uma instalação gratuita em licenciada.

No motor completo compatível, a depreciação anual considera os anos completos desde a aquisição e aplica o percentual sobre o saldo. O cálculo diário local atualiza o valor na data de aniversário, respeitando o fuso do HA. Valores manuais são preservados. O cálculo depende de valor, data de aquisição e percentual cadastrados.

## Atualização

No Marketplace / HACS, selecione a versão estável `7.0.0`, sem habilitar pré-lançamentos. Preserve `.storage`. Reinicie o HA e atualize a aba após salvar suas edições. Não reinstale a integração para reiniciar testes: o Inventário não tem Trial e os prazos dos outros módulos continuam controlados pela autoridade comercial.

O cliente possui escala compacta de desktop, equivalente a 67% com o navegador em 100%. Celulares e impressão mantêm escala própria. As capturas pessoais de uma instalação não fazem parte do repositório; uma galeria configurada localmente permanece pertencendo àquela instalação.

## Documentação

- [Manual do Inventário](https://documentacao.cloudpelizzon.com.br/modulos/inventario/manual)
- [Notas documentais do módulo](https://documentacao.cloudpelizzon.com.br/notas-de-versao/inventario/0-1-0-dev-r620)
- [Portal do Cliente](https://cliente.cloudpelizzon.com.br)

As notas documentais do módulo e a versão do cliente público são identificações independentes.
