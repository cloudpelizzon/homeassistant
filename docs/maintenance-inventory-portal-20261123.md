# Manutenção, Inventário e integração com o Portal

## Alterações

- Imagens de categorias, prévias inteiras, formulários e editores de Manutenção com escala consistente e altura útil.
- Inventário: cadastros/CMDB, tela cheia da rede, cômodos 2D/3D e casa completa; vínculos persistidos dos equipamentos preservados.
- Histórico em português, autoria e diferenças reais nas futuras edições, sem inventar dados antigos.
- Relatórios com logo original e cabeçalho institucional, oito gráficos próprios de equipamentos e seis próprios de relacionamentos/histórico; listas e Excel formatado.
- Prévia de mapas em tela cheia; zoom e recorte da rede; modelos detalhados, prioridade dos carros, fundo branco e remoção segura de margens na impressão 3D.
- Adaptadores públicos para exportação visual consentida, IDs estáveis, assinatura restrita e marca do equipamento.
- Atualização segura de abas com hashes de conteúdo e manifesto distribuído no próprio cliente. Não depende de ETags ou arquivos locais específicos de uma instalação. Editores abertos e campos modificados adiam a atualização.

O servidor do Portal e os motores proprietários ficam em repositório privado. Este PR não inclui bancos, mapas, fotos, concessões de plano, licenças ou configurações de instalação e não altera os sete binários comerciais assinados.

## Validação e limites

Testes sintéticos cobrem cabeçalhos, relatórios exclusivos, auditoria, zoom/recorte, veículos e restauração da cena. Conferência visual anterior do cliente é distinta de testes automatizados. O ganho de carregamento 3D não foi cronometrado. O relatório de relacionamentos conserva o recorte entregue por sua fonte, não presume cobrir a topologia inteira. Auditoria de uma edição real e abertura visual integral dos workbooks continuam verificações adicionais de release.

Atualizações do manifesto estático ainda exigem reinício do Home Assistant conforme o carregador atual. Nenhum dado pessoal deve ser restaurado para reverter interface.
