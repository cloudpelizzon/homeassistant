# CP-LIGHTING — fronteira de leitura nativa (candidata, sem registro)

Última alteração: 19/10/2026. **Somente staging**. Não habilita o módulo no HACS, não cria rota WebSocket/HTTP, não instala biblioteca no HA, não aciona dispositivos, não ativa licenças/Trial, não altera `main` nem servidores.

## Origem e contrato

- Base revisada: `Iluminacao_03_Revisao.json` e os cinco fontes privados fornecidos; a operação de leitura já existente é `lighting.config.read`, paginada (`offset`, `limit<=100`), com `revision`, `rooms`, `items`, `total` e `preferences`.
- `staging/lighting/native_scope.py` é um **adaptador público inativo**. Ele não implementa a assinatura Ed25519, política comercial, servidor SQLite nem motor de dispositivos. Esses permanecem privados. Código-fonte privado e chaves nunca devem entrar neste repositório público.
- `NativeLightingReadScope(installation_id, issue_grant, read_page, state_get)` aceita apenas provedores confiáveis, injetados pelo host nativo. Não existe registro automático nem acesso via mensagem do navegador.
- `connection.user` fornece a identidade autenticada. `installation_id()` obtém a instalação do runtime privado (não da UI). IDs informados em mensagens não são usados para selecionar ator ou instalação.
- A permissão de entidade é a política nativa `POLICY_READ` do HA (`"read"`), compatível com a verificação usada pelos endpoints internos `get_states`. O host precisa revisar e ligar o adaptador usando o usuário da conexão atual, sem substituir por uma conta de serviço ampla.

## Dependências bloqueantes

1. `issue_grant(iid, actor_id, operation)` **deve validar assinatura real, readiness, titularidade, validade, revogação e autorização corrente no gateway privado**. O objeto retornado é um indício **somente de apresentação**, jamais uma autorização emitida pelo próprio cliente. Os testes sintéticos não fornecem essa segurança.
2. `read_page(iid, actor_id, {offset,limit}, request_id)` deve passar pelo SDK assinado e pelo motor privado existente de configuração. O contrato já utiliza duas provas independentes; este adaptador **não cria nem falsifica provas**. O host não pode substituir o SDK por uma leitura direta desprotegida do banco.
3. `state_get(id)` deve ser a leitura local nativa (`hass.states.get`) e nunca uma chamada de serviço `turn_on`/`turn_off` ou busca remota sem a permissão do usuário.
4. Antes de qualquer registro real, rever política de usuários, autorização de entidades, sessões WebSocket, cancelamento, licenciamento e bloqueio após expiração. O SDK público atualmente não autoriza CP-LIGHTING; **não expandir a allowlist** sem o gateway privado correspondente.

## Garantias verificadas em testes sintéticos

- Fail-closed para ator ausente/inativo, usuário de sistema, instalação inválida, troca de usuário/instalação, desconexão, ausência de concessão válida, mudança de concessão e erro do provedor.
- Nova verificação da concessão assinada antes de cada página e após leitura; nenhum dado parcial retorna na falha. Solicitações paginadas recebem IDs novos. Limites: até 2.000 vínculos, 100 por página e 512 KiB por resposta; não são limites comerciais.
- Entidades sem `POLICY_READ` **não recebem estado nem metadados**, nomes locais, ícones ou nomes de cômodos. `total` é recalculado após o filtro; os cômodos não referenciados são omitidos.
- Vínculos autorizados com estado ausente permanecem visíveis ao cliente como indisponíveis. As luzes ocultas não disparam leitura do estado; switches cadastrados não se transformam em entidades `light.*`.
- Do estado retornado pelo HA, somente atributos de iluminação permitidos são copiados. Localização, identificadores de dispositivo, histórico, mensagens de erro, secrets e outros atributos não são enviados ao navegador.

O resultado segue o contrato que `staging/lighting/read-session.mjs` já consome: `{sku, grant, states, configuration}`. Nenhum dado sai de staging até aprovação de identidade/sessão nativas e política de autorização privada.

## Critério de aceite futuro

Validar em HA homologação e servidor privado reais: ausência de provedor, revogação instantânea, troca de usuário/instalação, ator sem permissão de entidade, Trial 7 dias e expiração, desconexão, restart, paginação >100 itens e integridade de resposta. Reexecutar a suíte assinada original; os testes locais deste incremento não a substituem.

**Sem instalação, merge, release, tag, publicação estável ou ativação comercial nesta etapa.** O PR deve permanecer em rascunho.
