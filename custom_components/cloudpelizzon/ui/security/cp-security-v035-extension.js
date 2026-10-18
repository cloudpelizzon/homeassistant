/*
 * CloudPelizzon Segurança
 * CP-SECURITY 0.3.5
 */
(async () => {
  const TAG = "cloudpelizzon-security-panel";
  await customElements.whenDefined(TAG);

  const Klass = customElements.get(TAG);
  if (!Klass || Klass.prototype.__cpV035Installed) return;

  const p = Klass.prototype;
  p.__cpV035Installed = true;

  const DEFAULT_MESSAGES = {
  "manha": [
    "Bom dia. Que bom ter você de volta. Que sua manhã continue leve e tranquila.",
    "Bem-vindo de volta. Aproveite o começo do dia com conforto e tranquilidade.",
    "Que bom receber você nesta manhã. Que o restante do dia comece da melhor forma.",
    "Sua casa reconheceu sua chegada. Tenha uma manhã agradável e produtiva.",
    "Bem-vindo ao lar. Que esta manhã traga calma, energia e bons momentos.",
    "Que alegria ter você de volta. Aproveite a tranquilidade da sua casa nesta manhã.",
    "Chegada confirmada. Que seu dia siga com segurança, conforto e boas notícias.",
    "Bom dia e bem-vindo. A casa está pronta para receber você.",
    "Que esta manhã fique ainda melhor agora que você chegou em casa.",
    "Bem-vindo de volta. Respire, desacelere e aproveite o conforto do lar.",
    "Sua chegada foi confirmada. Que você tenha uma excelente manhã em casa.",
    "Que bom saber que você chegou bem. Aproveite cada momento desta manhã.",
    "Bom dia. Entre, fique à vontade e aproveite um começo de dia mais tranquilo.",
    "A casa está novamente com você. Que sua manhã seja leve e cheia de boas energias.",
    "Bem-vindo ao seu espaço. Que esta manhã seja confortável, segura e especial."
  ],
  "tarde": [
    "Boa tarde. Que bom ter você de volta. Aproveite o restante do dia em casa.",
    "Bem-vindo de volta. Que sua tarde seja tranquila, confortável e agradável.",
    "Sua chegada foi confirmada. Aproveite uma tarde leve no conforto do lar.",
    "Que bom saber que você chegou bem. Tenha uma excelente tarde em casa.",
    "Boa tarde e bem-vindo. A casa está pronta para receber você.",
    "Agora é hora de aproveitar a tranquilidade de estar em casa. Boa tarde.",
    "Bem-vindo ao lar. Que o restante da tarde seja cheio de bons momentos.",
    "Sua casa reconheceu sua chegada. Que esta tarde seja ainda melhor.",
    "Que alegria receber você novamente. Aproveite sua tarde com calma e conforto.",
    "Boa tarde. Entre, relaxe e aproveite o ambiente da sua casa.",
    "Chegada confirmada. Que sua tarde siga tranquila e segura.",
    "Bem-vindo de volta. Que não faltem conforto e bons momentos nesta tarde.",
    "A casa ficou mais completa com sua chegada. Tenha uma ótima tarde.",
    "Que bom receber você. Aproveite o restante do dia com tranquilidade.",
    "Boa tarde. Seu lar está pronto para acolher você mais uma vez."
  ],
  "noite": [
    "Boa noite. Que bom ter você de volta. Agora é hora de aproveitar o conforto de casa.",
    "Bem-vindo de volta. Que sua noite seja tranquila, segura e agradável.",
    "Sua chegada foi confirmada. Aproveite uma noite de descanso no seu lar.",
    "Que bom saber que você chegou bem. Tenha uma excelente noite em casa.",
    "Boa noite e bem-vindo. A casa está pronta para receber você.",
    "Agora é hora de desacelerar. Aproveite a tranquilidade e o conforto da sua casa.",
    "Bem-vindo ao lar. Que sua noite seja leve e cheia de bons momentos.",
    "Sua casa reconheceu sua chegada. Aproveite uma noite tranquila.",
    "Que alegria receber você novamente. Descanse e aproveite seu espaço.",
    "Boa noite. Entre, relaxe e deixe a casa cuidar do restante.",
    "Chegada confirmada. Que sua noite siga segura e confortável.",
    "Bem-vindo de volta. Que este seja um ótimo momento para descansar.",
    "A casa ficou mais completa com sua chegada. Tenha uma ótima noite.",
    "Que bom receber você. Aproveite a calma do lar nesta noite.",
    "Boa noite. Seu lar está pronto para acolher você novamente."
  ],
  "geral": [
    "Bem-vindo de volta. Que bom saber que você chegou bem.",
    "Chegada confirmada. Sua casa está pronta para receber você.",
    "Que bom ter você de volta. Aproveite o conforto e a tranquilidade do lar.",
    "Bem-vindo ao seu espaço. A casa reconheceu sua chegada.",
    "Você chegou. Entre, fique à vontade e aproveite sua casa.",
    "Que alegria receber você novamente. Seja muito bem-vindo.",
    "Sua presença foi confirmada. Aproveite seu lar com tranquilidade.",
    "Bem-vindo de volta. Tudo preparado para você aproveitar a casa.",
    "Chegada reconhecida. Que seus próximos momentos em casa sejam excelentes.",
    "Que bom saber que você está em casa novamente. Seja bem-vindo.",
    "Sua casa ficou mais completa com sua chegada.",
    "Bem-vindo. Aproveite cada momento no conforto do seu lar.",
    "Tudo certo por aqui. Sua chegada foi reconhecida com sucesso.",
    "É sempre bom voltar para casa. Seja muito bem-vindo.",
    "Chegada confirmada com segurança. Aproveite seu espaço."
  ],
  "familia": [
    "A família chegou. Que bom ter todos de volta em casa.",
    "Bem-vindos de volta. A casa ficou mais completa com a chegada de vocês.",
    "Que alegria receber vocês juntos novamente. Aproveitem o lar.",
    "Chegada em família confirmada. Que os próximos momentos sejam especiais.",
    "Lar doce lar. Que bom saber que vocês chegaram bem.",
    "A casa reconheceu a chegada de vocês. Sejam muito bem-vindos.",
    "A família está novamente em casa. Aproveitem cada momento juntos.",
    "Que felicidade receber vocês de volta com segurança.",
    "Agora sim a casa ganhou novamente aquele clima de família reunida.",
    "Bem-vindos ao lar. Que esta chegada marque o início de ótimos momentos.",
    "Todos chegaram bem. Aproveitem o conforto e a tranquilidade da casa.",
    "A casa ficou mais alegre com a chegada de vocês.",
    "Sejam muito bem-vindos. O lar está pronto para receber toda a família.",
    "É sempre especial quando a família retorna para casa em segurança.",
    "Chegada em grupo confirmada. Aproveitem o tempo juntos e sintam-se em casa."
  ]
};

  const norm = value =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const tokens = value =>
    norm(value).split(" ").filter(x => x.length >= 2);

  function entityInfo(host, id) {
    const st = host._hass?.states?.[id];
    return {
      id,
      domain: String(id).split(".")[0],
      name: st?.attributes?.friendly_name || id,
      state: String(st?.state || ""),
      attrs: st?.attributes || {},
      text: norm([
        id,
        st?.attributes?.friendly_name,
        st?.attributes?.device_class,
      ].filter(Boolean).join(" ")),
      deviceClass: String(st?.attributes?.device_class || "").toLowerCase(),
    };
  }

  function all(host) {
    return Object.keys(host._hass?.states || {})
      .map(id => entityInfo(host, id));
  }

  function isTechnicalPerson(x) {
    const t = norm(`${x.id} ${x.name}`);
    return (
      t.includes("mqtt")
      || t.includes("test")
      || t.includes("teste")
      || t.includes("dummy")
      || t.includes("service account")
      || /^person user(?: |$)/.test(t)
      || /^user(?: |$)/.test(norm(x.name))
      || norm(x.name) === norm(x.id.replace("person.", ""))
    );
  }

  function personKey(x) {
    return norm(x.name).replace(/\b[0-9]+\b/g, "").trim();
  }

  function personScore(x) {
    let score = 0;
    if (x.attrs?.user_id) score += 8;
    if (!/_\d+$/.test(x.id)) score += 12;
    if (["home", "not_home"].includes(x.state)) score += 3;
    if (personKey(x) && norm(x.id).includes(personKey(x))) score += 2;
    if (isTechnicalPerson(x)) score -= 100;
    return score;
  }

  function canonicalPersons(host) {
    const persons = all(host)
      .filter(x => x.domain === "person")
      .filter(x => !isTechnicalPerson(x));

    const groups = new Map();

    for (const x of persons) {
      const key = personKey(x) || norm(x.id);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(x);
    }

    const selected = [];

    for (const group of groups.values()) {
      group.sort((a, b) => personScore(b) - personScore(a));
      selected.push(group[0]);
    }

    return selected.sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR")
    );
  }

  function exactTokenScore(person, candidateText) {
    const pt = tokens(
      `${person.name} ${person.id.replace("person.", "")}`
    ).filter(x => x.length >= 3);

    const ct = new Set(tokens(candidateText));
    return pt.reduce((acc, t) => acc + (ct.has(t) ? 1 : 0), 0);
  }

  function bestWifi(host, person) {
    const candidates = all(host)
      .filter(x => x.domain === "device_tracker")
      .filter(x => {
        const t = x.text;
        return (
          t.includes("iphone")
          || t.includes("android")
          || t.includes("celular")
          || t.includes("telefone")
          || t.includes("phone")
          || t.includes("wifi")
          || t.includes("mobile")
        );
      });

    let best = null;
    let bestScore = 0;

    for (const c of candidates) {
      let score = exactTokenScore(person, `${c.id} ${c.name}`);
      if (c.state === "home") score += 0.25;
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }

    return bestScore >= 1 ? best : null;
  }

  function bestMobileNotify(host, person) {
    const services = Object.keys(host._hass?.services?.notify || {})
      .filter(name => name.startsWith("mobile_app_"));

    let best = "";
    let bestScore = 0;

    for (const service of services) {
      const score = exactTokenScore(person, service);
      if (score > bestScore) {
        best = service;
        bestScore = score;
      }
    }

    return bestScore >= 1 ? `notify.${best}` : "";
  }

  function voiceService(host, type) {
    if (type === "alexa") {
      return host._hass?.services?.notify?.alexa_media
        ? "notify.alexa_media"
        : "";
    }

    const tts = host._hass?.services?.tts || {};
    if (tts.google_translate_say) return "tts.google_translate_say";
    if (tts.cloud_say) return "tts.cloud_say";
    if (tts.speak) return "tts.speak";
    return "";
  }

  function ensureWelcomeDefaults(host) {
    const c = host._config || (host._config = {});
    c.boas_vindas ??= {};
    c.boas_vindas.mensagens ??= {};

    for (const [key, list] of Object.entries(DEFAULT_MESSAGES)) {
      const current = c.boas_vindas.mensagens[key];
      if (!Array.isArray(current) || current.length === 0) {
        c.boas_vindas.mensagens[key] = [...list];
      }
    }
  }

  const originalNormalizar = p.normalizar;
  p.normalizar = function(...args) {
    const result = originalNormalizar
      ? originalNormalizar.apply(this, args)
      : undefined;

    this._config ??= {};
    this._config.video_porteiro ??= {};
    this._config.video_porteiro.cameras_monitoradas ??= [];
    this._config.voz ??= {};
    this._config.voz.dispositivos ??= [];

    ensureWelcomeDefaults(this);
    return result;
  };

  p.autodetectar = async function() {
    if (!this._hass || !this._config) return;

    const ok = confirm(
      "A Inteligência CloudPelizzon irá revisar pessoas, presença, sensores, "
      + "portões, câmeras, voz e serviços de notificação.\n\n"
      + "Ela também removerá duplicidades e pessoas técnicas/MQTT criadas pela "
      + "autodetecção anterior.\n\n"
      + "Nada será salvo automaticamente e o Modo Sombra será mantido.\n\nContinuar?"
    );

    if (!ok) return;

    this.normalizar();

    const entities = all(this);
    const byDomain = domain =>
      entities.filter(x => x.domain === domain);

    const persons = canonicalPersons(this);
    const oldResidents = Array.isArray(this._config.moradores)
      ? this._config.moradores
      : [];

    const residents = [];

    for (const person of persons) {
      const key = personKey(person);

      const old = oldResidents.find(r => {
        const rid = String(r.entidade_pessoa || "");
        const rname = norm(r.nome || r.nome_voz || "");
        return (
          rid === person.id
          || (rname && rname === key)
          || norm(rid.replace("person.", "").replace(/_\d+$/, "")) ===
             norm(person.id.replace("person.", "").replace(/_\d+$/, ""))
        );
      }) || {};

      const wifi = bestWifi(this, person);
      const notify = bestMobileNotify(this, person);

      const currentNotify = String(old.servico_celular || "");
      const validMobile = /^notify\.mobile_app_/i.test(currentNotify);

      residents.push({
        ...old,
        id: old.id || `resident_${person.id.replace(/[^a-z0-9]+/gi, "_")}`,
        nome: person.name,
        nome_voz: old.nome_voz || person.name,
        entidade_pessoa: person.id,
        entidade_wifi:
          old.entidade_wifi && String(old.entidade_wifi).startsWith("device_tracker.")
            ? old.entidade_wifi
            : (wifi?.id || ""),
        servico_celular: validMobile ? currentNotify : notify,
        habilitado: old.habilitado ?? true,
        participa_seguranca: old.participa_seguranca ?? true,
        desarmar_automaticamente: old.desarmar_automaticamente ?? true,
        participa_ausencia: old.participa_ausencia ?? true,
        receber_notificacoes: old.receber_notificacoes ?? true,
        boas_vindas: old.boas_vindas ?? true,
      });
    }

    this._config.moradores = residents;

    const binary = byDomain("binary_sensor");

    const securityBinary = binary.filter(x => (
      ["door","window","opening","motion","occupancy","presence","gas","smoke","carbon_monoxide"].includes(x.deviceClass)
      || x.text.includes("porta")
      || x.text.includes("janela")
      || x.text.includes("movimento")
      || x.text.includes("presenca")
      || x.text.includes("occupancy")
      || x.text.includes("tamper")
      || x.text.includes("violacao")
      || x.text.includes("gas")
      || x.text.includes("fumaca")
    ));

    const zones = Array.isArray(this._config.zonas)
      ? [...this._config.zonas]
      : [];

    const addZone = (nome, payload) => {
      if (!zones.some(z => norm(z.nome) === norm(nome))) {
        zones.push({
          id: `auto_${norm(nome).replace(/\s+/g, "_")}`,
          nome,
          habilitado: true,
          ...payload,
        });
      }
    };

    if (securityBinary.some(x => ["door","window","opening"].includes(x.deviceClass))) {
      addZone("Perímetro", {
        criticidade: "alta",
        armar_parcial: true,
        armar_total: true,
        delay_entrada: false,
        bypass_permitido: true,
      });
    }

    if (securityBinary.some(x => ["motion","occupancy","presence"].includes(x.deviceClass))) {
      addZone("Interior", {
        criticidade: "alta",
        armar_parcial: false,
        armar_total: true,
        delay_entrada: false,
        bypass_permitido: true,
      });
    }

    if (securityBinary.some(x => ["gas","smoke","carbon_monoxide"].includes(x.deviceClass))) {
      addZone("Segurança Técnica", {
        criticidade: "critica",
        armar_parcial: true,
        armar_total: true,
        delay_entrada: false,
        bypass_permitido: false,
      });
    }

    this._config.zonas = zones;

    const devices = Array.isArray(this._config.dispositivos)
      ? [...this._config.dispositivos]
      : [];

    for (const entity of securityBinary) {
      if (devices.some(d => d.entidade === entity.id)) continue;

      let zona = "Perímetro";
      let tipo = "outro";

      if (["motion","occupancy","presence"].includes(entity.deviceClass)) {
        zona = "Interior";
        tipo = entity.deviceClass === "motion" ? "movimento" : "presenca";
      } else if (["gas","smoke","carbon_monoxide"].includes(entity.deviceClass)) {
        zona = "Segurança Técnica";
      } else if (entity.deviceClass === "door") {
        tipo = "porta";
      } else if (entity.deviceClass === "window") {
        tipo = "janela";
      } else if (entity.text.includes("tamper")) {
        tipo = "tamper";
      }

      devices.push({
        id: `auto_${entity.id.replace(/[^a-z0-9]+/gi, "_")}`,
        nome: entity.name,
        tipo,
        entidade: entity.id,
        zona,
        habilitado: true,
        armado_parcial: zona !== "Interior",
        armado_total: true,
        disparo_imediato: zona === "Segurança Técnica",
        monitorar_bateria: true,
        monitorar_tamper: true,
      });
    }

    this._config.dispositivos = devices;

    const switches = byDomain("switch");
    const fence = switches.find(x =>
      x.text.includes("cerca eletrica")
      || x.text.includes("electric fence")
      || x.text.startsWith("cerca ")
      || x.text.includes(" cerca ")
    );

    if (fence) {
      this._config.cerca_eletrica ??= {};
      if (!this._config.cerca_eletrica.entidade) {
        this._config.cerca_eletrica.entidade = fence.id;
      }
      this._config.cerca_eletrica.habilitada = true;
    }

    const covers = byDomain("cover");
    const gatesFound = covers.filter(x =>
      x.deviceClass === "garage"
      || x.deviceClass === "gate"
      || x.text.includes("portao")
      || x.text.includes("garagem")
      || x.text.includes("garage")
      || x.text.includes("gate")
    );

    const gates = Array.isArray(this._config.portoes)
      ? [...this._config.portoes]
      : [];

    for (const gate of gatesFound) {
      if (gates.some(x => x.entidade === gate.id)) continue;
      gates.push({
        id: `auto_${gate.id.replace(/[^a-z0-9]+/gi, "_")}`,
        nome: gate.name,
        entidade: gate.id,
        habilitado: true,
        tempo_aberto_alerta_segundos: 300,
        alerta_casa_vazia: true,
        alerta_ao_dormir: true,
        permitir_painel: true,
      });
    }

    this._config.portoes = gates;

    const sirens = byDomain("siren");
    this._config.sirene ??= {};

    if (sirens.length && !this._config.sirene.entidade) {
      this._config.sirene.entidade = sirens[0].id;
      this._config.sirene.habilitada = true;
    }

    const cameras = byDomain("camera")
      .sort((a,b) => a.name.localeCompare(b.name, "pt-BR"));

    this._config.video_porteiro ??= {};
    this._config.video_porteiro.cameras_monitoradas =
      cameras.map(x => x.id);

    const mainCamera =
      cameras.find(x =>
        ["porteiro","campainha","doorbell","entrada","frente","front","portao","garagem","garage"]
          .some(k => x.text.includes(k))
      )
      || cameras[0];

    if (mainCamera) {
      this._config.video_porteiro.camera = mainCamera.id;
      this._config.video_porteiro.habilitado = true;
    }

    const doorbell = [
      ...byDomain("event"),
      ...binary,
    ].find(x =>
      ["doorbell","campainha","bell"].some(k => x.text.includes(k))
    );

    if (doorbell) {
      this._config.video_porteiro.evento_campainha = doorbell.id;
    }

    const gasCandidate =
      binary.find(x =>
        x.deviceClass === "gas"
        || x.text.includes(" gas ")
        || x.text.startsWith("gas ")
        || x.text.includes("vazamento")
      )
      || byDomain("sensor").find(x =>
        x.text.includes("gas") && x.text.includes("ppm")
      );

    this._config.gas ??= {};
    if (gasCandidate) {
      this._config.gas.sensor = gasCandidate.id;
      this._config.gas.habilitado = true;
    }

    this._config.voz ??= {};
    const mediaPlayers = byDomain("media_player");

    const voicePlayers = mediaPlayers.filter(x =>
      ["alexa","echo","google","nest","home","hub"].some(k => x.text.includes(k))
    );

    const currentVoice = Array.isArray(this._config.voz.dispositivos)
      ? this._config.voz.dispositivos
      : [];

    const newVoice = [];

    for (const player of voicePlayers) {
      const isAlexa =
        player.text.includes("alexa")
        || player.text.includes("echo");

      const type = isAlexa ? "alexa" : "google_home";
      const old = currentVoice.find(x => x.entidade === player.id) || {};

      newVoice.push({
        ...old,
        id: old.id || `voice_${player.id.replace(/[^a-z0-9]+/gi, "_")}`,
        nome: player.name,
        tipo: type,
        entidade: player.id,
        servico_notificacao: voiceService(this, type),
        habilitado: old.habilitado ?? true,
      });
    }

    this._config.voz.dispositivos = newVoice;

    ensureWelcomeDefaults(this);
    this._config.geral ??= {};
    this._config.geral.modo_sombra = true;

    this._dirty = true;
    this.render();

    if (typeof this.toast === "function") {
      this.toast(
        `Autodetecção revisada: ${persons.length} moradores, `
        + `${securityBinary.length} sensores, ${gatesFound.length} portões, `
        + `${cameras.length} câmeras e ${voicePlayers.length} dispositivos de voz. `
        + "Revise e clique em Salvar configuração."
      );
    }
  };

  function inventory(host) {
    const entities = all(host);
    const cameras = entities.filter(x => x.domain === "camera");
    const sensors = entities.filter(x => x.domain === "binary_sensor");
    const persons = canonicalPersons(host);
    const media = entities.filter(x =>
      x.domain === "media_player"
      && ["alexa","echo","google","nest","home","hub"].some(k => x.text.includes(k))
    );
    const gates = entities.filter(x =>
      x.domain === "cover"
      && (
        x.deviceClass === "garage"
        || x.deviceClass === "gate"
        || x.text.includes("portao")
        || x.text.includes("garagem")
        || x.text.includes("garage")
        || x.text.includes("gate")
      )
    );

    return {
      found: {
        moradores: persons.length,
        sensores: sensors.length,
        cameras: cameras.length,
        voz: media.length,
        portoes: gates.length,
      },
      registered: {
        moradores: host._config?.moradores?.length || 0,
        sensores: host._config?.dispositivos?.length || 0,
        cameras: host._config?.video_porteiro?.cameras_monitoradas?.length || 0,
        voz: host._config?.voz?.dispositivos?.length || 0,
        portoes: host._config?.portoes?.length || 0,
      },
      cameras,
    };
  }

  function addStyle(root) {
    if (root.querySelector("#cp-v035-style")) return;

    const style = document.createElement("style");
    style.id = "cp-v035-style";
    style.textContent = `
      :host {
        --cp-v035-text:#eef8ff;
        --cp-v035-muted:#bed4e0;
        --cp-v035-soft:#95b8ca;
      }

      p, label, small, .subtitle, .description, .hint, .muted, .field-help {
        color:var(--cp-v035-muted) !important;
        opacity:1 !important;
      }

      .config-card, section.config-card {
        background:#061c27 !important;
        border-color:#17516a !important;
      }

      input, select, textarea {
        color:#f4fbff !important;
        background:#041821 !important;
        border-color:#1c5872 !important;
      }

      input::placeholder, textarea::placeholder {
        color:#7fa4b7 !important;
        opacity:1 !important;
      }

      .cp-v035-inventory {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
        margin:0 0 18px;
        padding:14px;
        border:1px solid #17516a;
        border-radius:14px;
        background:linear-gradient(135deg,#061c27,#05151e);
      }

      .cp-v035-inventory strong {
        color:#f1f9ff;
        display:block;
        margin-bottom:4px;
        font-size:12px;
        letter-spacing:.04em;
        text-transform:uppercase;
      }

      .cp-v035-inventory span {
        color:#afd0df;
        font-size:12px;
        line-height:1.5;
      }

      .cp-v035-help {
        display:block;
        margin-top:7px;
        color:#9ec0d0 !important;
        font-size:11px;
        line-height:1.4;
      }

      .cp-v035-camera-list {
        margin:0 0 18px;
        padding:14px;
        border:1px solid #17516a;
        border-radius:14px;
        background:#061c27;
      }

      .cp-v035-camera-list h3 {
        margin:0 0 10px;
        color:#f1f9ff;
        font-size:14px;
      }

      .cp-v035-camera-grid {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
        gap:8px;
      }

      .cp-v035-camera {
        padding:10px 12px;
        border:1px solid #123f55;
        border-radius:10px;
        background:#041821;
      }

      .cp-v035-camera b {
        color:#dff5ff;
        display:block;
        font-size:12px;
      }

      .cp-v035-camera span {
        color:#8eb4c5;
        font-size:10px;
        word-break:break-all;
      }

      @media (max-width:800px) {
        .cp-v035-inventory { grid-template-columns:1fr; }
      }
    `;
    root.appendChild(style);
  }

  const helpMap = [
    ["aguardar após chegada", "Unidade: segundos. 120 segundos = 2 minutos antes de confirmar a presença e anunciar a chegada."],
    ["janela de agrupamento", "Unidade: segundos. Moradores que chegarem dentro desta janela podem receber uma única mensagem familiar."],
    ["não repetir últimas", "Unidade: quantidade de mensagens. Ex.: 10 bloqueia temporariamente as 10 mensagens usadas mais recentemente."],
    ["tempo de saída", "Unidade: segundos. Tempo entre solicitar o armamento e a central ficar efetivamente armada."],
    ["tempo de entrada", "Unidade: segundos. Janela disponível para desarmar antes do disparo."],
    ["confirmação de saída", "Unidade: segundos. Ausência precisa permanecer confirmada durante este período antes do armamento automático."],
    ["confirmação de chegada", "Unidade: segundos. Tempo necessário para validar uma chegada antes de aplicar a política configurada."],
    ["reconciliação", "Unidade: segundos. Intervalo entre verificações do estado esperado e real do dispositivo."],
    ["tempo aberto", "Unidade: segundos. Tempo máximo que o portão pode permanecer aberto antes do alerta."],
    ["duração da sirene", "Unidade: segundos. Tempo máximo de acionamento contínuo da sirene."],
    ["tempo ligado", "Unidade: milissegundos. Duração de cada pulso ligado durante o pisca de emergência."],
    ["tempo desligado", "Unidade: milissegundos. Intervalo entre os pulsos do pisca de emergência."],
    ["cooldown da campainha", "Unidade: segundos. Bloqueia notificações repetidas da campainha durante este período."],
    ["tempo de validação", "Unidade: segundos. A presença ou movimento precisa persistir por este tempo para ser considerada válida."],
    ["cooldown", "Unidade: segundos. Intervalo mínimo entre dois eventos equivalentes."],
    ["offline", "Unidade: segundos. Tempo indisponível antes de gerar incidente de dispositivo offline."],
    ["travado", "Unidade: segundos. Tempo sem mudança esperado antes de considerar possível travamento."]
  ];

  function addFieldHelp(root) {
    for (const input of root.querySelectorAll("input[type=number]")) {
      const box = input.closest(".field") || input.parentElement;
      if (!box || box.querySelector(":scope > .cp-v035-help")) continue;

      const text = norm(box.textContent);
      const entry = helpMap.find(([needle]) => text.includes(norm(needle)));
      if (!entry) continue;

      const help = document.createElement("small");
      help.className = "cp-v035-help";
      help.textContent = entry[1];
      box.appendChild(help);
    }
  }

  function addInventory(host) {
    const root = host.shadowRoot;
    if (!root || root.querySelector(".cp-v035-inventory")) return;

    const inv = inventory(host);
    const banner = document.createElement("div");
    banner.className = "cp-v035-inventory";
    banner.innerHTML = `
      <div>
        <strong>Encontrados no Home Assistant</strong>
        <span>
          ${inv.found.moradores} moradores •
          ${inv.found.sensores} sensores •
          ${inv.found.cameras} câmeras •
          ${inv.found.voz} voz •
          ${inv.found.portoes} portões
        </span>
      </div>
      <div>
        <strong>Cadastrados no CP-SECURITY</strong>
        <span>
          ${inv.registered.moradores} moradores •
          ${inv.registered.sensores} sensores •
          ${inv.registered.cameras} câmeras •
          ${inv.registered.voz} voz •
          ${inv.registered.portoes} portões
        </span>
      </div>
    `;

    const firstSection =
      root.querySelector(".grid, section.config-card, .config-card, textarea");

    if (firstSection?.parentElement) {
      firstSection.parentElement.insertBefore(banner, firstSection);
    }
  }

  function addCameraInventory(host) {
    const root = host.shadowRoot;
    if (!root || root.querySelector(".cp-v035-camera-list")) return;

    const pageText = norm(root.textContent);
    if (!pageText.includes("cameras e video porteiro")) return;

    const inv = inventory(host);
    const registered = new Set(
      host._config?.video_porteiro?.cameras_monitoradas || []
    );

    const panel = document.createElement("section");
    panel.className = "cp-v035-camera-list";

    panel.innerHTML = `
      <h3>Câmeras encontradas e vinculadas (${registered.size} de ${inv.cameras.length})</h3>
      <div class="cp-v035-camera-grid">
        ${inv.cameras.map(cam => `
          <div class="cp-v035-camera">
            <b>${registered.has(cam.id) ? "✓ " : ""}${cam.name}</b>
            <span>${cam.id}</span>
          </div>
        `).join("")}
      </div>
    `;

    const firstSection =
      root.querySelector(".grid, section.config-card, .config-card");

    if (firstSection?.parentElement) {
      firstSection.parentElement.insertBefore(panel, firstSection);
    }
  }

  function enhance(host) {
    const root = host.shadowRoot;
    if (!root || !host._config || !host._hass) return;
    addStyle(root);
    addInventory(host);
    addFieldHelp(root);
    addCameraInventory(host);
  }

  const originalRender = p.render;
  p.render = function(...args) {
    const result = originalRender.apply(this, args);
    queueMicrotask(() => enhance(this));
    return result;
  };

  for (const el of document.querySelectorAll(TAG)) {
    queueMicrotask(() => {
      if (el._config) {
        ensureWelcomeDefaults(el);
        el.render();
      }
    });
  }

  console.info("CP-SECURITY 0.3.5 extension carregada.");
})();
