# CP-LIGHTING — inventário HA vinculado ao usuário (não registrado)
Última alteração: 20/10/2026.

`staging/lighting/ha_inventory.py` implementa SOMENTE a fonte de leitura local do Home Assistant. Não registra painel, WebSocket ou rota HTTP, não executa serviços HA, não instala no gateway e não inicia Trial. Os arquivos em staging são públicos e não contêm motores comerciais.

## Fluxo obrigatório da integração
1. O usuário se autentica na sessão WebSocket nativa do HA. A integração determina `connection.user`, nunca aceita usuário/instalação enviados pelo navegador.
2. A fonte lê `hass.states.async_all()`, seleciona apenas `light.*`, `switch.*` e `binary_sensor.*` cujo `device_class` seja motion, occupancy ou presence; aplica `permissions.check_entity(entity_id, 'read')` ao usuário da conexão e ao usuário atual retornado por `hass.auth.async_get_user`, antes e depois da leitura.
3. A fonte descarta atributos HA arbitrários e entrega SOMENTE `entity_id`, `name` e, para presença, `device_class` — no contrato de entrada já aceito pelo motor privado `LightingConfiguration(..., inventory=...)`.
4. O gateway privado precisa receber esses dados **vinculados criptograficamente** à instalação, ao ator e à requisição, além de verificar as duas provas independentes e a licença/Trial corrente. Não aceitar inventário arbitrário vindo do browser. Até existir essa fronteira assinada, a fonte permanece desligada e nenhum resultado deve ser entregue ao cliente comercial.
5. O motor privado `lighting.entities.discover` classifica `light` como luz, `switch` como `review`, sensores de presença como sensor. A tela compartilhada apresenta switches para confirmação explícita antes de `lighting.entity.bind`; não promove sensores a lâmpadas.

A contagem total só inclui entidades autorizadas; não representa entidades desabilitadas ausentes do state machine do HA. O limite técnico é 2.000 entidades admitidas, com páginas de no máximo 100. Mudanças de permissões impedem a entrega de qualquer resposta parcial.

## Validação
`python3 -B tests/public-client/test_lighting_ha_inventory.py`: 16 testes sintéticos. Teste adicional privado local com o `lighting_service.py` original comprovou a interoperabilidade do formato, a separação de sensor e a confirmação obrigatória de `switch.*`. Nenhuma chamada real de dispositivo ou licença.

**Não autoriza disponibilizar CP-LIGHTING, Trial de 7 dias ou comandos físicos.** O CI/HACS público não prova a integridade do CT104, cujo baseline de segurança segue pendente.
