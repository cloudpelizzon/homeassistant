/*
 * CloudPelizzon Segurança
 * CP-SECURITY 0.3.6
 *
 * - moradores por usuários ativos do Home Assistant
 * - sensores com renderização leve/lazy
 * - explicação de zonas
 * - padrão visual de sirene/luzes configurável
 * - destinatários móveis por morador/evento
 * - câmeras ignoradas/restauráveis
 */

(async () => {
  const TAG = "cloudpelizzon-security-panel";
  await customElements.whenDefined(TAG);

  const Klass = customElements.get(TAG);
  if (!Klass || Klass.prototype.__cpV036Installed) return;

  const p = Klass.prototype;
  p.__cpV036Installed = true;

  const EVENTOS = [
    ["alarme_armado", "Alarme armado"],
    ["alarme_desarmado", "Alarme desarmado"],
    ["alerta_entrada", "Alerta de entrada"],
    ["disparo", "Disparo"],
    ["panico", "Pânico"],
    ["bateria_baixa", "Bateria baixa"],
    ["dispositivo_offline", "Dispositivo offline"],
    ["boas_vindas", "Boas-vindas"],
  ];

  const norm = value =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const esc = value =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const arr = value => Array.isArray(value) ? value : [];

  function allEntities(host) {
    return Object.entries(host._hass?.states || {}).map(([id, st]) => ({
      id,
      domain: id.split(".")[0],
      name: st?.attributes?.friendly_name || id,
      state: String(st?.state || ""),
      attrs: st?.attributes || {},
      deviceClass: String(st?.attributes?.device_class || "").toLowerCase(),
      text: norm([
        id,
        st?.attributes?.friendly_name,
        st?.attributes?.device_class,
      ].filter(Boolean).join(" ")),
    }));
  }

  function ensure036(host) {
    const c = host._config || (host._config = {});

    c.descoberta ??= {};
    c.descoberta.ignorados ??= {};
    c.descoberta.ignorados.cameras ??= [];

    c.luzes_emergencia ??= {};
    c.luzes_emergencia.entidades ??= [];
    c.luzes_emergencia.padrao ??= {};
    c.luzes_emergencia.padrao.alternar_cores ??= true;
    c.luzes_emergencia.padrao.cor_primaria ??= "#ff0000";
    c.luzes_emergencia.padrao.cor_secundaria ??= "#00008b";
    c.luzes_emergencia.padrao.manter_ate_desarmar ??= true;
    c.luzes_emergencia.padrao.sincronizar ??= true;

    c.notificacoes ??= {};
    c.notificacoes.destinatarios_por_evento ??= {};

    c.boas_vindas ??= {};
    c.boas_vindas.celular_morador_que_chegou ??= true;
    c.boas_vindas.destinatarios_adicionais ??= [];

    c.video_porteiro ??= {};
    c.video_porteiro.cameras_monitoradas ??= [];

    c.moradores ??= [];
    c.dispositivos ??= [];
    c.zonas ??= [];
  }

  async function loadActiveUsers(host, force = false) {
    if (host._cpUsersLoading) return host._cpActiveUsers || [];
    if (!force && Array.isArray(host._cpActiveUsers)) return host._cpActiveUsers;

    host._cpUsersLoading = true;
    host._cpUsersError = "";

    try {
      const response = await host._hass.callWS({ type: "config/auth/list" });

      const raw =
        Array.isArray(response)
          ? response
          : Array.isArray(response?.users)
            ? response.users
            : Array.isArray(response?.result)
              ? response.result
              : [];

      host._cpActiveUsers = raw
        .filter(user => user)
        .filter(user => user.is_active !== false)
        .filter(user => user.system_generated !== true)
        .filter(user => norm(user.name || user.username || ""));

      return host._cpActiveUsers;
    } catch (error) {
      console.warn("CP-SECURITY: não foi possível listar usuários ativos.", error);
      host._cpUsersError = error?.message || String(error);
      host._cpActiveUsers = [];
      return [];
    } finally {
      host._cpUsersLoading = false;
    }
  }

  function usablePersons(host) {
    return allEntities(host)
      .filter(x => x.domain === "person")
      .filter(x => !x.text.includes("mqtt"))
      .filter(x => !x.text.includes("test"))
      .filter(x => !x.text.includes("teste"))
      .filter(x => !x.text.includes("dummy"));
  }

  function bestPersonForUser(host, user, used = new Set()) {
    const persons = usablePersons(host);
    const userName = norm(user.name || user.username || "");

    let exact = persons.find(x =>
      !used.has(x.id)
      && x.attrs?.user_id
      && String(x.attrs.user_id) === String(user.id)
    );
    if (exact) return exact;

    exact = persons.find(x =>
      !used.has(x.id)
      && norm(x.name) === userName
    );
    if (exact) return exact;

    const userTokens = userName.split(" ").filter(x => x.length >= 3);
    let best = null;
    let bestScore = 0;

    for (const person of persons) {
      if (used.has(person.id)) continue;
      const pt = new Set(norm(`${person.name} ${person.id}`).split(" "));
      const score = userTokens.reduce((sum, t) => sum + (pt.has(t) ? 1 : 0), 0);
      if (score > bestScore) {
        best = person;
        bestScore = score;
      }
    }

    return bestScore > 0 ? best : null;
  }

  function bestTrackerForName(host, name) {
    const keyTokens = norm(name).split(" ").filter(x => x.length >= 3);
    const trackers = allEntities(host)
      .filter(x => x.domain === "device_tracker")
      .filter(x =>
        ["iphone", "android", "celular", "telefone", "phone", "wifi", "mobile"]
          .some(k => x.text.includes(k))
      );

    let best = null;
    let bestScore = 0;

    for (const t of trackers) {
      const tt = new Set(norm(`${t.name} ${t.id}`).split(" "));
      let score = keyTokens.reduce((sum, token) => sum + (tt.has(token) ? 2 : 0), 0);
      if (t.state === "home") score += 0.25;
      if (score > bestScore) {
        best = t;
        bestScore = score;
      }
    }

    return bestScore >= 2 ? best : null;
  }

  function bestMobileNotify(host, name) {
    const services = Object.keys(host._hass?.services?.notify || {})
      .filter(x => x.startsWith("mobile_app_"));

    const keyTokens = norm(name).split(" ").filter(x => x.length >= 3);

    let best = "";
    let bestScore = 0;

    for (const service of services) {
      const st = new Set(norm(service).split(" "));
      const score = keyTokens.reduce(
        (sum, token) => sum + (st.has(token) ? 2 : 0),
        0
      );
      if (score > bestScore) {
        best = service;
        bestScore = score;
      }
    }

    return bestScore >= 2 ? `notify.${best}` : "";
  }

  function residentId(resident, index = 0) {
    return String(
      resident?.id
      || resident?.usuario_id
      || resident?.entidade_pessoa
      || `morador_${index}`
    );
  }

  function activeCameras(host) {
    ensure036(host);
    const ignored = new Set(host._config.descoberta.ignorados.cameras);

    return allEntities(host)
      .filter(x => x.domain === "camera")
      .filter(x => !ignored.has(x.id))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  function ignoredCameras(host) {
    ensure036(host);
    const ids = new Set(host._config.descoberta.ignorados.cameras);
    const byId = new Map(allEntities(host).map(x => [x.id, x]));

    return [...ids]
      .map(id => byId.get(id) || { id, name: id, state: "indisponível" })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  function linkedLights(host) {
    ensure036(host);
    return new Set(host._config.luzes_emergencia.entidades || []);
  }

  function candidateAlertLights(host) {
    return allEntities(host)
      .filter(x => x.domain === "light")
      .filter(x =>
        ["led", "fita", "strip", "alarme", "alerta", "emergencia", "emergency"]
          .some(k => x.text.includes(k))
      );
  }

  const previousAutodetect = p.autodetectar;

  p.autodetectar = async function() {
    ensure036(this);

    const ok = confirm(
      "A Inteligência CloudPelizzon irá revisar usuários ativos, moradores, "
      + "sensores, zonas, câmeras, luzes, voz e notificações.\n\n"
      + "Ela não salva automaticamente e o Modo Sombra continuará ativo.\n\n"
      + "Continuar?"
    );

    if (!ok) return;

    // Mantém a inteligência anterior para sensores/cerca/portões/voz,
    // mas a revisão abaixo substitui os pontos que exigem maior precisão.
    if (previousAutodetect) {
      try {
        const originalConfirm = window.confirm;
        window.confirm = () => true;
        await previousAutodetect.call(this);
        window.confirm = originalConfirm;
      } catch (error) {
        console.warn("CP-SECURITY: etapa anterior da autodetecção falhou.", error);
      }
    }

    ensure036(this);

    const users = await loadActiveUsers(this, true);
    const usedPersons = new Set();
    const oldResidents = arr(this._config.moradores);
    const residents = [];

    if (users.length) {
      for (const user of users) {
        const name = String(user.name || user.username || "").trim();
        if (!name) continue;

        const person = bestPersonForUser(this, user, usedPersons);
        if (person) usedPersons.add(person.id);

        const old = oldResidents.find(r =>
          String(r.usuario_id || "") === String(user.id)
          || (person && r.entidade_pessoa === person.id)
          || norm(r.nome) === norm(name)
        ) || {};

        const tracker = bestTrackerForName(this, name);
        const mobile = bestMobileNotify(this, name);
        const oldMobile = String(old.servico_celular || "");

        residents.push({
          ...old,
          id: old.id || `user_${String(user.id || name).replace(/[^a-z0-9]+/gi, "_")}`,
          usuario_id: user.id || "",
          nome: name,
          nome_voz: old.nome_voz || name,
          entidade_pessoa: person?.id || old.entidade_pessoa || "",
          entidade_wifi:
            String(old.entidade_wifi || "").startsWith("device_tracker.")
              ? old.entidade_wifi
              : (tracker?.id || ""),
          servico_celular:
            /^notify\.mobile_app_/i.test(oldMobile)
              ? oldMobile
              : mobile,
          habilitado: old.habilitado ?? true,
          participa_seguranca: old.participa_seguranca ?? true,
          desarmar_automaticamente: old.desarmar_automaticamente ?? true,
          participa_ausencia: old.participa_ausencia ?? true,
          receber_notificacoes: old.receber_notificacoes ?? true,
          boas_vindas: old.boas_vindas ?? true,
        });
      }
    } else {
      // Fallback: se a conta não permitir config/auth/list, preserva
      // moradores válidos e remove apenas registros claramente técnicos.
      for (const old of oldResidents) {
        const text = norm(`${old.nome} ${old.entidade_pessoa}`);
        if (text.includes("mqtt") || text.includes("dummy") || text.includes("test")) {
          continue;
        }
        residents.push(old);
      }
    }

    this._config.moradores = residents;

    // Câmeras: vincula todas as não ignoradas.
    const cameras = activeCameras(this);
    this._config.video_porteiro.cameras_monitoradas = cameras.map(x => x.id);

    if (
      this._config.video_porteiro.camera
      && !cameras.some(x => x.id === this._config.video_porteiro.camera)
    ) {
      this._config.video_porteiro.camera = "";
    }

    if (!this._config.video_porteiro.camera && cameras.length) {
      const preferred = cameras.find(x =>
        ["porteiro", "campainha", "doorbell", "entrada", "frente", "portao"]
          .some(k => x.text.includes(k))
      ) || cameras[0];

      this._config.video_porteiro.camera = preferred.id;
    }

    // Luzes: sugere somente dispositivos com forte evidência de serem LEDs/alerta.
    if (!(this._config.luzes_emergencia.entidades || []).length) {
      this._config.luzes_emergencia.entidades =
        candidateAlertLights(this).map(x => x.id);
    }

    // Destinatários: inicializa com moradores que realmente têm mobile_app.
    const eligible = residents
      .filter(r => /^notify\.mobile_app_/i.test(String(r.servico_celular || "")))
      .map((r, i) => residentId(r, i));

    for (const [key] of EVENTOS) {
      if (!Array.isArray(this._config.notificacoes.destinatarios_por_evento[key])) {
        this._config.notificacoes.destinatarios_por_evento[key] = [...eligible];
      }
    }

    this._config.geral ??= {};
    this._config.geral.modo_sombra = true;

    this._dirty = true;
    this.render();

    if (typeof this.toast === "function") {
      this.toast(
        `${users.length || residents.length} usuários/moradores, `
        + `${cameras.length} câmeras ativas e `
        + `${eligible.length} celulares configuráveis encontrados. `
        + "Revise e salve a configuração."
      );
    }
  };

  // ==========================================================
  // SENSORES - RENDER LEVE
  // ==========================================================
  const originalRenderSensores = p.renderSensores;

  p.renderSensores = function() {
    ensure036(this);

    const devices = arr(this._config.dispositivos);
    const filter = norm(this._cpSensorFilter || "");

    const indexes = devices
      .map((d, i) => ({ d, i }))
      .filter(({ d }) =>
        !filter
        || norm(`${d.nome} ${d.entidade} ${d.tipo} ${d.zona}`).includes(filter)
      );

    const selectedIndex = Number.isInteger(this._cpSensorEditIndex)
      ? this._cpSensorEditIndex
      : -1;

    const selected = devices[selectedIndex];

    const zoneOptions = [
      `<option value="">Sem zona</option>`,
      ...arr(this._config.zonas).map(z =>
        `<option value="${esc(z.nome)}" ${selected?.zona === z.nome ? "selected" : ""}>${esc(z.nome)}</option>`
      ),
    ].join("");

    const entityOptions = selected
      ? [
          `<option value="">Nenhuma entidade selecionada</option>`,
          ...allEntities(this)
            .filter(x => ["binary_sensor", "sensor"].includes(x.domain))
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
            .map(x =>
              `<option value="${esc(x.id)}" ${selected.entidade === x.id ? "selected" : ""}>`
              + `${esc(x.name)} • ${esc(x.id)}</option>`
            ),
        ].join("")
      : "";

    const rows = indexes.map(({ d, i }) => {
      const st = this._hass?.states?.[d.entidade];
      const state = st?.state ?? "sem estado";
      const offline = ["unknown", "unavailable"].includes(String(state).toLowerCase());

      return `
        <div class="cp-sensor-row">
          <div class="cp-sensor-main">
            <b>${esc(d.nome || d.entidade || `Sensor ${i + 1}`)}</b>
            <span>${esc(d.entidade || "sem entidade")}</span>
          </div>
          <span class="cp-chip">${esc(d.tipo || "outro")}</span>
          <span class="cp-chip">${esc(d.zona || "sem zona")}</span>
          <span class="cp-chip ${offline ? "warn" : "ok"}">${esc(state)}</span>
          <button class="secondary small" data-cp-sensor-edit="${i}">Editar</button>
        </div>
      `;
    }).join("");

    const editor = selected ? `
      <section class="config-card cp-sensor-editor">
        <div class="cp-editor-head">
          <div>
            <h3>Editar sensor</h3>
            <p>Somente o sensor aberto abaixo cria seletores completos, reduzindo bastante o tempo de carregamento.</p>
          </div>
          <button class="secondary small" data-cp-sensor-close>Fechar</button>
        </div>

        <div class="cp-form-grid">
          <label>Nome
            <input data-cp-sensor-field="nome" value="${esc(selected.nome || "")}">
          </label>

          <label>Tipo
            <select data-cp-sensor-field="tipo">
              ${["porta","janela","movimento","presenca","tamper","outro"].map(v =>
                `<option value="${v}" ${selected.tipo === v ? "selected" : ""}>${esc(v)}</option>`
              ).join("")}
            </select>
          </label>

          <label class="wide">Entidade
            <select data-cp-sensor-field="entidade">${entityOptions}</select>
          </label>

          <label>Zona
            <select data-cp-sensor-field="zona">${zoneOptions}</select>
          </label>
        </div>

        <div class="cp-toggle-grid">
          ${[
            ["habilitado","Sensor habilitado"],
            ["armado_parcial","Monitorar no Parcial"],
            ["armado_total","Monitorar no Total"],
            ["disparo_imediato","Disparo imediato"],
            ["monitorar_bateria","Monitorar bateria"],
            ["monitorar_tamper","Monitorar tamper"],
          ].map(([key,label]) => `
            <label class="cp-check">
              <input type="checkbox" data-cp-sensor-bool="${key}" ${selected[key] ? "checked" : ""}>
              <span>${esc(label)}</span>
            </label>
          `).join("")}
        </div>

        <button class="danger" data-cp-sensor-remove="${selectedIndex}">
          Remover sensor
        </button>
      </section>
    ` : "";

    return `
      ${typeof this.cardTitulo === "function"
        ? this.cardTitulo(
            "mdi:access-point",
            "Sensores e Dispositivos",
            "Lista otimizada: abra somente o sensor que deseja editar."
          )
        : "<h2>Sensores e Dispositivos</h2>"}

      <section class="cp-sensor-toolbar">
        <div>
          <strong>${devices.length} sensores cadastrados</strong>
          <span>${indexes.length} exibidos pelo filtro</span>
        </div>

        <input
          data-cp-sensor-search
          placeholder="Pesquisar nome, entidade, tipo ou zona..."
          value="${esc(this._cpSensorFilter || "")}">
      </section>

      ${editor}

      <section class="cp-sensor-list">
        ${rows || `<div class="cp-empty">Nenhum sensor encontrado.</div>`}
      </section>

      <button class="primary" data-cp-sensor-add>
        <ha-icon icon="mdi:access-point-plus"></ha-icon>
        Adicionar dispositivo
      </button>
    `;
  };

  function sensorBindings(host, root) {
    root.querySelector("[data-cp-sensor-search]")?.addEventListener("input", e => {
      host._cpSensorFilter = e.target.value;
      host.render();
    });

    root.querySelectorAll("[data-cp-sensor-edit]").forEach(btn => {
      btn.addEventListener("click", () => {
        host._cpSensorEditIndex = Number(btn.dataset.cpSensorEdit);
        host.render();
      });
    });

    root.querySelector("[data-cp-sensor-close]")?.addEventListener("click", () => {
      host._cpSensorEditIndex = -1;
      host.render();
    });

    root.querySelector("[data-cp-sensor-add]")?.addEventListener("click", () => {
      host._config.dispositivos.push({
        id: `manual_${Date.now()}`,
        nome: "Novo sensor",
        tipo: "outro",
        entidade: "",
        zona: "",
        habilitado: true,
        armado_parcial: true,
        armado_total: true,
        disparo_imediato: false,
        monitorar_bateria: true,
        monitorar_tamper: true,
      });
      host._cpSensorEditIndex = host._config.dispositivos.length - 1;
      host._dirty = true;
      host.render();
    });

    root.querySelectorAll("[data-cp-sensor-field]").forEach(input => {
      input.addEventListener("change", () => {
        const idx = host._cpSensorEditIndex;
        if (!host._config.dispositivos[idx]) return;
        host._config.dispositivos[idx][input.dataset.cpSensorField] = input.value;
        host._dirty = true;
      });
    });

    root.querySelectorAll("[data-cp-sensor-bool]").forEach(input => {
      input.addEventListener("change", () => {
        const idx = host._cpSensorEditIndex;
        if (!host._config.dispositivos[idx]) return;
        host._config.dispositivos[idx][input.dataset.cpSensorBool] = input.checked;
        host._dirty = true;
      });
    });

    root.querySelector("[data-cp-sensor-remove]")?.addEventListener("click", e => {
      const idx = Number(e.currentTarget.dataset.cpSensorRemove);
      host._config.dispositivos.splice(idx, 1);
      host._cpSensorEditIndex = -1;
      host._dirty = true;
      host.render();
    });
  }

  // ==========================================================
  // ZONAS
  // ==========================================================
  const ZONE_INFO = [
    {
      key: "perimetro",
      title: "Perímetro",
      icon: "mdi:vector-square",
      text: "Portas, janelas e acessos que formam a borda da residência. Normalmente permanece ativo tanto no Parcial quanto no Total.",
      difference: "Protege a entrada física sem depender de movimento interno.",
    },
    {
      key: "interior",
      title: "Interior",
      icon: "mdi:motion-sensor",
      text: "Sensores de movimento, presença e ocupação em áreas internas. Normalmente fica desligado no Parcial para permitir circulação dos moradores.",
      difference: "Protege deslocamentos dentro da residência principalmente no armamento Total.",
    },
    {
      key: "garagem",
      title: "Garagem",
      icon: "mdi:garage",
      text: "Portões, contatos e sensores da garagem. Pode possuir tempo de entrada para permitir a chegada antes do disparo.",
      difference: "Combina perímetro com uma política de entrada temporizada.",
    },
    {
      key: "seguranca tecnica",
      title: "Segurança Técnica",
      icon: "mdi:alert-decagram-outline",
      text: "Gás, fumaça, tamper e demais condições críticas que não dependem de presença de intrusos.",
      difference: "É crítica e pode permanecer monitorada independentemente do modo de armamento.",
    },
  ];

  function zoneInfoPanel(host, root) {
    if (!root || root.querySelector(".cp-zone-guide")) return;
    const text = norm(root.textContent);
    if (!text.includes("zonas de seguranca")) return;

    const panel = document.createElement("section");
    panel.className = "cp-zone-guide";
    panel.innerHTML = `
      <div class="cp-section-title">
        <div>
          <h3>Como funcionam as zonas</h3>
          <p>Cada zona existe para aplicar políticas diferentes a grupos de sensores.</p>
        </div>
      </div>
      <div class="cp-zone-grid">
        ${ZONE_INFO.map(z => `
          <article>
            <ha-icon icon="${z.icon}"></ha-icon>
            <div>
              <b>${z.title}</b>
              <p>${z.text}</p>
              <small><strong>Diferença:</strong> ${z.difference}</small>
            </div>
          </article>
        `).join("")}
      </div>
    `;

    const first = root.querySelector(".grid, .config-card");
    first?.parentElement?.insertBefore(panel, first);
  }

  // ==========================================================
  // SIRENE / LUZES
  // ==========================================================
  function emergencyLightsPanel(host, root) {
    if (!root || root.querySelector(".cp-light-pattern")) return;
    const text = norm(root.textContent);
    if (!text.includes("sirene e luzes de emergencia")) return;

    ensure036(host);

    const lights = allEntities(host)
      .filter(x => x.domain === "light")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    const selected = linkedLights(host);
    const pattern = host._config.luzes_emergencia.padrao;

    const panel = document.createElement("section");
    panel.className = "cp-light-pattern config-card";
    panel.innerHTML = `
      <div class="cp-section-title">
        <div>
          <h3>Padrão visual durante disparo</h3>
          <p>Configure quais luzes/LEDs piscam, quais cores alternam e quando o efeito deve parar.</p>
        </div>
        <span class="cp-preview-redblue"></span>
      </div>

      <div class="cp-form-grid">
        <label>Cor 1
          <input type="color" data-cp-light-setting="cor_primaria" value="${esc(pattern.cor_primaria || "#ff0000")}">
          <small>Primeira cor do ciclo. Padrão: vermelho.</small>
        </label>

        <label>Cor 2
          <input type="color" data-cp-light-setting="cor_secundaria" value="${esc(pattern.cor_secundaria || "#00008b")}">
          <small>Segunda cor do ciclo. Padrão: azul escuro.</small>
        </label>
      </div>

      <div class="cp-toggle-grid">
        ${[
          ["alternar_cores","Alternar entre as duas cores"],
          ["manter_ate_desarmar","Repetir continuamente até o alarme ser desarmado"],
          ["sincronizar","Sincronizar todas as luzes selecionadas"],
        ].map(([key,label]) => `
          <label class="cp-check">
            <input type="checkbox" data-cp-light-bool="${key}" ${pattern[key] ? "checked" : ""}>
            <span>${label}</span>
          </label>
        `).join("")}
      </div>

      <div class="cp-device-selector">
        <div class="cp-section-title compact">
          <div>
            <h3>Luzes participantes (${selected.size} selecionadas)</h3>
            <p>Marque exatamente quais LEDs/luzes devem participar do efeito de alarme.</p>
          </div>
          <div class="cp-inline-actions">
            <button class="secondary small" data-cp-light-candidates>Sugerir LEDs</button>
            <button class="secondary small" data-cp-light-clear>Limpar</button>
          </div>
        </div>

        <div class="cp-check-list">
          ${lights.map(light => `
            <label class="cp-device-check">
              <input type="checkbox" data-cp-light-entity="${esc(light.id)}" ${selected.has(light.id) ? "checked" : ""}>
              <span>
                <b>${esc(light.name)}</b>
                <small>${esc(light.id)} • estado: ${esc(light.state)}</small>
              </span>
            </label>
          `).join("")}
        </div>
      </div>

      <div class="cp-callout">
        O efeito utilizará os tempos <b>Tempo ligado (ms)</b> e <b>Tempo desligado (ms)</b>
        já configurados acima. Com “repetir até desarmar”, o ciclo continua enquanto o alarme estiver disparado.
      </div>
    `;

    const grid = root.querySelector(".grid");
    grid?.parentElement?.insertBefore(panel, grid.nextSibling);

    panel.querySelectorAll("[data-cp-light-setting]").forEach(input => {
      input.addEventListener("input", () => {
        pattern[input.dataset.cpLightSetting] = input.value;
        host._dirty = true;
      });
    });

    panel.querySelectorAll("[data-cp-light-bool]").forEach(input => {
      input.addEventListener("change", () => {
        pattern[input.dataset.cpLightBool] = input.checked;
        host._dirty = true;
      });
    });

    panel.querySelectorAll("[data-cp-light-entity]").forEach(input => {
      input.addEventListener("change", () => {
        const id = input.dataset.cpLightEntity;
        const set = linkedLights(host);
        input.checked ? set.add(id) : set.delete(id);
        host._config.luzes_emergencia.entidades = [...set];
        host._dirty = true;
        host.render();
      });
    });

    panel.querySelector("[data-cp-light-candidates]")?.addEventListener("click", () => {
      host._config.luzes_emergencia.entidades =
        candidateAlertLights(host).map(x => x.id);
      host._dirty = true;
      host.render();
    });

    panel.querySelector("[data-cp-light-clear]")?.addEventListener("click", () => {
      host._config.luzes_emergencia.entidades = [];
      host._dirty = true;
      host.render();
    });
  }

  // ==========================================================
  // NOTIFICAÇÕES POR MORADOR
  // ==========================================================
  function eligibleResidents(host) {
    return arr(host._config.moradores).map((r, index) => ({
      ...r,
      _id: residentId(r, index),
      _mobileOk: /^notify\.mobile_app_/i.test(String(r.servico_celular || "")),
    }));
  }

  function notificationMatrix(host, root) {
    if (!root || root.querySelector(".cp-recipient-matrix")) return;

    const text = norm(root.textContent);
    if (!text.includes("politica por evento")) return;

    ensure036(host);
    const residents = eligibleResidents(host);

    const panel = document.createElement("section");
    panel.className = "cp-recipient-matrix config-card";
    panel.innerHTML = `
      <div class="cp-section-title">
        <div>
          <h3>Destinatários móveis por evento</h3>
          <p>Cada coluna representa o celular de um morador. Assim cada evento pode avisar somente as pessoas necessárias.</p>
        </div>
      </div>

      ${residents.length ? `
        <div class="cp-matrix-scroll">
          <table class="cp-matrix">
            <thead>
              <tr>
                <th>Evento</th>
                ${residents.map(r => `
                  <th>
                    ${esc(r.nome || r.nome_voz || "Morador")}
                    <small>${r._mobileOk ? esc(r.servico_celular) : "sem mobile_app vinculado"}</small>
                  </th>
                `).join("")}
              </tr>
            </thead>
            <tbody>
              ${EVENTOS.map(([key,label]) => {
                const selected = new Set(
                  arr(host._config.notificacoes.destinatarios_por_evento[key])
                );
                return `
                  <tr>
                    <td><b>${esc(label)}</b></td>
                    ${residents.map(r => `
                      <td>
                        <input
                          type="checkbox"
                          data-cp-notify-event="${esc(key)}"
                          data-cp-notify-resident="${esc(r._id)}"
                          ${selected.has(r._id) ? "checked" : ""}
                          ${r._mobileOk ? "" : "disabled"}>
                      </td>
                    `).join("")}
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="cp-empty">Nenhum morador/celular cadastrado.</div>`}
    `;

    const policy = [...root.querySelectorAll(".config-card")]
      .find(card => norm(card.textContent).includes("politica por evento"));

    policy?.parentElement?.insertBefore(panel, policy.nextSibling);

    panel.querySelectorAll("[data-cp-notify-event]").forEach(input => {
      input.addEventListener("change", () => {
        const event = input.dataset.cpNotifyEvent;
        const resident = input.dataset.cpNotifyResident;
        const set = new Set(
          arr(host._config.notificacoes.destinatarios_por_evento[event])
        );

        input.checked ? set.add(resident) : set.delete(resident);

        host._config.notificacoes.destinatarios_por_evento[event] = [...set];
        host._dirty = true;
      });
    });
  }

  function welcomeRecipients(host, root) {
    if (!root || root.querySelector(".cp-welcome-recipients")) return;

    const text = norm(root.textContent);
    if (!text.includes("boas vindas")) return;
    if (!text.includes("banco de mensagens")) return;

    ensure036(host);
    const residents = eligibleResidents(host);
    const additional = new Set(arr(host._config.boas_vindas.destinatarios_adicionais));

    const panel = document.createElement("section");
    panel.className = "cp-welcome-recipients config-card";
    panel.innerHTML = `
      <div class="cp-section-title">
        <div>
          <h3>Celulares que recebem as boas-vindas</h3>
          <p>Defina se o próprio morador que chegou recebe a mensagem e quais outros celulares também devem ser avisados.</p>
        </div>
      </div>

      <label class="cp-check">
        <input
          type="checkbox"
          data-cp-welcome-self
          ${host._config.boas_vindas.celular_morador_que_chegou ? "checked" : ""}>
        <span>Enviar ao celular do próprio morador que chegou</span>
      </label>

      <div class="cp-check-list">
        ${residents.map(r => `
          <label class="cp-device-check">
            <input
              type="checkbox"
              data-cp-welcome-resident="${esc(r._id)}"
              ${additional.has(r._id) ? "checked" : ""}
              ${r._mobileOk ? "" : "disabled"}>
            <span>
              <b>${esc(r.nome || "Morador")}</b>
              <small>${r._mobileOk ? esc(r.servico_celular) : "sem serviço mobile_app vinculado"}</small>
            </span>
          </label>
        `).join("")}
      </div>
    `;

    const bank = [...root.querySelectorAll(".config-card")]
      .find(card => norm(card.textContent).includes("banco de mensagens"));

    if (bank?.parentElement) {
      bank.parentElement.insertBefore(panel, bank);
    } else {
      root.appendChild(panel);
    }

    panel.querySelector("[data-cp-welcome-self]")?.addEventListener("change", e => {
      host._config.boas_vindas.celular_morador_que_chegou = e.target.checked;
      host._dirty = true;
    });

    panel.querySelectorAll("[data-cp-welcome-resident]").forEach(input => {
      input.addEventListener("change", () => {
        const set = new Set(arr(host._config.boas_vindas.destinatarios_adicionais));
        const id = input.dataset.cpWelcomeResident;
        input.checked ? set.add(id) : set.delete(id);
        host._config.boas_vindas.destinatarios_adicionais = [...set];
        host._dirty = true;
      });
    });
  }

  // ==========================================================
  // CÂMERAS - IGNORAR / RESTAURAR
  // ==========================================================
  function cameraManager(host, root) {
    if (!root || root.querySelector(".cp-camera-manager-v036")) return;

    const text = norm(root.textContent);
    if (!text.includes("cameras e video porteiro")) return;

    ensure036(host);

    const active = activeCameras(host);
    const ignored = ignoredCameras(host);
    const linked = new Set(arr(host._config.video_porteiro.cameras_monitoradas));

    // Remove o painel V0.3.5 para não duplicar.
    root.querySelector(".cp-v035-camera-list")?.remove();

    const panel = document.createElement("section");
    panel.className = "cp-camera-manager-v036 config-card";
    panel.innerHTML = `
      <div class="cp-section-title">
        <div>
          <h3>Câmeras disponíveis (${active.length})</h3>
          <p>“Excluir da lista” não apaga a câmera do Home Assistant. Apenas faz o CP-SECURITY ignorá-la em futuras autodetecções.</p>
        </div>
      </div>

      <div class="cp-camera-cards">
        ${active.map(cam => `
          <article class="cp-camera-card">
            <div>
              <b>${esc(cam.name)}</b>
              <span>${esc(cam.id)}</span>
              <small>Estado: ${esc(cam.state)}</small>
            </div>
            <div class="cp-camera-actions">
              <span class="cp-chip ${linked.has(cam.id) ? "ok" : ""}">
                ${linked.has(cam.id) ? "Vinculada" : "Disponível"}
              </span>
              <button class="danger small" data-cp-camera-ignore="${esc(cam.id)}">
                Excluir da lista
              </button>
            </div>
          </article>
        `).join("") || `<div class="cp-empty">Nenhuma câmera disponível.</div>`}
      </div>

      ${ignored.length ? `
        <details class="cp-ignored">
          <summary>Câmeras ignoradas (${ignored.length})</summary>
          <div class="cp-camera-cards">
            ${ignored.map(cam => `
              <article class="cp-camera-card muted">
                <div>
                  <b>${esc(cam.name)}</b>
                  <span>${esc(cam.id)}</span>
                </div>
                <button class="secondary small" data-cp-camera-restore="${esc(cam.id)}">
                  Restaurar
                </button>
              </article>
            `).join("")}
          </div>
        </details>
      ` : ""}
    `;

    const first = root.querySelector(".grid, .config-card");
    first?.parentElement?.insertBefore(panel, first);

    panel.querySelectorAll("[data-cp-camera-ignore]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.cpCameraIgnore;
        const ignoredSet = new Set(host._config.descoberta.ignorados.cameras);
        ignoredSet.add(id);
        host._config.descoberta.ignorados.cameras = [...ignoredSet];

        host._config.video_porteiro.cameras_monitoradas =
          arr(host._config.video_porteiro.cameras_monitoradas)
            .filter(x => x !== id);

        if (host._config.video_porteiro.camera === id) {
          host._config.video_porteiro.camera = "";
        }

        host._dirty = true;
        host.render();
      });
    });

    panel.querySelectorAll("[data-cp-camera-restore]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.cpCameraRestore;
        host._config.descoberta.ignorados.cameras =
          arr(host._config.descoberta.ignorados.cameras)
            .filter(x => x !== id);
        host._dirty = true;
        host.render();
      });
    });
  }

  // ==========================================================
  // USUÁRIOS ATIVOS
  // ==========================================================
  function userStatusPanel(host, root) {
    if (!root || root.querySelector(".cp-user-source")) return;

    const text = norm(root.textContent);
    if (!text.includes("moradores")) return;
    if (!text.includes("cadastre quem participa")) return;

    const users = arr(host._cpActiveUsers);
    const panel = document.createElement("section");
    panel.className = "cp-user-source";
    panel.innerHTML = `
      <div>
        <strong>Fonte de moradores</strong>
        <span>
          ${host._cpUsersLoading
            ? "Consultando usuários ativos do Home Assistant..."
            : users.length
              ? `${users.length} usuários ativos encontrados no cadastro do Home Assistant.`
              : host._cpUsersError
                ? "Não foi possível consultar usuários; mantendo os moradores já cadastrados."
                : "Clique em Inteligência automática para sincronizar os usuários ativos."}
        </span>
      </div>
      <button class="secondary small" data-cp-refresh-users>
        Atualizar usuários
      </button>
    `;

    const first = root.querySelector(".cp-v035-inventory, .config-card");
    first?.parentElement?.insertBefore(panel, first);

    panel.querySelector("[data-cp-refresh-users]")?.addEventListener("click", async () => {
      await loadActiveUsers(host, true);
      host.render();
    });
  }

  // ==========================================================
  // CSS / UX
  // ==========================================================
  function addStyle(root) {
    if (root.querySelector("#cp-v036-style")) return;

    const style = document.createElement("style");
    style.id = "cp-v036-style";
    style.textContent = `
      .cp-user-source,
      .cp-sensor-toolbar,
      .cp-zone-guide,
      .cp-camera-manager-v036 {
        margin:0 0 18px;
        padding:14px 16px;
        border:1px solid #17516a;
        border-radius:14px;
        background:#061c27;
      }

      .cp-user-source,
      .cp-sensor-toolbar,
      .cp-section-title {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
      }

      .cp-user-source strong,
      .cp-sensor-toolbar strong {
        display:block;
        color:#f4fbff;
        margin-bottom:4px;
      }

      .cp-user-source span,
      .cp-sensor-toolbar span,
      .cp-section-title p,
      .cp-callout {
        color:#b9d5e3 !important;
        opacity:1 !important;
      }

      .cp-sensor-toolbar input {
        max-width:520px;
      }

      .cp-sensor-list {
        display:grid;
        gap:8px;
        margin-bottom:16px;
      }

      .cp-sensor-row {
        display:grid;
        grid-template-columns:minmax(240px,1fr) auto auto auto auto;
        gap:10px;
        align-items:center;
        padding:10px 12px;
        border:1px solid #123f55;
        border-radius:10px;
        background:#041821;
      }

      .cp-sensor-main b {
        display:block;
        color:#eefaff;
      }

      .cp-sensor-main span {
        display:block;
        color:#8fb7ca;
        font-size:11px;
        margin-top:3px;
        word-break:break-all;
      }

      .cp-chip {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:5px 8px;
        border-radius:999px;
        border:1px solid #22566c;
        color:#b9d5e3;
        font-size:10px;
        white-space:nowrap;
      }

      .cp-chip.ok {
        color:#7ef0bd;
        border-color:#1c7658;
      }

      .cp-chip.warn {
        color:#ffca76;
        border-color:#7e5a19;
      }

      .cp-form-grid {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:12px;
      }

      .cp-form-grid label {
        display:grid;
        gap:7px;
        color:#d8edf7 !important;
        font-weight:700;
        font-size:12px;
      }

      .cp-form-grid .wide {
        grid-column:1 / -1;
      }

      .cp-toggle-grid {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
        margin:14px 0;
      }

      .cp-check,
      .cp-device-check {
        display:flex;
        gap:10px;
        align-items:center;
        padding:10px 12px;
        border:1px solid #123f55;
        border-radius:10px;
        background:#041821;
      }

      .cp-check span {
        color:#dceff7;
      }

      .cp-device-check span {
        display:grid;
        gap:3px;
      }

      .cp-device-check b {
        color:#eaf8ff;
      }

      .cp-device-check small {
        color:#8fb7ca !important;
      }

      .cp-editor-head {
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        margin-bottom:14px;
      }

      .cp-zone-grid {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
      }

      .cp-zone-grid article {
        display:flex;
        gap:12px;
        padding:14px;
        border:1px solid #123f55;
        border-radius:12px;
        background:#041821;
      }

      .cp-zone-grid ha-icon {
        color:#39c5ff;
      }

      .cp-zone-grid b {
        color:#f2fbff;
      }

      .cp-zone-grid p {
        color:#b9d5e3 !important;
        line-height:1.45;
      }

      .cp-zone-grid small {
        color:#91b8ca !important;
        line-height:1.4;
      }

      .cp-preview-redblue {
        width:80px;
        height:14px;
        border-radius:999px;
        background:linear-gradient(90deg,#ff0000,#ff0000 48%,#00008b 52%,#00008b);
        box-shadow:0 0 18px rgba(255,0,0,.18),0 0 18px rgba(0,80,255,.18);
      }

      .cp-check-list,
      .cp-camera-cards {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
        gap:8px;
        margin-top:10px;
      }

      .cp-camera-card {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:12px;
        border:1px solid #123f55;
        border-radius:10px;
        background:#041821;
      }

      .cp-camera-card > div:first-child {
        display:grid;
        gap:3px;
        min-width:0;
      }

      .cp-camera-card b {
        color:#eefaff;
      }

      .cp-camera-card span,
      .cp-camera-card small {
        color:#8fb7ca;
        font-size:10px;
        word-break:break-all;
      }

      .cp-camera-actions,
      .cp-inline-actions {
        display:flex;
        align-items:center;
        gap:8px;
      }

      .cp-ignored {
        margin-top:14px;
      }

      .cp-ignored summary {
        color:#d7edf7;
        cursor:pointer;
        font-weight:700;
      }

      .cp-callout {
        margin-top:14px;
        padding:12px;
        border-left:3px solid #24b8ef;
        background:#041821;
        border-radius:8px;
        line-height:1.5;
      }

      .cp-matrix-scroll {
        overflow:auto;
      }

      .cp-matrix {
        width:100%;
        border-collapse:collapse;
        min-width:720px;
      }

      .cp-matrix th,
      .cp-matrix td {
        padding:10px;
        border-bottom:1px solid #123f55;
        text-align:center;
      }

      .cp-matrix th:first-child,
      .cp-matrix td:first-child {
        text-align:left;
        position:sticky;
        left:0;
        background:#061c27;
      }

      .cp-matrix th {
        color:#eefaff;
      }

      .cp-matrix th small {
        display:block;
        margin-top:4px;
        color:#8fb7ca !important;
        font-weight:400;
      }

      .small {
        padding:7px 10px !important;
        min-height:auto !important;
      }

      .cp-empty {
        padding:18px;
        color:#9fbdcc;
        text-align:center;
        border:1px dashed #20536a;
        border-radius:10px;
      }

      @media (max-width:900px) {
        .cp-sensor-row {
          grid-template-columns:1fr auto;
        }

        .cp-zone-grid,
        .cp-form-grid,
        .cp-toggle-grid {
          grid-template-columns:1fr;
        }

        .cp-form-grid .wide {
          grid-column:auto;
        }

        .cp-user-source,
        .cp-sensor-toolbar,
        .cp-section-title {
          align-items:stretch;
          flex-direction:column;
        }
      }
    `;

    root.appendChild(style);
  }

  function updateInventoryBanner(host, root) {
    const banner = root.querySelector(".cp-v035-inventory");
    if (!banner) return;

    const users = arr(host._cpActiveUsers).length;
    if (!users) return;

    const first = banner.querySelector("span");
    if (first && !norm(first.textContent).includes("usuarios ativos")) {
      first.textContent =
        `${users} usuários ativos • `
        + first.textContent.replace(/^\s*\d+\s+moradores\s*•\s*/i, "");
    }
  }

  function enhance(host) {
    const root = host.shadowRoot;
    if (!root || !host._config || !host._hass) return;

    ensure036(host);
    addStyle(root);

    sensorBindings(host, root);
    zoneInfoPanel(host, root);
    emergencyLightsPanel(host, root);
    notificationMatrix(host, root);
    welcomeRecipients(host, root);
    cameraManager(host, root);
    userStatusPanel(host, root);
    updateInventoryBanner(host, root);

    const text = norm(root.textContent);
    if (
      text.includes("moradores")
      && text.includes("cadastre quem participa")
      && !host._cpUsersLoading
      && !Array.isArray(host._cpActiveUsers)
    ) {
      loadActiveUsers(host).then(() => host.render());
    }
  }

  const originalRender = p.render;
  p.render = function(...args) {
    const result = originalRender.apply(this, args);
    queueMicrotask(() => enhance(this));
    return result;
  };

  // Atualiza a tela atual.
  for (const el of document.querySelectorAll(TAG)) {
    queueMicrotask(() => {
      ensure036(el);
      el.render();
    });
  }

  console.info("CP-SECURITY 0.3.6 carregado.");
})();
