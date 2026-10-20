# CP-LIGHTING — Adaptador WebSocket nativo (STAGING, sem registro automático)
Última alteração: 20/10/2026.

O arquivo `staging/lighting/native_ws.py` implementa o transporte dos comandos:
`cloudpelizzon/lighting/v1/snapshot` (somente leitura) e
`cloudpelizzon/lighting/v1/operation` (descoberta e configuração revisada).
Ele NUNCA é registrado pelo runtime público atual. O módulo continuará bloqueado
até um port privado fornecer `registration_ready()`, `installation_id()`,
`issue_grant(...)`, `read_page(...)`, `state_get(...)`, `execute(...)`,
**com verificação criptográfica real e provas independentes** por operação.

O frontend não envia ID de instalação nem ator. No WebSocket, o ator vem de
`connection.user`, é revalidado via `hass.auth.async_get_user` antes/depois
dos awaits e as entidades exigem `POLICY_READ`. Mudanças de sessão ou instalação
durante a chamada bloqueiam tudo; falhas são sanitizadas. `lighting.config.read`
é exclusivo do port nativo e da projeção do snapshot, não exposto como operação
direta do navegador. As outras sete operações públicas do serviço original
permanecem sujeitas à aprovação do gateway.

A descoberta recusa páginas que contenham entidades sem permissão e somente
libera `entity_id`, `name`, `kind` e `capabilities` validados. Sem suporte
a operações `lighting.device.*`, cenas físicas, Trial ou concessões geradas
pelo cliente. Para ativar, é obrigatório registrar o port privado assinado em
ambiente de homologação com validação de integridade e rollback previamente
aprovados; não editar allowlists do SDK público.

Testes sintéticos: `python3 -B staging/lighting/tests/test_native_ws.py`
(20 casos, sem HA/gateway real), além da suíte de `native_scope.py`.
**Não é uma implantação, release ou homologação funcional.**
