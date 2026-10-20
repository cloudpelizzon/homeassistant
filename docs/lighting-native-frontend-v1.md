# CP-LIGHTING | Frontend nativo V1 (somente desenvolvimento)
Última alteração: 20/10/2026. Não instalar, mesclar ou liberar.

**Arquitetura:** componente comercial `cloudpelizzon-lighting-panel` carregado pelo `cloudpelizzon-module-slot` dentro da integração CloudPelizzon. Sem `panel_custom`, sem rota externa, sem `hass.states`, `localStorage`, `/api/states` nem comandos diretos.

**Layouts aprovados:** Neo Soft: faixa de seis ambientes no topo, seis fotografias de luzes em cards e cenas laterais. FLUX: categorias, seis cômodos em grade 2×3, LEDs azul/roxo e lista de controles à direita. Grafite: menu esquerdo, cômodos em grade 2×3 e painel direito azul/dourado. **Configuração compartilhada** para os três temas. As imagens `frontend/assets/{room,light}-*.webp` e `ref-{neo,flux,grafite}.webp` estão no pacote privado separado; não entram no código-fonte público nesta revisão.

**Gateway privado necessário (NÃO instalado):**
- `cloudpelizzon/core/status`: só apresenta o módulo com licença assinada ou Trial real ativo de 7 dias por instalação/SKU, sem reset e expiração fail-closed.
- `cloudpelizzon/lighting/v1/snapshot`: entrega `{sku,configuration:{revision,rooms,items,total,preferences:{theme}},states}` com ACL nativa por usuário e entidade aplicada *antes* do envio.
- `cloudpelizzon/lighting/v1/operation`: recebe `{operation,parameters,request_id}`; identidade da instalação/ator e duas provas assinadas são obtidas e validadas exclusivamente no gateway. Operações atuais: `lighting.entities.discover`, `lighting.config.read`, `lighting.room.create`, `lighting.room.update`, `lighting.entity.bind`, `lighting.entity.configure`, `lighting.entities.assign_room`, `lighting.preferences.write`.

**Configuração existente:** `lighting_service.py` privado mantém um SQLite por instalação, revisão/concorrência, idempotência, confirmação explícita de switches e preferência de tema por usuário. O frontend chama as operações nativas; sem novo banco. Sensores de presença nunca são renderizados como luzes.

**Segurança:** quando o status comercial estiver ausente ou vencido, o módulo limpa dados e mostra somente Visão Geral e contratação. Ações de dispositivos físicos, cenas e dimmer ativo permanecem desabilitados: **não existe ainda contrato privado homologado para efeitos**. Não adicionar SKU à allowlist do SDK público sem atualização assinada da autoridade privada.

**Validação:** 19 testes Node + renderização de quatro páginas em Chromium com fixture exclusivamente sintética. Esse teste NÃO valida HA real, gateway, assinaturas, Trial ou dispositivos. HACS/CI só validam código público.

**Pendências:** gateway e Trial reais, renderização final com imagens no Release Center, confirmação de integridade de quatro arquivos críticos do CT104, efeitos individuais e cenas aprovados, favoritos/ordem/paginação persistente e aceite funcional na VM105. 