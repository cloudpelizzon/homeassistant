# Atualização TRIAL 7.0.0-alpha.59

## O que esta versão corrige

A coleta periódica enumera o cadastro de dispositivos uma vez e cruza as entidades em memória. Isso evita as consultas obsoletas que bloqueavam o loop principal em instalações grandes e interrompiam a conexão de toda a interface do Home Assistant. As contagens e a seleção do diagnóstico foram preservadas.

Na aba Atualizações, os manuais e notas de módulos seguem as licenças confirmadas pelo servidor. Sem confirmação, a interface não presume contratação. Core e documentação geral continuam disponíveis.

O cliente mantém a distinção entre módulo contratado, pacote instalado, teste disponível, teste ativo, teste encerrado e consulta pendente. Para Iluminação, uma resposta recente e verificada pode oferecer o teste de sete dias mesmo quando o catálogo estático ainda descreve uma proposta futura. Abrir a tela ou atualizar o status não inicia o prazo.

## Como atualizar e conferir

1. Faça um backup do Home Assistant e confira sua conclusão antes de atualizar.
2. Atualize a integração pelo HACS ou instale o pacote desta pré-versão pelo procedimento habitual. Não exclua a entrada da integração, a pasta `.storage`, a identidade ou os cadastros para aplicar esta correção.
3. Reinicie o Home Assistant quando solicitado pelo instalador. Atualize a página do navegador para carregar os arquivos novos.
4. Confira a licença e a identidade da instalação na aba Licença. Uma licença ativa pode exigir a instalação explícita do pacote comercial antes de habilitar seu menu.
5. Confira se os manuais de Atualizações correspondem aos módulos contratados. Uma consulta sem resposta não comprova cancelamento da licença.
6. Em Iluminação, confira a oferta de teste antes de optar por iniciá-lo. A ativação exige confirmação explícita, preparação nativa e autorização remota. Um prazo já iniciado não é reiniciado pela atualização.
7. Acompanhe a conexão do HA durante vários ciclos de coleta. A disponibilidade de entidades é um indicador separado: esta correção não converte sensores indisponíveis em saudáveis.

## Portal e serviços privados

O Portal, o serviço de licenças, a autoridade de Trial, o Fleet e o envio de e-mails são serviços independentes do pacote HA. As correções aplicadas nesses serviços permanecem nesses serviços; instalar este ZIP não instala um servidor Portal nem migra contas de clientes.

Foi validado um reparo operacional de vínculo entre cadastro comercial, instalação e telemetria. Após a confirmação de propriedade, o Portal voltou a apresentar os indicadores, as versões e somente os módulos contratados da instalação correta. O reparo preservou a instalação anterior, credenciais, plano, licenças e prazos de Trial. Nenhum identificador, backup, chave ou cadastro real faz parte desta distribuição. A prevenção genérica de vínculos legados incompletos permanece uma tarefa do serviço privado.

A elegibilidade de novas instalações para Iluminação foi corrigida na autoridade privada, mantendo as verificações de identidade, vínculo, assinatura, revogação e prazo. Esta distribuição usa a resposta verificada dessa autoridade; ela não contém sua implementação nem concede um teste localmente.

O Portal mantém o histórico e as respostas aos próprios chamados existentes. Abrir novos chamados exige plano ativo ou horas disponíveis. Uma licença de módulo não equivale a contratação de suporte. Negações de acesso em formulários HTML são tratadas por navegação do Portal; APIs continuam retornando a negativa apropriada.

## Validação e limites

Os checks do commit verificam os arquivos públicos, os hashes, os contratos de interface e a suíte nativa isolada. Os testes usam identidades e respostas sintéticas, sem enviar e-mails, iniciar Trials reais ou comandar equipamentos. Os checks não substituem a aceitação de cada instalação.

A oferta de teste de Iluminação, a filtragem de documentação e a navegação do Portal foram confirmadas em produção. A execução de um Trial real de Iluminação depende do início voluntário e de validação própria. Esta versão continua sendo uma pré-versão TRIAL.

Permanece em revisão a apresentação da versão e da confirmação de instalação local de alguns pacotes comerciais na aba Atualizações. O indicador de pacote não substitui a verificação do instalador e não deve ser usado isoladamente para concluir que uma licença ou um runtime foram perdidos.
