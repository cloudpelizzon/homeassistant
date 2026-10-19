/*
 * ==========================================================
 * CLOUDPELIZZON SEGURANÇA
 * CP-SECURITY 0.3.1
 * Central de Configurações
 * ==========================================================
 */

const CP_SEG_API =
  "cloudpelizzon/seguranca/configuracao";

const CP_SEG_VERSION = "0.6.1";


class CloudPelizzonSecurityPanel extends HTMLElement {

  constructor() {
    super();

    this.attachShadow({
      mode: "open"
    });

    this._hass = null;
    this._config = null;

    this._loading = false;
    this._saving = false;
    this._loaded = false;

    this._dirty = false;
    this._error = "";

    this._aba = "geral";
  }


  set hass(value) {
    this._hass = value;

    if (
      value
      && !this._loaded
      && !this._loading
    ) {
      this.carregar();
    }
  }


  get hass() {
    return this._hass;
  }


  connectedCallback() {

    this.render();

    if (
      this._hass
      && !this._loaded
      && !this._loading
    ) {
      this.carregar();
    }
  }


  async carregar() {

    if (
      !this._hass
      || this._loading
    ) {
      return;
    }

    this._loading = true;
    this._error = "";

    this.render();

    try {

      const resposta =
        await this._hass.callApi(
          "GET",
          CP_SEG_API
        );

      this._config =
        resposta?.configuracao || {};

      this.normalizar();

      this._loaded = true;
      this._dirty = false;

    }

    catch (error) {

      console.error(
        "CloudPelizzon Segurança:",
        error
      );

      this._error =
        error?.message
        || String(error);
    }

    finally {

      this._loading = false;
      this.render();
    }
  }



  /*
   * ==========================================================
   * CP_SECURITY_AUTODETECT_V034
   * Assistente inteligente de configuração.
   * ==========================================================
   */

  _cpNormalizarTexto(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }


  _cpEntityInfo(entityId) {
    const st = this._hass?.states?.[entityId];

    return {
      id: entityId,
      domain: String(entityId).split(".")[0],
      name: st?.attributes?.friendly_name || entityId,
      text: this._cpNormalizarTexto(
        [
          entityId,
          st?.attributes?.friendly_name,
          st?.attributes?.device_class,
        ].filter(Boolean).join(" ")
      ),
      deviceClass: String(st?.attributes?.device_class || "").toLowerCase(),
      state: String(st?.state || "").toLowerCase(),
      attributes: st?.attributes || {},
    };
  }


  _cpAllEntities() {
    return Object
      .keys(this._hass?.states || {})
      .map(id => this._cpEntityInfo(id));
  }


  _cpHasAny(text, words) {
    const normalized = this._cpNormalizarTexto(text);

    return words.some(
      word => normalized.includes(
        this._cpNormalizarTexto(word)
      )
    );
  }


  _cpUniqueBy(list, keyFn) {
    const seen = new Set();

    return list.filter(item => {
      const key = keyFn(item);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }


  _cpBestTracker(person, trackers) {
    const personText =
      this._cpNormalizarTexto(
        [
          person.id.replace("person.", ""),
          person.name,
        ].join(" ")
      );

    const tokens =
      personText
        .split(" ")
        .filter(x => x.length >= 3);

    let best = null;
    let bestScore = 0;

    for (const tracker of trackers) {
      let score = 0;

      for (const token of tokens) {
        if (tracker.text.includes(token)) {
          score += 2;
        }
      }

      if (
        this._cpHasAny(
          tracker.text,
          ["iphone", "android", "celular", "telefone", "phone", "wifi"]
        )
      ) {
        score += 1;
      }

      if (tracker.state === "home") {
        score += 0.5;
      }

      if (score > bestScore) {
        bestScore = score;
        best = tracker;
      }
    }

    return bestScore >= 2 ? best : null;
  }


  _cpBestNotify(person) {
    const services =
      this._hass?.services?.notify || {};

    const names = Object.keys(services);

    const base =
      this._cpNormalizarTexto(
        [
          person.id.replace("person.", ""),
          person.name,
        ].join(" ")
      );

    const tokens =
      base
        .split(" ")
        .filter(x => x.length >= 3);

    let best = "";
    let bestScore = 0;

    for (const name of names) {
      const n = this._cpNormalizarTexto(name);
      let score = 0;

      for (const token of tokens) {
        if (n.includes(token)) {
          score += 2;
        }
      }

      if (
        n.includes("mobile app")
        || n.includes("mobile_app")
      ) {
        score += 1;
      }

      if (score > bestScore) {
        bestScore = score;
        best = name;
      }
    }

    return bestScore >= 2
      ? `notify.${best}`
      : "";
  }


  async autodetectar() {

    if (!this._hass || !this._config) {
      return;
    }

    const confirmed =
      confirm(
        "A Inteligência CloudPelizzon irá analisar as entidades "
        + "do Home Assistant e preencher automaticamente as "
        + "configurações identificadas com boa confiança.\n\n"
        + "Nenhuma alteração será salva automaticamente e o "
        + "Modo Sombra será mantido.\n\nContinuar?"
      );

    if (!confirmed) {
      return;
    }

    const all = this._cpAllEntities();

    const byDomain =
      domain =>
        all.filter(
          x => x.domain === domain
        );

    const persons = byDomain("person");
    const trackers = byDomain("device_tracker");
    const binary = byDomain("binary_sensor");
    const covers = byDomain("cover");
    const switches = byDomain("switch");
    const sirens = byDomain("siren");
    const lights = byDomain("light");
    const cameras = byDomain("camera");
    const mediaPlayers = byDomain("media_player");

    const events = [
      ...byDomain("event"),
      ...byDomain("button"),
    ];


    // Moradores + GPS + Wi-Fi + celular.
    const residents =
      Array.isArray(this._config.moradores)
        ? [...this._config.moradores]
        : [];

    for (const person of persons) {

      let item =
        residents.find(
          r => r.entidade_pessoa === person.id
        );

      if (!item) {
        item = {
          id:
            "auto_"
            + person.id.replace(/[^a-z0-9]+/gi, "_"),
          nome: person.name,
          nome_voz: person.name,
          entidade_pessoa: person.id,
          entidade_wifi: "",
          servico_celular: "",
          habilitado: true,
          desarmar_automaticamente: true,
          participa_ausencia: true,
          receber_notificacoes: true,
          boas_vindas: true,
        };

        residents.push(item);
      }

      if (!item.nome) {
        item.nome = person.name;
      }

      if (!item.nome_voz) {
        item.nome_voz = person.name;
      }

      if (!item.entidade_wifi) {
        const tracker =
          this._cpBestTracker(person, trackers);

        if (tracker) {
          item.entidade_wifi = tracker.id;
        }
      }

      if (!item.servico_celular) {
        item.servico_celular =
          this._cpBestNotify(person);
      }
    }

    this._config.moradores =
      this._cpUniqueBy(
        residents,
        x => x.entidade_pessoa || x.id
      );


    // Sensores e zonas.
    const perimeterClasses =
      new Set(["door", "window", "opening"]);

    const interiorClasses =
      new Set(["motion", "occupancy", "presence"]);

    const technicalClasses =
      new Set(["gas", "smoke", "carbon_monoxide"]);

    const securityBinary =
      binary.filter(x =>
        perimeterClasses.has(x.deviceClass)
        || interiorClasses.has(x.deviceClass)
        || technicalClasses.has(x.deviceClass)
        || this._cpHasAny(
          x.text,
          [
            "porta", "door", "janela", "window",
            "movimento", "motion", "presenca", "presence",
            "ocupacao", "occupancy", "tamper", "violacao",
            "gas", "vazamento", "fumaca", "smoke"
          ]
        )
      );

    const currentZones =
      Array.isArray(this._config.zonas)
        ? [...this._config.zonas]
        : [];

    const addZone = (name, payload) => {
      if (
        !currentZones.some(
          x =>
            this._cpNormalizarTexto(x.nome)
            === this._cpNormalizarTexto(name)
        )
      ) {
        currentZones.push({
          id:
            "auto_"
            + this._cpNormalizarTexto(name)
              .replace(/\s+/g, "_"),
          nome: name,
          habilitado: true,
          ...payload,
        });
      }
    };

    if (
      securityBinary.some(
        x =>
          perimeterClasses.has(x.deviceClass)
          || this._cpHasAny(
            x.text,
            ["porta", "door", "janela", "window"]
          )
      )
    ) {
      addZone(
        "Perímetro",
        {
          criticidade: "alta",
          armar_parcial: true,
          armar_total: true,
          delay_entrada: false,
          bypass_permitido: true,
        }
      );
    }

    if (
      securityBinary.some(
        x => interiorClasses.has(x.deviceClass)
      )
    ) {
      addZone(
        "Interior",
        {
          criticidade: "alta",
          armar_parcial: false,
          armar_total: true,
          delay_entrada: false,
          bypass_permitido: true,
        }
      );
    }

    if (
      [...covers, ...securityBinary].some(
        x =>
          this._cpHasAny(
            x.text,
            ["garagem", "garage", "portao", "gate"]
          )
      )
    ) {
      addZone(
        "Garagem",
        {
          criticidade: "alta",
          armar_parcial: true,
          armar_total: true,
          delay_entrada: true,
          bypass_permitido: true,
        }
      );
    }

    if (
      securityBinary.some(
        x => technicalClasses.has(x.deviceClass)
      )
    ) {
      addZone(
        "Segurança Técnica",
        {
          criticidade: "critica",
          armar_parcial: true,
          armar_total: true,
          delay_entrada: false,
          bypass_permitido: false,
        }
      );
    }

    this._config.zonas = currentZones;

    const zoneFor = entity => {
      if (
        this._cpHasAny(
          entity.text,
          ["garagem", "garage", "portao", "gate"]
        )
      ) {
        return "Garagem";
      }

      if (technicalClasses.has(entity.deviceClass)) {
        return "Segurança Técnica";
      }

      if (interiorClasses.has(entity.deviceClass)) {
        return "Interior";
      }

      return "Perímetro";
    };

    const typeFor = entity => {
      if (
        entity.deviceClass === "door"
        || this._cpHasAny(entity.text, ["porta", "door"])
      ) {
        return "porta";
      }

      if (
        entity.deviceClass === "window"
        || this._cpHasAny(entity.text, ["janela", "window"])
      ) {
        return "janela";
      }

      if (entity.deviceClass === "motion") {
        return "movimento";
      }

      if (interiorClasses.has(entity.deviceClass)) {
        return "presenca";
      }

      if (
        this._cpHasAny(
          entity.text,
          ["tamper", "violacao"]
        )
      ) {
        return "tamper";
      }

      return "outro";
    };

    const currentDevices =
      Array.isArray(this._config.dispositivos)
        ? [...this._config.dispositivos]
        : [];

    for (const entity of securityBinary) {

      if (
        currentDevices.some(
          d => d.entidade === entity.id
        )
      ) {
        continue;
      }

      const zone = zoneFor(entity);

      currentDevices.push({
        id:
          "auto_"
          + entity.id.replace(/[^a-z0-9]+/gi, "_"),
        nome: entity.name,
        tipo: typeFor(entity),
        entidade: entity.id,
        zona: zone,
        habilitado: true,
        armado_parcial: zone !== "Interior",
        armado_total: true,
        disparo_imediato: zone === "Segurança Técnica",
        monitorar_bateria: true,
        monitorar_tamper: true,
      });
    }

    this._config.dispositivos =
      this._cpUniqueBy(
        currentDevices,
        x => x.entidade || x.id
      );


    // Cerca elétrica.
    const fence =
      switches.find(
        x =>
          this._cpHasAny(
            x.text,
            [
              "cerca eletrica",
              "cerca",
              "electric fence",
              "fence",
            ]
          )
      );

    if (
      fence
      && !this._config.cerca_eletrica?.entidade
    ) {
      this._config.cerca_eletrica.entidade = fence.id;
      this._config.cerca_eletrica.habilitada = true;
    }


    // Portões.
    const gateCovers =
      covers.filter(
        x =>
          x.deviceClass === "garage"
          || x.deviceClass === "gate"
          || this._cpHasAny(
            x.text,
            ["portao", "garagem", "garage", "gate"]
          )
      );

    const currentGates =
      Array.isArray(this._config.portoes)
        ? [...this._config.portoes]
        : [];

    for (const gate of gateCovers) {

      if (
        currentGates.some(
          x => x.entidade === gate.id
        )
      ) {
        continue;
      }

      currentGates.push({
        id:
          "auto_"
          + gate.id.replace(/[^a-z0-9]+/gi, "_"),
        nome: gate.name,
        entidade: gate.id,
        habilitado: true,
        tempo_aberto_alerta_segundos: 300,
        alerta_casa_vazia: true,
        alerta_ao_dormir: true,
        permitir_painel: true,
      });
    }

    this._config.portoes = currentGates;


    // Sirene.
    if (
      sirens.length
      && !this._config.sirene?.entidade
    ) {
      this._config.sirene.entidade = sirens[0].id;
      this._config.sirene.habilitada = true;
    }


    // Luzes de emergência: somente nomes claramente relacionados.
    const emergencyLights =
      lights.filter(
        x =>
          this._cpHasAny(
            x.text,
            ["emergencia", "alarme", "sirene", "seguranca", "security"]
          )
      );

    if (
      emergencyLights.length
      && !(this._config.luzes_emergencia?.entidades || []).length
    ) {
      this._config.luzes_emergencia.entidades =
        emergencyLights.map(x => x.id);

      this._config.luzes_emergencia.habilitadas = true;
    }


    // Câmera / vídeo porteiro.
    const camera =
      cameras.find(
        x =>
          this._cpHasAny(
            x.text,
            [
              "portao", "porta", "entrada", "frente",
              "doorbell", "campainha", "garage",
              "garagem", "front"
            ]
          )
      )
      || cameras[0];

    if (
      camera
      && !this._config.video_porteiro?.camera
    ) {
      this._config.video_porteiro.camera = camera.id;
      this._config.video_porteiro.habilitado = true;
    }

    const doorbell =
      [...events, ...binary].find(
        x =>
          this._cpHasAny(
            x.text,
            ["campainha", "doorbell", "door bell", "bell"]
          )
      );

    if (
      doorbell
      && !this._config.video_porteiro?.evento_campainha
    ) {
      this._config.video_porteiro.evento_campainha =
        doorbell.id;
    }


    // Gás.
    const gasSensor =
      binary.find(
        x =>
          x.deviceClass === "gas"
          || this._cpHasAny(
            x.text,
            ["gas", "vazamento"]
          )
      )
      || byDomain("sensor").find(
        x =>
          this._cpHasAny(
            x.text,
            ["gas ppm", "gas", "ppm"]
          )
      );

    if (
      gasSensor
      && !this._config.gas?.sensor
    ) {
      this._config.gas.sensor = gasSensor.id;
      this._config.gas.habilitado = true;
    }


    // Alexa / Google Home.
    this._config.voz ??= {
      habilitada: true,
      volume_anuncio: 0.7,
      restaurar_volume: true,
      dispositivos: [],
    };

    const voicePlayers =
      mediaPlayers.filter(
        x =>
          this._cpHasAny(
            x.text,
            ["alexa", "echo", "google", "nest", "home", "hub"]
          )
      );

    const currentVoice =
      Array.isArray(this._config.voz.dispositivos)
        ? [...this._config.voz.dispositivos]
        : [];

    const notifyServices =
      Object.keys(
        this._hass?.services?.notify || {}
      );

    for (const player of voicePlayers) {

      if (
        currentVoice.some(
          x => x.entidade === player.id
        )
      ) {
        continue;
      }

      const isAlexa =
        this._cpHasAny(
          player.text,
          ["alexa", "echo"]
        );

      let service = "";

      if (isAlexa) {
        const alexaService =
          notifyServices.find(
            s =>
              this._cpNormalizarTexto(s)
                .includes("alexa media")
          );

        if (alexaService) {
          service = `notify.${alexaService}`;
        }
      }

      currentVoice.push({
        id:
          "auto_"
          + player.id.replace(/[^a-z0-9]+/gi, "_"),
        nome: player.name,
        tipo: isAlexa ? "alexa" : "google_home",
        entidade: player.id,
        servico_notificacao: service,
        habilitado: true,
      });
    }

    this._config.voz.dispositivos = currentVoice;


    // Segurança operacional: nunca sair do Modo Sombra por autodetecção.
    this._config.geral ??= {};
    this._config.geral.modo_sombra = true;

    this._dirty = true;

    const resumo = {
      moradores: this._config.moradores.length,
      sensores: this._config.dispositivos.length,
      zonas: this._config.zonas.length,
      portoes: this._config.portoes.length,
      voz: this._config.voz.dispositivos.length,
      cerca: Boolean(this._config.cerca_eletrica?.entidade),
      sirene: Boolean(this._config.sirene?.entidade),
      camera: Boolean(this._config.video_porteiro?.camera),
      gas: Boolean(this._config.gas?.sensor),
    };

    this.render();

    this.toast(
      "Inteligência concluída: "
      + `${resumo.moradores} moradores, `
      + `${resumo.sensores} sensores, `
      + `${resumo.zonas} zonas, `
      + `${resumo.portoes} portões e `
      + `${resumo.voz} dispositivos de voz. `
      + "Revise as sugestões e clique em Salvar configuração."
    );
  }


  normalizar() {

    const c =
      this._config
      || (this._config = {});

    c.geral ??= {};

    c.presenca ??= {};

    c.moradores ??= [];

    c.zonas ??= [];

    c.dispositivos ??= [];

    c.portoes ??= [];

    c.controles_fisicos ??= [];

    c.cerca_eletrica ??= {};

    c.boas_vindas ??= {};

    c.boas_vindas.mensagens ??= {
      manha: [],
      tarde: [],
      noite: [],
      gerais: [],
      familia: []
    };

    c.notificacoes ??= {};

    c.notificacoes.silencio_voz ??= {};

    c.notificacoes.eventos ??= {};

    c.sirene ??= {};

    c.luzes_emergencia ??= {};

    c.video_porteiro ??= {};

    c.video_porteiro.pessoa_parada ??= {};

    c.gas ??= {};

    c.modo_visita ??= {};

    c.modo_viagem ??= {};

    c.auditoria ??= {};

    c.armamento_por_horario ??= {};

    c.incidentes ??= {};

    c.estatisticas ??= {};

    c.voz ??= {
      habilitada: true,

      volume_anuncio: 0.70,

      restaurar_volume: true,

      dispositivos: []
    };
  }


  getPath(path) {

    let obj = this._config;

    for (
      const key
      of String(path).split(".")
    ) {

      if (
        obj === null
        || obj === undefined
      ) {
        return undefined;
      }

      obj = obj[key];
    }

    return obj;
  }


  setPath(
    path,
    value
  ) {

    const keys =
      String(path).split(".");

    let obj = this._config;

    keys
      .slice(0, -1)
      .forEach(key => {

        if (
          obj[key] === undefined
          || obj[key] === null
        ) {

          const next =
            keys[
              keys.indexOf(key) + 1
            ];

          obj[key] =
            /^\d+$/.test(next)
            ? []
            : {};
        }

        obj = obj[key];
      });

    obj[
      keys[keys.length - 1]
    ] = value;

    this._dirty = true;

    this.atualizarIndicador();
  }


  atualizarIndicador() {

    const el =
      this.shadowRoot
        ?.querySelector(
          "#estado-salvamento"
        );

    if (!el) {
      return;
    }

    if (this._saving) {
      el.textContent =
        "Salvando...";
      el.className =
        "save-state saving";
    }

    else if (this._dirty) {
      el.textContent =
        "Alterações não salvas";
      el.className =
        "save-state dirty";
    }

    else {
      el.textContent =
        "Configuração salva";
      el.className =
        "save-state saved";
    }
  }


  async salvar() {

    if (
      !this._hass
      || !this._config
      || this._saving
    ) {
      return;
    }

    this._saving = true;
    this.atualizarIndicador();

    try {

      const resposta =
        await this._hass.callApi(
          "POST",
          CP_SEG_API,
          this._config
        );

      this._config =
        resposta?.configuracao
        || this._config;

      this.normalizar();

      this._dirty = false;

      this.toast(
        "Configuração salva com sucesso."
      );

    }

    catch (error) {

      console.error(
        "CloudPelizzon Segurança:",
        error
      );

      this.toast(
        "Falha ao salvar: "
        + (
          error?.message
          || String(error)
        ),
        true
      );

    }

    finally {

      this._saving = false;
      this.atualizarIndicador();
    }
  }


  esc(value) {

    return String(
      value ?? ""
    )
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      );
  }


  entidades(
    dominios = []
  ) {

    if (!this._hass) {
      return [];
    }

    const filtro =
      Array.isArray(dominios)
      ? dominios
      : [dominios];

    return Object
      .keys(
        this._hass.states || {}
      )
      .filter(entity => {

        if (!filtro.length) {
          return true;
        }

        const domain =
          entity.split(".")[0];

        return filtro.includes(
          domain
        );
      })
      .sort(
        (a, b) =>
          a.localeCompare(b)
      );
  }


  tituloEntidade(entity) {

    const state =
      this._hass
        ?.states
        ?.[entity];

    return (
      state
        ?.attributes
        ?.friendly_name
      || entity
    );
  }


  campo(
    path,
    titulo,
    tipo = "text",
    minimo = null,
    maximo = null,
    passo = null
  ) {

    const valor =
      this.getPath(path);

    let extra = "";

    if (minimo !== null) {
      extra +=
        ` min="${minimo}"`;
    }

    if (maximo !== null) {
      extra +=
        ` max="${maximo}"`;
    }

    if (passo !== null) {
      extra +=
        ` step="${passo}"`;
    }

    return `
      <label class="campo">
        <span>${this.esc(titulo)}</span>

        <input
          type="${tipo}"
          data-path="${this.esc(path)}"
          value="${this.esc(valor ?? "")}"
          ${extra}
        >
      </label>
    `;
  }


  alternador(
    path,
    titulo,
    descricao = ""
  ) {

    const ligado =
      Boolean(
        this.getPath(path)
      );

    return `
      <label class="switch-row">

        <div class="switch-copy">

          <b>${this.esc(titulo)}</b>

          ${
            descricao
              ? `<small>${this.esc(descricao)}</small>`
              : ""
          }

        </div>

        <span class="toggle">

          <input
            type="checkbox"
            data-path="${this.esc(path)}"
            ${ligado ? "checked" : ""}
          >

          <i></i>

        </span>

      </label>
    `;
  }


  seletor(
    path,
    titulo,
    opcoes
  ) {

    const atual =
      String(
        this.getPath(path)
        ?? ""
      );

    return `
      <label class="campo">

        <span>${this.esc(titulo)}</span>

        <select
          data-path="${this.esc(path)}">

          ${opcoes.map(item => {

            const value =
              typeof item === "string"
              ? item
              : item.value;

            const label =
              typeof item === "string"
              ? item
              : item.label;

            return `
              <option
                value="${this.esc(value)}"
                ${
                  String(value) === atual
                    ? "selected"
                    : ""
                }>
                ${this.esc(label)}
              </option>
            `;

          }).join("")}

        </select>

      </label>
    `;
  }


  seletorEntidade(
    path,
    titulo,
    dominios = []
  ) {

    const atual =
      String(
        this.getPath(path)
        ?? ""
      );

    const entidades =
      this.entidades(
        dominios
      );

    if (
      atual
      && !entidades.includes(atual)
    ) {
      entidades.unshift(atual);
    }

    return `
      <label class="campo">

        <span>${this.esc(titulo)}</span>

        <select
          data-path="${this.esc(path)}">

          <option value="">
            Nenhuma entidade selecionada
          </option>

          ${entidades.map(entity => `
            <option
              value="${this.esc(entity)}"
              ${
                entity === atual
                  ? "selected"
                  : ""
              }>
              ${this.esc(
                this.tituloEntidade(entity)
              )}
              •
              ${this.esc(entity)}
            </option>
          `).join("")}

        </select>

      </label>
    `;
  }


  areaMensagens(
    path,
    titulo
  ) {

    const lista =
      this.getPath(path);

    const texto =
      Array.isArray(lista)
      ? lista.join("\n")
      : "";

    return `
      <label class="campo wide">

        <span>
          ${this.esc(titulo)}
          <small>
            uma mensagem por linha
          </small>
        </span>

        <textarea
          rows="7"
          data-path="${this.esc(path)}"
          data-lista="linhas">${this.esc(texto)}</textarea>

      </label>
    `;
  }


  cardTitulo(
    icone,
    titulo,
    texto
  ) {

    return `
      <div class="section-head">

        <div class="section-icon">
          <ha-icon
            icon="${icone}">
          </ha-icon>
        </div>

        <div>
          <h2>${this.esc(titulo)}</h2>
          <p>${this.esc(texto)}</p>
        </div>

      </div>
    `;
  }


  renderGeral() {

    return `

      ${this.cardTitulo(
        "mdi:shield-cog-outline",
        "Configuração Geral",
        "Comportamento principal da Central de Segurança."
      )}

      <div class="grid two">

        <section class="config-card">

          <h3>Operação</h3>

          ${this.alternador(
            "geral.habilitado",
            "Módulo habilitado"
          )}

          ${this.alternador(
            "geral.modo_sombra",
            "Modo Sombra",
            "Observa e decide, mas não comanda dispositivos físicos."
          )}

          ${this.alternador(
            "geral.armamento_automatico",
            "Armamento automático"
          )}

          ${this.alternador(
            "geral.desarmamento_automatico",
            "Desarmamento automático"
          )}

        </section>


        <section class="config-card">

          <h3>Temporizações</h3>

          ${this.campo(
            "geral.tempo_saida_segundos",
            "Tempo de saída (segundos)",
            "number",
            0,
            600,
            1
          )}

          ${this.campo(
            "geral.tempo_entrada_segundos",
            "Tempo de entrada (segundos)",
            "number",
            0,
            600,
            1
          )}

          ${this.alternador(
            "geral.registrar_eventos",
            "Registrar eventos"
          )}

          ${this.alternador(
            "geral.registrar_incidentes",
            "Registrar incidentes"
          )}

        </section>

      </div>
    `;
  }


  renderMoradores() {

    const moradores =
      this._config.moradores;

    return `

      ${this.cardTitulo(
        "mdi:account-group-outline",
        "Moradores",
        "Cadastre quem participa das decisões de presença e segurança."
      )}

      <div class="repeat-list">

        ${moradores.map(
          (m, i) => `

          <section class="config-card resident">

            <div class="card-bar">

              <h3>
                ${this.esc(
                  m.nome
                  || `Morador ${i + 1}`
                )}
              </h3>

              <button
                class="danger small"
                data-remove="moradores"
                data-index="${i}">
                Remover
              </button>

            </div>

            <div class="form-grid">

              ${this.campo(
                `moradores.${i}.nome`,
                "Nome"
              )}

              ${this.campo(
                `moradores.${i}.nome_voz`,
                "Nome usado nas mensagens"
              )}

              ${this.seletorEntidade(
                `moradores.${i}.entidade_pessoa`,
                "Geolocalização",
                ["person"]
              )}

              ${this.seletorEntidade(
                `moradores.${i}.entidade_wifi`,
                "Presença pelo Wi-Fi",
                [
                  "device_tracker",
                  "binary_sensor"
                ]
              )}

              ${this.campo(
                `moradores.${i}.servico_celular`,
                "Serviço de notificação do celular"
              )}

            </div>

            <div class="switch-grid">

              ${this.alternador(
                `moradores.${i}.habilitado`,
                "Participa da segurança"
              )}

              ${this.alternador(
                `moradores.${i}.desarmar_automaticamente`,
                "Pode desarmar na chegada"
              )}

              ${this.alternador(
                `moradores.${i}.participa_ausencia`,
                "Participa da confirmação de saída"
              )}

              ${this.alternador(
                `moradores.${i}.receber_notificacoes`,
                "Receber notificações"
              )}

              ${this.alternador(
                `moradores.${i}.boas_vindas`,
                "Receber boas-vindas"
              )}

            </div>

          </section>

        `).join("")}

      </div>

      <button
        class="primary"
        data-add="morador">

        <ha-icon icon="mdi:account-plus"></ha-icon>
        Adicionar morador

      </button>
    `;
  }


  renderPresenca() {

    return `

      ${this.cardTitulo(
        "mdi:map-marker-account-outline",
        "Presença e Localização",
        "Fontes simultâneas para identificar chegada e ausência."
      )}

      <div class="grid two">

        <section class="config-card">

          <h3>Fontes de presença</h3>

          ${this.alternador(
            "presenca.habilitada",
            "Detecção de presença"
          )}

          ${this.alternador(
            "presenca.geolocalizacao",
            "Geolocalização"
          )}

          ${this.alternador(
            "presenca.wifi",
            "Wi-Fi"
          )}

          ${this.alternador(
            "presenca.controle_fisico",
            "Controles físicos"
          )}

          ${this.alternador(
            "presenca.painel",
            "Painel CloudPelizzon"
          )}

        </section>


        <section class="config-card">

          <h3>Confirmação</h3>

          ${this.campo(
            "presenca.confirmacao_saida_segundos",
            "Confirmar ausência após",
            "number",
            0,
            3600,
            1
          )}

          ${this.campo(
            "presenca.confirmacao_chegada_segundos",
            "Confirmar chegada após",
            "number",
            0,
            600,
            1
          )}

          ${this.alternador(
            "presenca.uma_fonte_confirma_chegada",
            "Uma fonte confiável confirma chegada"
          )}

          ${this.alternador(
            "presenca.saida_exige_ausencia_confirmada",
            "Saída exige confirmação de ausência"
          )}

          ${this.alternador(
            "presenca.forcar_atualizacao_localizacao",
            "Solicitar atualização periódica de localização"
          )}

          ${this.campo(
            "presenca.intervalo_atualizacao_localizacao_minutos",
            "Intervalo de atualização (minutos)",
            "number",
            1,
            180,
            1
          )}

        </section>

      </div>
    `;
  }


  renderAlarme() {

    return `

      ${this.cardTitulo(
        "mdi:shield-lock-outline",
        "Central de Alarme",
        "Armamento, desarmamento, atrasos e políticas especiais."
      )}

      <div class="grid two">

        <section class="config-card">

          <h3>Central</h3>

          ${this.alternador(
            "geral.armamento_automatico",
            "Armar automaticamente"
          )}

          ${this.alternador(
            "geral.desarmamento_automatico",
            "Desarmar automaticamente"
          )}

          ${this.campo(
            "geral.tempo_saida_segundos",
            "Tempo de saída",
            "number",
            0,
            600,
            1
          )}

          ${this.campo(
            "geral.tempo_entrada_segundos",
            "Tempo de entrada",
            "number",
            0,
            600,
            1
          )}

        </section>


        <section class="config-card">

          <h3>Regras por horário</h3>

          ${this.alternador(
            "armamento_por_horario.habilitado",
            "Permitir regras de horário"
          )}

          ${this.alternador(
            "armamento_por_horario.armar_ao_dormir",
            "Armar ao entrar em modo Dormindo"
          )}

          ${this.alternador(
            "armamento_por_horario.desarmar_ao_acordar",
            "Desarmar ao acordar"
          )}

          ${this.alternador(
            "armamento_por_horario.protecao_feriado",
            "Proteção especial em feriados"
          )}

        </section>

      </div>
    `;
  }


  renderZonas() {

    const zonas =
      this._config.zonas;

    return `

      ${this.cardTitulo(
        "mdi:vector-square",
        "Zonas de Segurança",
        "Organize sensores e políticas por perímetro, garagem, interior e outras áreas."
      )}

      <div class="repeat-list">

        ${zonas.map(
          (z, i) => `

          <section class="config-card">

            <div class="card-bar">

              <h3>
                ${this.esc(
                  z.nome
                  || `Zona ${i + 1}`
                )}
              </h3>

              <button
                class="danger small"
                data-remove="zonas"
                data-index="${i}">
                Remover
              </button>

            </div>

            <div class="form-grid">

              ${this.campo(
                `zonas.${i}.nome`,
                "Nome"
              )}

              ${this.seletor(
                `zonas.${i}.criticidade`,
                "Criticidade",
                [
                  {value:"baixa", label:"Baixa"},
                  {value:"media", label:"Média"},
                  {value:"alta", label:"Alta"},
                  {value:"critica", label:"Crítica"}
                ]
              )}

            </div>

            <div class="switch-grid">

              ${this.alternador(
                `zonas.${i}.habilitado`,
                "Zona habilitada"
              )}

              ${this.alternador(
                `zonas.${i}.armar_parcial`,
                "Monitorar no Parcial"
              )}

              ${this.alternador(
                `zonas.${i}.armar_total`,
                "Monitorar no Total"
              )}

              ${this.alternador(
                `zonas.${i}.delay_entrada`,
                "Usar tempo de entrada"
              )}

              ${this.alternador(
                `zonas.${i}.bypass_permitido`,
                "Permitir bypass"
              )}

            </div>

          </section>

        `).join("")}

      </div>

      <button
        class="primary"
        data-add="zona">

        <ha-icon icon="mdi:plus"></ha-icon>
        Adicionar zona

      </button>
    `;
  }


  renderSensores() {

    const dispositivos =
      this._config.dispositivos;

    return `

      ${this.cardTitulo(
        "mdi:access-point",
        "Sensores e Dispositivos",
        "Cadastre contatos, presença, movimento, tamper e demais sensores."
      )}

      <div class="repeat-list">

        ${dispositivos.map(
          (d, i) => `

          <section class="config-card">

            <div class="card-bar">

              <h3>
                ${this.esc(
                  d.nome
                  || `Dispositivo ${i + 1}`
                )}
              </h3>

              <button
                class="danger small"
                data-remove="dispositivos"
                data-index="${i}">
                Remover
              </button>

            </div>

            <div class="form-grid">

              ${this.campo(
                `dispositivos.${i}.nome`,
                "Nome"
              )}

              ${this.seletor(
                `dispositivos.${i}.tipo`,
                "Tipo",
                [
                  {value:"porta", label:"Porta"},
                  {value:"janela", label:"Janela"},
                  {value:"movimento", label:"Movimento"},
                  {value:"tamper", label:"Tamper"},
                  {value:"presenca", label:"Presença"},
                  {value:"outro", label:"Outro"}
                ]
              )}

              ${this.seletorEntidade(
                `dispositivos.${i}.entidade`,
                "Entidade",
                [
                  "binary_sensor",
                  "sensor"
                ]
              )}

              ${this.campo(
                `dispositivos.${i}.zona`,
                "ID / nome da zona"
              )}

            </div>

            <div class="switch-grid">

              ${this.alternador(
                `dispositivos.${i}.habilitado`,
                "Monitorar"
              )}

              ${this.alternador(
                `dispositivos.${i}.armado_parcial`,
                "Ativo no Parcial"
              )}

              ${this.alternador(
                `dispositivos.${i}.armado_total`,
                "Ativo no Total"
              )}

              ${this.alternador(
                `dispositivos.${i}.disparo_imediato`,
                "Disparo imediato"
              )}

              ${this.alternador(
                `dispositivos.${i}.monitorar_bateria`,
                "Monitorar bateria"
              )}

              ${this.alternador(
                `dispositivos.${i}.monitorar_tamper`,
                "Monitorar tamper"
              )}

            </div>

          </section>

        `).join("")}

      </div>

      <button
        class="primary"
        data-add="dispositivo">

        <ha-icon icon="mdi:access-point-plus"></ha-icon>
        Adicionar dispositivo

      </button>
    `;
  }


  renderCerca() {

    return `

      ${this.cardTitulo(
        "mdi:electric-switch",
        "Cerca Elétrica",
        "Controle, reconciliação e recuperação automática."
      )}

      <div class="grid two">

        <section class="config-card">

          <h3>Controle</h3>

          ${this.alternador(
            "cerca_eletrica.habilitada",
            "Cerca cadastrada"
          )}

          ${this.seletorEntidade(
            "cerca_eletrica.entidade",
            "Entidade da cerca",
            ["switch"]
          )}

          ${this.alternador(
            "cerca_eletrica.controle_automatico",
            "Controle automático"
          )}

          ${this.alternador(
            "cerca_eletrica.ligar_casa_vazia",
            "Ligar com casa vazia"
          )}

          ${this.alternador(
            "cerca_eletrica.desligar_na_chegada",
            "Desligar ao detectar chegada"
          )}

        </section>


        <section class="config-card">

          <h3>Autocorreção</h3>

          ${this.alternador(
            "cerca_eletrica.reconciliacao",
            "Reconciliação automática"
          )}

          ${this.campo(
            "cerca_eletrica.intervalo_reconciliacao_segundos",
            "Intervalo de verificação",
            "number",
            30,
            3600,
            1
          )}

          ${this.campo(
            "cerca_eletrica.tentativas_correcao",
            "Tentativas de correção",
            "number",
            0,
            10,
            1
          )}

          ${this.alternador(
            "cerca_eletrica.notificar_falha",
            "Notificar falhas"
          )}

          ${this.alternador(
            "cerca_eletrica.deduplicar_falha",
            "Não repetir alerta enquanto a falha persistir"
          )}

        </section>

      </div>
    `;
  }


  renderPortoes() {

    const portoes =
      this._config.portoes;

    return `

      ${this.cardTitulo(
        "mdi:garage-variant",
        "Portões",
        "Monitore abertura, residência vazia e comandos locais."
      )}

      <div class="repeat-list">

        ${portoes.map(
          (p, i) => `

          <section class="config-card">

            <div class="card-bar">

              <h3>
                ${this.esc(
                  p.nome
                  || `Portão ${i + 1}`
                )}
              </h3>

              <button
                class="danger small"
                data-remove="portoes"
                data-index="${i}">
                Remover
              </button>

            </div>

            <div class="form-grid">

              ${this.campo(
                `portoes.${i}.nome`,
                "Nome"
              )}

              ${this.seletorEntidade(
                `portoes.${i}.entidade`,
                "Entidade",
                ["cover"]
              )}

              ${this.campo(
                `portoes.${i}.tempo_aberto_alerta_segundos`,
                "Alertar aberto após (segundos)",
                "number",
                0,
                7200,
                1
              )}

            </div>

            <div class="switch-grid">

              ${this.alternador(
                `portoes.${i}.habilitado`,
                "Monitorar"
              )}

              ${this.alternador(
                `portoes.${i}.alerta_casa_vazia`,
                "Alerta imediato com casa vazia"
              )}

              ${this.alternador(
                `portoes.${i}.alerta_ao_dormir`,
                "Avisar se aberto ao dormir"
              )}

              ${this.alternador(
                `portoes.${i}.permitir_painel`,
                "Permitir comando pelo painel"
              )}

            </div>

          </section>

        `).join("")}

      </div>

      <button
        class="primary"
        data-add="portao">

        <ha-icon icon="mdi:garage-open-variant"></ha-icon>
        Adicionar portão

      </button>
    `;
  }


  renderControles() {

    const controles =
      this._config.controles_fisicos;

    return `

      ${this.cardTitulo(
        "mdi:remote",
        "Controles Físicos",
        "Botões, controles, teclados, tags ou eventos autorizados."
      )}

      <div class="repeat-list">

        ${controles.map(
          (c, i) => `

          <section class="config-card">

            <div class="card-bar">

              <h3>
                ${this.esc(
                  c.nome
                  || `Controle ${i + 1}`
                )}
              </h3>

              <button
                class="danger small"
                data-remove="controles_fisicos"
                data-index="${i}">
                Remover
              </button>

            </div>

            <div class="form-grid">

              ${this.campo(
                `controles_fisicos.${i}.nome`,
                "Nome"
              )}

              ${this.seletor(
                `controles_fisicos.${i}.comando`,
                "Comando",
                [
                  {value:"armar_total", label:"Armar Total"},
                  {value:"armar_parcial", label:"Armar Parcial"},
                  {value:"desarmar", label:"Desarmar"},
                  {value:"panico", label:"Pânico"},
                  {value:"abrir_portao", label:"Abrir portão"},
                  {value:"fechar_portao", label:"Fechar portão"}
                ]
              )}

              ${this.campo(
                `controles_fisicos.${i}.entidade`,
                "Entidade / origem do evento"
              )}

              ${this.campo(
                `controles_fisicos.${i}.evento`,
                "Evento / ação esperada"
              )}

            </div>

            ${this.alternador(
              `controles_fisicos.${i}.habilitado`,
              "Controle habilitado"
            )}

          </section>

        `).join("")}

      </div>

      <button
        class="primary"
        data-add="controle">

        <ha-icon icon="mdi:remote-tv"></ha-icon>
        Adicionar controle físico

      </button>
    `;
  }


  renderResposta() {

    return `

      ${this.cardTitulo(
        "mdi:alarm-light-outline",
        "Sirene e Luzes de Emergência",
        "Defina as respostas físicas utilizadas durante um evento."
      )}

      <div class="grid two">

        <section class="config-card">

          <h3>Sirene</h3>

          ${this.alternador(
            "sirene.habilitada",
            "Sirene habilitada"
          )}

          ${this.seletorEntidade(
            "sirene.entidade",
            "Entidade",
            ["siren"]
          )}

          ${this.campo(
            "sirene.duracao_segundos",
            "Duração",
            "number",
            1,
            3600,
            1
          )}

          ${this.campo(
            "sirene.volume",
            "Volume",
            "number",
            0,
            1,
            0.05
          )}

          ${this.campo(
            "sirene.tom",
            "Tom"
          )}

          ${this.alternador(
            "sirene.acionar_em_disparo",
            "Acionar em disparo"
          )}

          ${this.alternador(
            "sirene.acionar_em_panico",
            "Acionar em pânico"
          )}

        </section>


        <section class="config-card">

          <h3>Luzes de emergência</h3>

          ${this.alternador(
            "luzes_emergencia.habilitadas",
            "Luzes habilitadas"
          )}

          ${this.alternador(
            "luzes_emergencia.piscar",
            "Piscar durante alerta"
          )}

          ${this.campo(
            "luzes_emergencia.tempo_ligado_ms",
            "Tempo ligado (ms)",
            "number",
            100,
            10000,
            50
          )}

          ${this.campo(
            "luzes_emergencia.tempo_desligado_ms",
            "Tempo desligado (ms)",
            "number",
            100,
            10000,
            50
          )}

          ${this.alternador(
            "luzes_emergencia.parar_no_desarme",
            "Parar ao desarmar"
          )}

          <label class="campo wide">
            <span>
              Entidades das luzes
              <small>
                uma entidade por linha
              </small>
            </span>

            <textarea
              rows="6"
              data-path="luzes_emergencia.entidades"
              data-lista="linhas">${
                this.esc(
                  (
                    this._config
                      .luzes_emergencia
                      .entidades
                    || []
                  ).join("\n")
                )
              }</textarea>
          </label>

        </section>

      </div>
    `;
  }


  renderBoasVindas() {

    return `

      ${this.cardTitulo(
        "mdi:home-heart",
        "Boas-vindas",
        "Mensagens após chegada confirmada, com anti-repetição e múltiplos canais."
      )}

      <div class="grid two">

        <section class="config-card">

          <h3>Comportamento</h3>

          ${this.alternador(
            "boas_vindas.habilitada",
            "Boas-vindas habilitadas"
          )}

          ${this.campo(
            "boas_vindas.atraso_segundos",
            "Aguardar após chegada",
            "number",
            0,
            1800,
            1
          )}

          ${this.alternador(
            "boas_vindas.agrupar_chegadas",
            "Agrupar moradores chegando juntos"
          )}

          ${this.campo(
            "boas_vindas.janela_agrupamento_segundos",
            "Janela de agrupamento",
            "number",
            0,
            1800,
            1
          )}

          ${this.alternador(
            "boas_vindas.confirmar_presenca_antes_de_enviar",
            "Confirmar presença antes de anunciar"
          )}

          ${this.alternador(
            "boas_vindas.anti_repeticao",
            "Anti-repetição"
          )}

          ${this.campo(
            "boas_vindas.quantidade_anti_repeticao",
            "Não repetir últimas",
            "number",
            0,
            100,
            1
          )}

        </section>


        <section class="config-card">

          <h3>Canais</h3>

          ${this.alternador(
            "boas_vindas.celular",
            "Enviar ao celular"
          )}

          ${this.alternador(
            "boas_vindas.alexa",
            "Anunciar na Alexa"
          )}

          ${this.alternador(
            "boas_vindas.google_home",
            "Anunciar no Google Home"
          )}

        </section>

      </div>


      <section class="config-card">

        <h3>Banco de mensagens</h3>

        <div class="form-grid">

          ${this.areaMensagens(
            "boas_vindas.mensagens.manha",
            "Manhã"
          )}

          ${this.areaMensagens(
            "boas_vindas.mensagens.tarde",
            "Tarde"
          )}

          ${this.areaMensagens(
            "boas_vindas.mensagens.noite",
            "Noite"
          )}

          ${this.areaMensagens(
            "boas_vindas.mensagens.gerais",
            "Gerais"
          )}

          ${this.areaMensagens(
            "boas_vindas.mensagens.familia",
            "Chegada de família"
          )}

        </div>

      </section>
    `;
  }


  renderNotificacoes() {

    const eventos = [
      ["armado", "Alarme armado"],
      ["desarmado", "Alarme desarmado"],
      ["entrada", "Alerta de entrada"],
      ["disparo", "Disparo"],
      ["panico", "Pânico"],
      ["bateria_baixa", "Bateria baixa"],
      ["dispositivo_offline", "Dispositivo offline"],
      ["boas_vindas", "Boas-vindas"]
    ];

    return `

      ${this.cardTitulo(
        "mdi:bell-ring-outline",
        "Notificações",
        "Escolha os canais utilizados para cada evento."
      )}

      <section class="config-card">

        ${this.alternador(
          "notificacoes.habilitadas",
          "Notificações habilitadas"
        )}

        ${this.alternador(
          "notificacoes.celular",
          "Celular"
        )}

        ${this.alternador(
          "notificacoes.alexa",
          "Alexa"
        )}

        ${this.alternador(
          "notificacoes.google_home",
          "Google Home"
        )}

      </section>


      <section class="config-card">

        <h3>Política por evento</h3>

        <div class="event-table">

          <div class="event-head">
            <b>Evento</b>
            <b>Celular</b>
            <b>Voz</b>
            <b>Crítico</b>
          </div>

          ${eventos.map(
            ([id, nome]) => `

            <div class="event-row">

              <strong>
                ${this.esc(nome)}
              </strong>

              ${this.checkboxCompacto(
                `notificacoes.eventos.${id}.celular`
              )}

              ${this.checkboxCompacto(
                `notificacoes.eventos.${id}.voz`
              )}

              ${this.checkboxCompacto(
                `notificacoes.eventos.${id}.critica`
              )}

            </div>

          `).join("")}

        </div>

      </section>


      <section class="config-card">

        <h3>Silêncio de voz</h3>

        ${this.alternador(
          "notificacoes.silencio_voz.habilitado",
          "Ativar horário silencioso"
        )}

        <div class="form-grid">

          ${this.campo(
            "notificacoes.silencio_voz.inicio",
            "Início",
            "time"
          )}

          ${this.campo(
            "notificacoes.silencio_voz.fim",
            "Fim",
            "time"
          )}

        </div>

        ${this.alternador(
          "notificacoes.silencio_voz.respeitar_modo_dormindo",
          "Silenciar voz quando a casa estiver Dormindo"
        )}

        ${this.alternador(
          "notificacoes.silencio_voz.respeitar_modo_visita",
          "Silenciar voz em Modo Visita"
        )}

        ${this.alternador(
          "notificacoes.silencio_voz.emergencias_ignoram_silencio",
          "Emergências ignoram o silêncio"
        )}

      </section>
    `;
  }


  checkboxCompacto(path) {

    return `
      <label class="mini-check">
        <input
          type="checkbox"
          data-path="${this.esc(path)}"
          ${
            this.getPath(path)
              ? "checked"
              : ""
          }>
        <span></span>
      </label>
    `;
  }


  renderVoz() {

    const dispositivos =
      this._config.voz.dispositivos;

    return `

      ${this.cardTitulo(
        "mdi:speaker-multiple",
        "Alexa e Google Home",
        "Dispositivos de voz utilizados por avisos e boas-vindas."
      )}

      <section class="config-card">

        ${this.alternador(
          "voz.habilitada",
          "Notificações por voz"
        )}

        ${this.campo(
          "voz.volume_anuncio",
          "Volume durante anúncio",
          "number",
          0,
          1,
          0.05
        )}

        ${this.alternador(
          "voz.restaurar_volume",
          "Restaurar volume após anúncio"
        )}

      </section>


      <div class="repeat-list">

        ${dispositivos.map(
          (d, i) => `

          <section class="config-card">

            <div class="card-bar">

              <h3>
                ${this.esc(
                  d.nome
                  || `Dispositivo de voz ${i + 1}`
                )}
              </h3>

              <button
                class="danger small"
                data-remove="voz.dispositivos"
                data-index="${i}">
                Remover
              </button>

            </div>

            <div class="form-grid">

              ${this.campo(
                `voz.dispositivos.${i}.nome`,
                "Nome"
              )}

              ${this.seletor(
                `voz.dispositivos.${i}.tipo`,
                "Tipo",
                [
                  {value:"alexa", label:"Alexa"},
                  {value:"google_home", label:"Google Home"}
                ]
              )}

              ${this.seletorEntidade(
                `voz.dispositivos.${i}.entidade`,
                "Media Player",
                ["media_player"]
              )}

              ${this.campo(
                `voz.dispositivos.${i}.servico_notificacao`,
                "Serviço de anúncio"
              )}

            </div>

            ${this.alternador(
              `voz.dispositivos.${i}.habilitado`,
              "Usar este dispositivo"
            )}

          </section>

        `).join("")}

      </div>

      <button
        class="primary"
        data-add="voz">

        <ha-icon icon="mdi:speaker-plus"></ha-icon>
        Adicionar dispositivo de voz

      </button>
    `;
  }


  renderVideo() {

    return `

      ${this.cardTitulo(
        "mdi:cctv",
        "Câmeras e Vídeo Porteiro",
        "Campainha, snapshots e permanência no portão."
      )}

      <div class="grid two">

        <section class="config-card">

          <h3>Vídeo porteiro</h3>

          ${this.alternador(
            "video_porteiro.habilitado",
            "Vídeo porteiro habilitado"
          )}

          ${this.seletorEntidade(
            "video_porteiro.evento_campainha",
            "Evento da campainha",
            ["event"]
          )}

          ${this.seletorEntidade(
            "video_porteiro.camera",
            "Câmera",
            ["camera"]
          )}

          ${this.alternador(
            "video_porteiro.snapshot",
            "Gerar snapshot"
          )}

          ${this.alternador(
            "video_porteiro.enviar_imagem_celular",
            "Enviar imagem ao celular"
          )}

          ${this.alternador(
            "video_porteiro.mostrar_em_display",
            "Mostrar em display compatível"
          )}

          ${this.campo(
            "video_porteiro.cooldown_campainha_segundos",
            "Cooldown da campainha",
            "number",
            0,
            3600,
            1
          )}

        </section>


        <section class="config-card">

          <h3>Pessoa parada no portão</h3>

          ${this.alternador(
            "video_porteiro.pessoa_parada.habilitada",
            "Detecção habilitada"
          )}

          ${this.campo(
            "video_porteiro.pessoa_parada.tempo_validacao_segundos",
            "Tempo de validação",
            "number",
            0,
            3600,
            1
          )}

          ${this.campo(
            "video_porteiro.pessoa_parada.cooldown_segundos",
            "Cooldown",
            "number",
            0,
            86400,
            1
          )}

        </section>

      </div>
    `;
  }


  renderGas() {

    return `

      ${this.cardTitulo(
        "mdi:gas-cylinder",
        "Segurança de Gás",
        "Vazamento, indisponibilidade, persistência e check-up."
      )}

      <div class="grid two">

        <section class="config-card">

          <h3>Sensor</h3>

          ${this.alternador(
            "gas.habilitado",
            "Monitoramento de gás"
          )}

          ${this.seletorEntidade(
            "gas.sensor",
            "Sensor",
            [
              "binary_sensor",
              "sensor"
            ]
          )}

          ${this.campo(
            "gas.confirmacao_vazamento_segundos",
            "Confirmação de vazamento",
            "number",
            0,
            300,
            1
          )}

          ${this.campo(
            "gas.vazamento_persistente_segundos",
            "Vazamento persistente",
            "number",
            0,
            3600,
            1
          )}

          ${this.campo(
            "gas.offline_segundos",
            "Considerar offline após",
            "number",
            0,
            86400,
            1
          )}

        </section>


        <section class="config-card">

          <h3>Alertas e check-up</h3>

          ${this.alternador(
            "gas.checkup_diario",
            "Check-up diário"
          )}

          ${this.campo(
            "gas.horario_checkup",
            "Horário do check-up",
            "time"
          )}

          ${this.alternador(
            "gas.notificacao_critica",
            "Notificação crítica"
          )}

          ${this.alternador(
            "gas.ignorar_silencio",
            "Emergência ignora silêncio"
          )}

          ${this.alternador(
            "gas.celular",
            "Celular"
          )}

          ${this.alternador(
            "gas.alexa",
            "Alexa"
          )}

          ${this.alternador(
            "gas.google_home",
            "Google Home"
          )}

        </section>

      </div>
    `;
  }


  renderVisita() {

    return `

      ${this.cardTitulo(
        "mdi:account-multiple-check-outline",
        "Modo Visita",
        "Defina o que deve ser suspenso enquanto houver visitantes."
      )}

      <section class="config-card">

        ${this.alternador(
          "modo_visita.habilitado",
          "Modo Visita disponível"
        )}

        ${this.alternador(
          "modo_visita.bloquear_armamento_automatico",
          "Bloquear armamento automático"
        )}

        ${this.alternador(
          "modo_visita.bloquear_boas_vindas",
          "Bloquear boas-vindas"
        )}

        ${this.alternador(
          "modo_visita.bloquear_voz",
          "Bloquear anúncios por voz"
        )}

        ${this.alternador(
          "modo_visita.bloquear_alerta_portao",
          "Suspender alerta de portão aberto"
        )}

      </section>
    `;
  }


  renderViagem() {

    return `

      ${this.cardTitulo(
        "mdi:airplane",
        "Modo Viagem",
        "Reforço de segurança e simulação de presença."
      )}

      <section class="config-card">

        ${this.alternador(
          "modo_viagem.habilitado",
          "Modo Viagem disponível"
        )}

        ${this.alternador(
          "modo_viagem.reforcar_seguranca",
          "Reforçar segurança"
        )}

        ${this.alternador(
          "modo_viagem.simulacao_presenca",
          "Simular presença"
        )}

        <div class="form-grid">

          ${this.campo(
            "modo_viagem.inicio_simulacao",
            "Início da simulação",
            "time"
          )}

          ${this.campo(
            "modo_viagem.fim_simulacao",
            "Fim da simulação",
            "time"
          )}

        </div>

        ${this.alternador(
          "modo_viagem.monitorar_iluminacao_inesperada",
          "Monitorar iluminação inesperada"
        )}

      </section>
    `;
  }


  renderAuditoria() {

    return `

      ${this.cardTitulo(
        "mdi:clipboard-check-outline",
        "Auditorias",
        "Verificação periódica do estado real da residência."
      )}

      <section class="config-card">

        ${this.alternador(
          "auditoria.habilitada",
          "Auditoria habilitada"
        )}

        ${this.campo(
          "auditoria.horario",
          "Horário",
          "time"
        )}

        <div class="switch-grid">

          ${this.alternador(
            "auditoria.verificar_alarme",
            "Verificar alarme"
          )}

          ${this.alternador(
            "auditoria.verificar_portoes",
            "Verificar portões"
          )}

          ${this.alternador(
            "auditoria.verificar_cerca",
            "Verificar cerca"
          )}

          ${this.alternador(
            "auditoria.verificar_sensores",
            "Verificar sensores"
          )}

          ${this.alternador(
            "auditoria.verificar_dispositivos_offline",
            "Verificar dispositivos offline"
          )}

          ${this.alternador(
            "auditoria.verificar_luzes",
            "Verificar luzes"
          )}

        </div>

      </section>
    `;
  }


  renderIncidentes() {

    return `

      ${this.cardTitulo(
        "mdi:alert-decagram-outline",
        "Incidentes e Estatísticas",
        "Defina o que gera incidente e os indicadores de estabilidade."
      )}

      <div class="grid two">

        <section class="config-card">

          <h3>Incidentes</h3>

          ${this.alternador(
            "incidentes.habilitados",
            "Incident Engine"
          )}

          ${this.alternador(
            "incidentes.publicar_no_noc",
            "Publicar também no NOC"
          )}

          ${this.alternador(
            "incidentes.portao_casa_vazia",
            "Portão aberto com casa vazia"
          )}

          ${this.alternador(
            "incidentes.cerca_desligada_casa_vazia",
            "Cerca desligada com casa vazia"
          )}

          ${this.alternador(
            "incidentes.sensor_offline",
            "Sensor offline"
          )}

          ${this.alternador(
            "incidentes.tamper",
            "Tamper"
          )}

          ${this.alternador(
            "incidentes.gas",
            "Eventos de gás"
          )}

        </section>


        <section class="config-card">

          <h3>Indicadores</h3>

          ${this.alternador(
            "estatisticas.habilitadas",
            "Estatísticas habilitadas"
          )}

          ${this.alternador(
            "estatisticas.contabilizar_disparos",
            "Contabilizar disparos"
          )}

          ${this.alternador(
            "estatisticas.contabilizar_falhas",
            "Contabilizar falhas"
          )}

          ${this.alternador(
            "estatisticas.dias_sem_falhas",
            "Dias sem falhas"
          )}

        </section>

      </div>
    `;
  }


  renderAvancado() {

    return `

      ${this.cardTitulo(
        "mdi:tune-variant",
        "Avançado",
        "Parâmetros internos e visão técnica da configuração."
      )}

      <section class="config-card">

        <div class="technical-grid">

          <div>
            <span>Versão</span>
            <b>${CP_SEG_VERSION}</b>
          </div>

          <div>
            <span>Modo</span>
            <b>
              ${
                this._config
                  ?.geral
                  ?.modo_sombra
                  ? "Sombra"
                  : "Ativo"
              }
            </b>
          </div>

          <div>
            <span>Moradores</span>
            <b>
              ${this._config.moradores.length}
            </b>
          </div>

          <div>
            <span>Sensores</span>
            <b>
              ${this._config.dispositivos.length}
            </b>
          </div>

          <div>
            <span>Zonas</span>
            <b>
              ${this._config.zonas.length}
            </b>
          </div>

          <div>
            <span>Portões</span>
            <b>
              ${this._config.portoes.length}
            </b>
          </div>

        </div>

      </section>


      <section class="config-card">

        <h3>Configuração persistida</h3>

        <pre>${this.esc(
          JSON.stringify(
            this._config,
            null,
            2
          )
        )}</pre>

      </section>
    `;
  }


  renderConteudo() {

    const mapa = {

      geral:
        () => this.renderGeral(),

      moradores:
        () => this.renderMoradores(),

      presenca:
        () => this.renderPresenca(),

      alarme:
        () => this.renderAlarme(),

      sensores:
        () => this.renderSensores(),

      zonas:
        () => this.renderZonas(),

      cerca:
        () => this.renderCerca(),

      portoes:
        () => this.renderPortoes(),

      controles:
        () => this.renderControles(),

      resposta:
        () => this.renderResposta(),

      boas_vindas:
        () => this.renderBoasVindas(),

      notificacoes:
        () => this.renderNotificacoes(),

      voz:
        () => this.renderVoz(),

      video:
        () => this.renderVideo(),

      gas:
        () => this.renderGas(),

      visita:
        () => this.renderVisita(),

      viagem:
        () => this.renderViagem(),

      auditoria:
        () => this.renderAuditoria(),

      incidentes:
        () => this.renderIncidentes(),

      avancado:
        () => this.renderAvancado()
    };

    return (
      mapa[this._aba]
      || mapa.geral
    )();
  }


  navItems() {

    return [
      ["geral", "mdi:shield-cog-outline", "Geral"],
      ["moradores", "mdi:account-group-outline", "Moradores"],
      ["presenca", "mdi:map-marker-account-outline", "Presença e Wi-Fi"],
      ["alarme", "mdi:shield-lock-outline", "Central de Alarme"],
      ["sensores", "mdi:access-point", "Sensores"],
      ["zonas", "mdi:vector-square", "Zonas"],
      ["cerca", "mdi:electric-switch", "Cerca Elétrica"],
      ["portoes", "mdi:garage-variant", "Portões"],
      ["controles", "mdi:remote", "Controles Físicos"],
      ["resposta", "mdi:alarm-light-outline", "Sirene e Luzes"],
      ["boas_vindas", "mdi:home-heart", "Boas-vindas"],
      ["notificacoes", "mdi:bell-ring-outline", "Notificações"],
      ["voz", "mdi:speaker-multiple", "Alexa e Google Home"],
      ["video", "mdi:cctv", "Câmeras e Vídeo"],
      ["gas", "mdi:gas-cylinder", "Segurança de Gás"],
      ["visita", "mdi:account-multiple-check-outline", "Modo Visita"],
      ["viagem", "mdi:airplane", "Modo Viagem"],
      ["auditoria", "mdi:clipboard-check-outline", "Auditorias"],
      ["incidentes", "mdi:alert-decagram-outline", "Incidentes"],
      ["avancado", "mdi:tune-variant", "Avançado"]
    ];
  }


  adicionar(tipo) {

    if (tipo === "morador") {

      this._config.moradores.push({
        id:
          "morador_"
          + Date.now(),

        nome: "",
        nome_voz: "",

        entidade_pessoa: "",
        entidade_wifi: "",

        servico_celular: "",

        habilitado: true,
        desarmar_automaticamente: true,
        participa_ausencia: true,
        receber_notificacoes: true,
        boas_vindas: true
      });

      this._aba = "moradores";
    }


    else if (tipo === "zona") {

      this._config.zonas.push({
        id:
          "zona_"
          + Date.now(),

        nome: "",

        habilitado: true,

        criticidade: "alta",

        armar_parcial: true,
        armar_total: true,

        delay_entrada: false,

        bypass_permitido: true
      });

      this._aba = "zonas";
    }


    else if (
      tipo === "dispositivo"
    ) {

      this._config.dispositivos.push({
        id:
          "dispositivo_"
          + Date.now(),

        nome: "",

        tipo: "porta",

        entidade: "",

        zona: "",

        habilitado: true,

        armado_parcial: true,
        armado_total: true,

        disparo_imediato: false,

        monitorar_bateria: true,
        monitorar_tamper: true
      });

      this._aba = "sensores";
    }


    else if (
      tipo === "portao"
    ) {

      this._config.portoes.push({
        id:
          "portao_"
          + Date.now(),

        nome: "",

        entidade: "",

        habilitado: true,

        tempo_aberto_alerta_segundos: 300,

        alerta_casa_vazia: true,

        alerta_ao_dormir: true,

        permitir_painel: true
      });

      this._aba = "portoes";
    }


    else if (
      tipo === "controle"
    ) {

      this._config
        .controles_fisicos
        .push({

          id:
            "controle_"
            + Date.now(),

          nome: "",

          comando:
            "desarmar",

          entidade: "",

          evento: "",

          habilitado: true
        });

      this._aba = "controles";
    }


    else if (
      tipo === "voz"
    ) {

      this._config
        .voz
        .dispositivos
        .push({

          id:
            "voz_"
            + Date.now(),

          nome: "",

          tipo: "alexa",

          entidade: "",

          servico_notificacao: "",

          habilitado: true
        });

      this._aba = "voz";
    }

    this._dirty = true;

    this.render();
  }


  remover(
    categoria,
    indice
  ) {

    let alvo =
      this.getPath(categoria);

    if (!Array.isArray(alvo)) {
      return;
    }

    alvo.splice(
      Number(indice),
      1
    );

    this._dirty = true;

    this.render();
  }


  bind() {

    this.shadowRoot
      .querySelectorAll(
        "[data-tab]"
      )
      .forEach(button => {

        button.onclick = () => {

          this._aba =
            button.dataset.tab;

          this.render();
        };
      });


    this.shadowRoot
      .querySelectorAll(
        "[data-path]"
      )
      .forEach(element => {

        const handler = () => {

          let value;

          if (
            element.dataset.lista
            === "linhas"
          ) {

            value =
              String(
                element.value || ""
              )
                .split("\n")
                .map(x => x.trim())
                .filter(Boolean);
          }

          else if (
            element.type
            === "checkbox"
          ) {

            value =
              element.checked;
          }

          else if (
            element.type
            === "number"
          ) {

            value =
              element.value === ""
              ? 0
              : Number(
                  element.value
                );
          }

          else {

            value =
              element.value;
          }

          this.setPath(
            element.dataset.path,
            value
          );
        };

        element.addEventListener(
          "change",
          handler
        );

        if (
          element.tagName
          === "TEXTAREA"
        ) {
          element.addEventListener(
            "input",
            handler
          );
        }
      });


    this.shadowRoot
      .querySelectorAll(
        "[data-add]"
      )
      .forEach(button => {

        button.onclick = () =>
          this.adicionar(
            button.dataset.add
          );
      });


    this.shadowRoot
      .querySelectorAll(
        "[data-remove]"
      )
      .forEach(button => {

        button.onclick = () =>
          this.remover(
            button.dataset.remove,
            button.dataset.index
          );
      });


    this.shadowRoot
      .querySelector(
        "#autodetectar"
      )
      ?.addEventListener(
        "click",
        () => this.autodetectar()
      );


    this.shadowRoot
      .querySelector(
        "#salvar"
      )
      ?.addEventListener(
        "click",
        () => this.salvar()
      );


    this.shadowRoot
      .querySelector(
        "#recarregar"
      )
      ?.addEventListener(
        "click",
        () => {

          if (
            this._dirty
            && !confirm(
              "Descartar alterações não salvas?"
            )
          ) {
            return;
          }

          this._loaded = false;
          this.carregar();
        }
      );
  }


  toast(
    mensagem,
    erro = false
  ) {

    const el =
      this.shadowRoot
        ?.querySelector(
          "#toast"
        );

    if (!el) {
      return;
    }

    el.textContent = mensagem;

    el.className =
      erro
      ? "toast show error"
      : "toast show";

    clearTimeout(
      this._toastTimer
    );

    this._toastTimer =
      setTimeout(
        () => {
          el.className =
            "toast";
        },
        3500
      );
  }


  render() {

    if (
      this._loading
      && !this._loaded
    ) {

      this.shadowRoot.innerHTML = `
        ${this.styles()}
        <div class="loading">
          <div class="spinner"></div>
          <h2>Carregando Segurança...</h2>
          <p>
            Lendo a configuração do módulo.
          </p>
        </div>
      `;

      return;
    }


    if (
      this._error
      && !this._loaded
    ) {

      this.shadowRoot.innerHTML = `
        ${this.styles()}
        <div class="loading error-box">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <h2>
            Não foi possível carregar
          </h2>
          <p>
            ${this.esc(this._error)}
          </p>
          <button
            id="retry"
            class="primary">
            Tentar novamente
          </button>
        </div>
      `;

      this.shadowRoot
        .querySelector(
          "#retry"
        )
        ?.addEventListener(
          "click",
          () => this.carregar()
        );

      return;
    }


    if (!this._config) {

      this.shadowRoot.innerHTML = `
        ${this.styles()}
        <div class="loading">
          <div class="spinner"></div>
          <h2>
            Preparando CloudPelizzon Segurança
          </h2>
        </div>
      `;

      return;
    }


    const modoSombra =
      Boolean(
        this._config
          ?.geral
          ?.modo_sombra
      );


    this.shadowRoot.innerHTML = `
      ${this.styles()}

      <div class="app">

        <header class="hero">

          <div class="hero-glow"></div>

          <div class="hero-main">

            <div class="shield">

              <ha-icon
                icon="mdi:shield-home">
              </ha-icon>

              <i></i>

            </div>

            <div>

              <span class="eyebrow">
                CLOUDPELIZZON • CP-SECURITY
              </span>

              <h1>
                Central de Segurança
              </h1>

              <p>
                Configure presença, alarme,
                perímetro, respostas, vídeo,
                gás e notificações.
              </p>

            </div>

          </div>


          <div class="hero-status"><button id="cp-back-dashboard" class="secondary"><ha-icon icon="mdi:view-dashboard-outline"></ha-icon>Dashboard</button>

            <span class="${
              modoSombra
                ? "badge shadow"
                : "badge active"
            }">

              <ha-icon
                icon="${
                  modoSombra
                    ? "mdi:eye-outline"
                    : "mdi:shield-check"
                }">
              </ha-icon>

              ${
                modoSombra
                  ? "MODO SOMBRA"
                  : "MODO ATIVO"
              }

            </span>

            <span
              id="estado-salvamento"
              class="save-state ${
                this._dirty
                  ? "dirty"
                  : "saved"
              }">

              ${
                this._dirty
                  ? "Alterações não salvas"
                  : "Configuração salva"
              }

            </span>

            <button
              id="autodetectar"
              class="secondary intel">

              <ha-icon
                icon="mdi:auto-fix">
              </ha-icon>

              Inteligência automática

            </button>


            <button
              id="recarregar"
              class="secondary">
              <ha-icon
                icon="mdi:reload">
              </ha-icon>
              Recarregar
            </button>

            <button
              id="salvar"
              class="primary"
              ${this._saving ? "disabled" : ""}>

              <ha-icon
                icon="mdi:content-save-outline">
              </ha-icon>

              Salvar configuração

            </button>

          </div>

        </header>


        <div class="workspace">

          <aside class="sidebar">

            <div class="menu-title">
              CONFIGURAÇÕES
            </div>

            ${this.navItems().map(
              ([id, icon, nome]) => `

              <button
                data-tab="${id}"
                class="${
                  this._aba === id
                    ? "active"
                    : ""
                }">

                <ha-icon
                  icon="${icon}">
                </ha-icon>

                <span>
                  ${this.esc(nome)}
                </span>

              </button>

            `).join("")}

          </aside>


          <main class="content">

            ${this.renderConteudo()}

          </main>

        </div>

      </div>

      <div
        id="toast"
        class="toast">
      </div>
    `;

    this.bind();
  }


  styles() {

    return `
      <style>

        :host {
          display:block;
          min-height:100vh;
          background:
            #020a11;
          color:#eaf7ff;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        * {
          box-sizing:border-box;
        }

        button,
        input,
        select,
        textarea {
          font:inherit;
        }


        .app {
          min-height:100vh;
          background:
            radial-gradient(
              circle at 52% 4%,
              rgba(0,157,255,.10),
              transparent 28%
            ),
            radial-gradient(
              circle at 88% 22%,
              rgba(0,255,210,.04),
              transparent 22%
            ),
            #020a11;
        }


        .hero {
          position:sticky;
          top:0;
          z-index:20;

          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:22px;

          padding:18px 24px;

          border-bottom:
            1px solid
            rgba(61,184,237,.18);

          background:
            rgba(3,15,24,.94);

          backdrop-filter:
            blur(18px);

          box-shadow:
            0 18px 50px
            rgba(0,0,0,.20);

          overflow:hidden;
        }


        .hero-glow {
          position:absolute;
          width:340px;
          height:340px;
          border-radius:50%;

          left:-130px;
          top:-260px;

          border:
            1px solid
            rgba(35,192,255,.20);

          box-shadow:
            0 0 100px
            rgba(0,169,255,.10);

          pointer-events:none;
        }


        .hero-main {
          position:relative;
          display:flex;
          align-items:center;
          gap:15px;
          z-index:1;
        }


        .shield {
          position:relative;

          width:58px;
          height:58px;

          flex:0 0 auto;

          display:grid;
          place-items:center;

          border-radius:18px;

          background:
            linear-gradient(
              145deg,
              rgba(12,112,170,.36),
              rgba(3,27,41,.86)
            );

          border:
            1px solid
            rgba(60,201,255,.45);

          box-shadow:
            inset 0 0 25px
            rgba(31,181,255,.08),
            0 0 32px
            rgba(31,181,255,.10);
        }


        .shield ha-icon {
          --mdc-icon-size:30px;
          color:#54d1ff;
        }


        .shield i {
          position:absolute;
          inset:-5px;

          border:
            1px solid
            rgba(67,204,255,.15);

          border-radius:21px;

          animation:
            cpShield 3.2s
            ease-in-out infinite;
        }


        @keyframes cpShield {
          0%,100% {
            opacity:.25;
            transform:scale(.96);
          }

          50% {
            opacity:.85;
            transform:scale(1.05);
          }
        }


        .eyebrow {
          display:block;
          margin-bottom:4px;

          color:#36bfff;

          font-size:9px;
          font-weight:900;
          letter-spacing:.18em;
        }


        .hero h1 {
          margin:0;
          font-size:25px;
          letter-spacing:-.025em;
        }


        .hero p {
          margin:5px 0 0;

          color:#7895a5;
          font-size:10px;
        }


        .hero-status {
          position:relative;
          z-index:1;

          display:flex;
          align-items:center;
          justify-content:flex-end;
          gap:8px;

          flex-wrap:wrap;
        }


        .badge,
        .save-state {
          display:inline-flex;
          align-items:center;
          gap:6px;

          min-height:31px;
          padding:6px 10px;

          border-radius:999px;

          font-size:9px;
          font-weight:900;
          letter-spacing:.06em;
        }


        .badge.shadow {
          color:#ffd872;

          background:
            rgba(92,66,8,.32);

          border:
            1px solid
            rgba(255,207,83,.35);
        }


        .badge.active {
          color:#76ffca;

          background:
            rgba(4,78,53,.32);

          border:
            1px solid
            rgba(78,255,184,.30);
        }


        .save-state.saved {
          color:#6bd6ff;
        }


        .save-state.dirty {
          color:#ffcf6b;
        }


        .save-state.saving {
          color:#fff;
        }


        .workspace {
          display:grid;
          grid-template-columns:
            230px minmax(0,1fr);

          min-height:
            calc(100vh - 95px);
        }


        .sidebar {
          position:sticky;
          top:95px;

          align-self:start;

          max-height:
            calc(100vh - 95px);

          overflow:auto;

          padding:15px 10px 24px;

          border-right:
            1px solid
            rgba(67,169,216,.13);

          background:
            rgba(3,14,22,.64);
        }


        .menu-title {
          padding:8px 10px 12px;

          color:#547789;

          font-size:8px;
          font-weight:900;
          letter-spacing:.18em;
        }


        .sidebar button {
          width:100%;

          display:flex;
          align-items:center;
          gap:10px;

          margin:2px 0;
          padding:10px 11px;

          border:
            1px solid transparent;

          border-radius:10px;

          background:transparent;

          color:#91abb8;

          cursor:pointer;

          text-align:left;

          font-size:10px;
          font-weight:750;

          transition:.16s;
        }


        .sidebar button:hover {
          color:#dff7ff;

          background:
            rgba(31,121,164,.11);
        }


        .sidebar button.active {
          color:#fff;

          border-color:
            rgba(46,188,255,.30);

          background:
            linear-gradient(
              90deg,
              rgba(0,133,214,.22),
              rgba(0,83,133,.06)
            );

          box-shadow:
            inset 3px 0 0
            #23baff;
        }


        .sidebar ha-icon {
          --mdc-icon-size:17px;
        }


        .content {
          width:100%;
          max-width:1450px;

          padding:
            24px 26px 60px;

          margin:0 auto;
        }


        .section-head {
          display:flex;
          align-items:center;
          gap:14px;

          margin-bottom:19px;
        }


        .section-icon {
          width:49px;
          height:49px;

          display:grid;
          place-items:center;

          border-radius:15px;

          border:
            1px solid
            rgba(56,195,255,.30);

          background:
            rgba(6,55,79,.38);

          color:#46cbff;
        }


        .section-icon ha-icon {
          --mdc-icon-size:25px;
        }


        .section-head h2 {
          margin:0;

          font-size:22px;
          letter-spacing:-.02em;
        }


        .section-head p {
          margin:5px 0 0;

          color:#7896a5;

          font-size:10px;
        }


        .grid {
          display:grid;
          gap:14px;
        }


        .grid.two {
          grid-template-columns:
            repeat(
              2,
              minmax(0,1fr)
            );
        }


        .config-card {
          position:relative;

          padding:17px;

          margin-bottom:14px;

          border:
            1px solid
            rgba(74,168,209,.17);

          border-radius:17px;

          background:
            linear-gradient(
              145deg,
              rgba(7,26,38,.94),
              rgba(3,17,27,.92)
            );

          box-shadow:
            0 17px 45px
            rgba(0,0,0,.16);
        }


        .config-card:before {
          content:"";

          position:absolute;
          left:16px;
          right:16px;
          top:0;

          height:1px;

          background:
            linear-gradient(
              90deg,
              transparent,
              rgba(47,197,255,.25),
              transparent
            );
        }


        .config-card h3 {
          margin:0 0 14px;

          color:#dff6ff;

          font-size:12px;
          font-weight:850;
        }


        .card-bar {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;

          margin-bottom:12px;
        }


        .card-bar h3 {
          margin:0;
        }


        .form-grid {
          display:grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0,1fr)
            );

          gap:11px;
        }


        .campo {
          display:flex;
          flex-direction:column;
          gap:6px;

          margin-bottom:11px;

          color:#87a7b6;

          font-size:9px;
          font-weight:800;
        }


        .campo.wide {
          grid-column:1/-1;
        }


        .campo span {
          display:flex;
          justify-content:space-between;
          gap:8px;
        }


        .campo span small {
          color:#4d7488;
          font-size:8px;
          font-weight:600;
        }


        input,
        select,
        textarea {
          width:100%;

          padding:10px 11px;

          border:
            1px solid
            #173c4f;

          border-radius:9px;

          outline:none;

          color:#eaf9ff;

          background:#03121c;

          font-size:10px;
        }


        input:focus,
        select:focus,
        textarea:focus {
          border-color:#28bfff;

          box-shadow:
            0 0 0 3px
            rgba(40,191,255,.08);
        }


        textarea {
          resize:vertical;
          line-height:1.5;
        }


        .switch-grid {
          display:grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0,1fr)
            );

          gap:7px;
        }


        .switch-row {
          min-height:50px;

          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;

          padding:10px 11px;

          margin-bottom:7px;

          border-radius:10px;

          border:
            1px solid
            rgba(73,156,194,.12);

          background:
            rgba(3,18,28,.55);
        }


        .switch-copy b {
          display:block;

          color:#cfeaf6;

          font-size:9px;
          font-weight:800;
        }


        .switch-copy small {
          display:block;

          max-width:480px;

          margin-top:3px;

          color:#628292;

          font-size:8px;
          line-height:1.45;
        }


        .toggle {
          position:relative;

          width:38px;
          height:21px;

          flex:0 0 auto;
        }


        .toggle input {
          position:absolute;
          opacity:0;
          pointer-events:none;
        }


        .toggle i {
          position:absolute;
          inset:0;

          border-radius:999px;

          background:#17303d;

          border:
            1px solid
            #294b5c;

          transition:.18s;
        }


        .toggle i:after {
          content:"";

          position:absolute;
          width:15px;
          height:15px;

          left:2px;
          top:2px;

          border-radius:50%;

          background:#7694a2;

          transition:.18s;
        }


        .toggle input:checked + i {
          background:#075a82;

          border-color:#19b9ff;

          box-shadow:
            0 0 15px
            rgba(23,184,255,.15);
        }


        .toggle input:checked + i:after {
          left:19px;
          background:#63d8ff;
        }


        .intel {
          color:#8fffe2 !important;
          border-color:rgba(64,255,211,.44) !important;
          background:
            linear-gradient(
              135deg,
              rgba(8,74,83,.80),
              rgba(5,42,68,.90)
            ) !important;
          box-shadow:
            0 0 24px
            rgba(60,255,211,.08);
        }

        .intel ha-icon {
          color:#65f6d5;
        }


        .primary,
        .secondary,
        .danger {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:7px;

          padding:10px 13px;

          border-radius:9px;

          font-size:9px;
          font-weight:850;

          cursor:pointer;

          transition:.15s;
        }


        .primary {
          color:white;

          border:
            1px solid #25baff;

          background:
            linear-gradient(
              135deg,
              #0768a7,
              #0d9ce7
            );

          box-shadow:
            0 8px 24px
            rgba(0,138,218,.12);
        }


        .secondary {
          color:#c7e9f6;

          border:
            1px solid
            #285367;

          background:#082230;
        }


        .danger {
          color:#ff9b9b;

          border:
            1px solid
            rgba(255,88,88,.30);

          background:
            rgba(111,18,29,.20);
        }


        .small {
          padding:6px 9px;
          font-size:8px;
        }


        .primary:hover,
        .secondary:hover,
        .danger:hover {
          filter:brightness(1.13);
        }


        .primary:disabled {
          opacity:.5;
          cursor:wait;
        }


        .repeat-list {
          display:grid;
          gap:3px;
        }


        .event-table {
          overflow:hidden;

          border:
            1px solid
            rgba(59,155,199,.15);

          border-radius:11px;
        }


        .event-head,
        .event-row {
          display:grid;
          grid-template-columns:
            minmax(150px,1fr)
            90px 90px 90px;

          align-items:center;

          min-height:42px;

          padding:0 11px;
        }


        .event-head {
          color:#66899a;

          background:#061923;

          font-size:8px;
          letter-spacing:.08em;
          text-transform:uppercase;
        }


        .event-row {
          border-top:
            1px solid
            rgba(50,122,154,.10);

          color:#cce7f2;

          font-size:9px;
        }


        .mini-check {
          width:18px;
          height:18px;

          position:relative;

          display:block;
        }


        .mini-check input {
          position:absolute;
          opacity:0;
        }


        .mini-check span {
          position:absolute;
          inset:0;

          border-radius:5px;

          border:
            1px solid #31566a;

          background:#071b26;
        }


        .mini-check input:checked + span {
          border-color:#27c3ff;
          background:#0785bd;
        }


        .mini-check input:checked + span:after {
          content:"✓";

          position:absolute;
          inset:0;

          display:grid;
          place-items:center;

          color:white;
          font-size:11px;
          font-weight:900;
        }


        .technical-grid {
          display:grid;

          grid-template-columns:
            repeat(
              3,
              minmax(0,1fr)
            );

          gap:9px;
        }


        .technical-grid div {
          padding:12px;

          border:
            1px solid
            rgba(65,154,194,.15);

          border-radius:10px;

          background:#03131d;
        }


        .technical-grid span {
          display:block;

          color:#5d7f90;

          font-size:8px;
          font-weight:800;
        }


        .technical-grid b {
          display:block;

          margin-top:5px;

          color:#cfefff;

          font-size:13px;
        }


        pre {
          max-height:500px;
          overflow:auto;

          padding:15px;

          border-radius:11px;

          color:#9adbf6;

          background:#010b11;

          font-size:9px;
          line-height:1.55;
        }


        .loading {
          min-height:72vh;

          display:grid;
          place-items:center;
          align-content:center;
          gap:10px;

          text-align:center;

          color:#9cc4d5;
        }


        .loading h2 {
          margin:7px 0 0;
          color:#e7f8ff;
        }


        .loading p {
          max-width:500px;
          margin:0;
          font-size:10px;
        }


        .loading > ha-icon {
          --mdc-icon-size:42px;
          color:#ff7d7d;
        }


        .spinner {
          width:44px;
          height:44px;

          border-radius:50%;

          border:
            3px solid
            rgba(37,188,255,.15);

          border-top-color:#2dc5ff;

          animation:
            spin .75s
            linear infinite;
        }


        @keyframes spin {
          to {
            transform:rotate(360deg);
          }
        }


        .toast {
          position:fixed;
          right:22px;
          bottom:22px;
          z-index:1000;

          max-width:420px;

          padding:12px 15px;

          border-radius:11px;

          color:#dff8ff;

          background:#075074;

          border:
            1px solid #2bc6ff;

          font-size:10px;
          font-weight:800;

          opacity:0;

          transform:
            translateY(15px);

          pointer-events:none;

          transition:.20s;
        }


        .toast.show {
          opacity:1;
          transform:none;
        }


        .toast.error {
          background:#5b2027;
          border-color:#ff6774;
        }


        @media(
          max-width:1000px
        ) {

          .workspace {
            grid-template-columns:190px 1fr;
          }

          .grid.two,
          .form-grid,
          .switch-grid {
            grid-template-columns:1fr;
          }

          .campo.wide {
            grid-column:auto;
          }

        }


        @media(
          max-width:760px
        ) {

          .hero {
            position:relative;
            align-items:flex-start;
            flex-direction:column;

            padding:14px;
          }


          .hero-status {
            justify-content:flex-start;
          }


          .workspace {
            display:block;
          }


          .sidebar {
            position:sticky;
            top:0;

            z-index:19;

            display:flex;
            gap:5px;

            max-height:none;

            padding:8px;

            border-right:0;
            border-bottom:
              1px solid
              rgba(54,157,201,.16);

            overflow-x:auto;
            overflow-y:hidden;

            background:#03111a;
          }


          .menu-title {
            display:none;
          }


          .sidebar button {
            width:auto;
            flex:0 0 auto;
            margin:0;

            white-space:nowrap;
          }


          .sidebar button.active {
            box-shadow:none;
          }


          .content {
            padding:16px 12px 50px;
          }


          .event-head,
          .event-row {
            grid-template-columns:
              minmax(120px,1fr)
              55px 55px 55px;
          }


          .technical-grid {
            grid-template-columns:
              repeat(
                2,
                minmax(0,1fr)
              );
          }

        }

      </style>
    `;
  }

}


if (
  !customElements.get(
    "cloudpelizzon-security-panel"
  )
) {

  customElements.define(
    "cloudpelizzon-security-panel",
    CloudPelizzonSecurityPanel
  );
}
/* CP_SECURITY_V035_EXTENSION_LOADER */
import("/cloudpelizzon-security/frontend/cp-security-v035-extension.js?v=20260929-v035-r2");
/* CP_SECURITY_V036_EXTENSION_LOADER */
import("/cloudpelizzon-security/frontend/cp-security-v036-extension.js?v=20260929-v036-r1");
/* CP_SECURITY_V037_EXTENSION_LOADER */
import("/cloudpelizzon-security/frontend/cp-security-v037-extension.js?v=20260929-v037-r1");




























/* CP_SECURITY_V0610_RUNTIME_START */
(() => {
  'use strict';
  const TAG = 'cloudpelizzon-security-panel';
  const VERSION = '0.6.1';
  const ASSET = '/cloudpelizzon-security/frontend/assets/security-house-clean-v061.png?v=eab5163fcbda';
  const CAM_KEY = 'cloudpelizzon.security.v060.sensorview.cameras';
  const VIEW_KEY = 'cloudpelizzon.security.v060.view';

  const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const state = (host,id) => id ? host?._hass?.states?.[id] || null : null;
  const arr = v => Array.isArray(v) ? v : [];
  const fmtName = id => String(id||'').split('.',2).pop().replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());

  function allEntityStrings(value, out=new Set()) {
    if (typeof value === 'string' && /^[a-z_]+\.[a-z0-9_]+$/i.test(value)) out.add(value);
    else if (Array.isArray(value)) value.forEach(v=>allEntityStrings(v,out));
    else if (value && typeof value === 'object') Object.values(value).forEach(v=>allEntityStrings(v,out));
    return [...out];
  }

  function configuredIds(host, domains=[]) {
    const ids = allEntityStrings(host?._config || {});
    const ignored=new Set(arr(host?._config?.descoberta?.ignorados?.cameras));
    const filtered = ids.filter(id=>domains.some(d=>id.startsWith(d+'.'))).filter(id=>!ignored.has(id)&&state(host,id));
    if (filtered.length) return [...new Set(filtered)];
    return Object.keys(host?._hass?.states || {}).filter(id=>!ignored.has(id)&&domains.some(d=>id.startsWith(d+'.')));
  }

  function cameraIds(host) {
    const ignored=new Set(arr(host?._config?.descoberta?.ignorados?.cameras));
    return Object.keys(host?._hass?.states||{}).filter(id=>id.startsWith('camera.')&&!ignored.has(id)).sort((a,b)=>String(state(host,a)?.attributes?.friendly_name||a).localeCompare(String(state(host,b)?.attributes?.friendly_name||b),'pt-BR')).slice(0,24);
  }

  function batterySensors(host) {
    const rows=[];
    for (const [id,st] of Object.entries(host?._hass?.states||{})) {
      if (!id.startsWith('sensor.')) continue;
      const dc = String(st?.attributes?.device_class||'');
      const hay = norm(`${id} ${st?.attributes?.friendly_name||''}`);
      if (dc !== 'battery' && !/\bbateria\b|\bbattery\b/.test(hay)) continue;
      const n = Number(String(st.state).replace(',','.'));
      if (!Number.isFinite(n) || n<0 || n>100) continue;
      if (/iphone|inversor|microinversor/.test(hay)) continue;
      rows.push({id,name:String(st.attributes?.friendly_name||fmtName(id)),value:n});
    }
    return rows.sort((a,b)=>a.value-b.value || a.name.localeCompare(b.name));
  }

  function openingIds(host) {
    const group = state(host,'group.sensores_alarme_total');
    const members = arr(group?.attributes?.entity_id).filter(id=>id.startsWith('binary_sensor.') && state(host,id));
    if (members.length) return [...new Set(members)];
    return configuredIds(host,['binary_sensor']).filter(id=>{
      const st=state(host,id); const dc=norm(st?.attributes?.device_class||''); const hay=norm(`${id} ${st?.attributes?.friendly_name||''}`);
      return ['door','window','garage door','opening'].includes(dc) || /porta|janela|door|window/.test(hay);
    }).filter(id=>!/bateria|battery|violacao|tamper|occupancy|ocupacao|movimento|motion/.test(norm(`${id} ${state(host,id)?.attributes?.friendly_name||''}`)));
  }

  function openingType(host,id) {
    const st=state(host,id); const dc=norm(st?.attributes?.device_class||''); const hay=norm(`${id} ${st?.attributes?.friendly_name||''}`);
    if (dc==='window' || /janela|window/.test(hay)) return 'window';
    return 'door';
  }

  function isOpen(st) {
    return ['on','open','opening','detected','true'].includes(String(st?.state||'').toLowerCase());
  }

  function sensorCandidates(host) {
    const ids = configuredIds(host,['binary_sensor']);
    const seen=new Set(); const rows=[];
    for (const id of ids) {
      if (seen.has(id)) continue; seen.add(id);
      const st=state(host,id); if(!st) continue;
      const hay=norm(`${id} ${st.attributes?.friendly_name||''}`);
      const dc=norm(st.attributes?.device_class||'');
      if (/bateria|battery|violacao|tamper|linkquality|lqi|rssi|update/.test(hay)) continue;
      let type='sensor';
      if (openingIds(host).includes(id)) type=openingType(host,id);
      else if (['motion','occupancy','presence'].includes(dc) || /movimento|motion|occupancy|ocupacao|presenca/.test(hay)) type='motion';
      else continue;
      rows.push({id,name:String(st.attributes?.friendly_name||fmtName(id)),type,st});
    }
    return rows;
  }

  function stem(v) {
    return norm(v).replace(/sensor|binary|bateria|battery|nivel|level|percentual|percentage|ocupacao|occupancy|movimento|motion|porta|door|janela|window|contato|contact|status|estado/g,' ').replace(/\s+/g,' ').trim();
  }

  function batteryFor(host,item,batteries=batterySensors(host)) {
    const s=stem(`${item.id} ${item.name}`);
    let best=null, score=0;
    for(const b of batteries){
      const bs=stem(`${b.id} ${b.name}`); if(!bs||!s) continue;
      let sc=0;
      for(const token of s.split(' ').filter(x=>x.length>2)) if(bs.includes(token)) sc++;
      if(sc>score){score=sc;best=b;}
    }
    return score>0 ? best : null;
  }

  function residents(host) {
    const configured=arr(host?._config?.moradores).filter(x=>x && x.habilitado!==false);
    const ids=[];
    for(const r of configured){ const id=r.entidade_pessoa||r.person_entity||r.person; if(id && state(host,id)) ids.push({id,name:r.nome||r.nome_voz||state(host,id)?.attributes?.friendly_name||fmtName(id)}); }
    if(ids.length) return ids;
    const group=state(host,'group.moradores');
    let list=arr(group?.attributes?.entity_id).filter(id=>id.startsWith('person.')&&state(host,id));
    if(!list.length) list=Object.keys(host?._hass?.states||{}).filter(id=>id.startsWith('person.'));
    return list.map(id=>({id,name:String(state(host,id)?.attributes?.friendly_name||fmtName(id))}));
  }

  function residentInfo(host,r){
    const st=state(host,r.id); const raw=String(st?.state||'unknown');
    const cls=raw==='home'?'home':raw==='not_home'?'away':(['unknown','unavailable'].includes(raw)?'unknown':'zone');
    const label=raw==='home'?'Em casa':raw==='not_home'?'Fora de casa':raw==='unknown'?'Desconhecido':raw==='unavailable'?'Indisponível':raw;
    const pic=String(st?.attributes?.entity_picture||'');
    const picture=pic.startsWith('/api/camera_proxy/')?pic+(pic.includes('?')?'&':'?')+'cp_frame='+Math.floor(Date.now()/15000):pic;
    const ts=new Date(st?.last_changed||0).getTime(); const mins=Number.isFinite(ts)?Math.max(0,Math.floor((Date.now()-ts)/60000)):0;
    const since=mins<1?'agora':mins<60?`há ${mins} min`:`há ${Math.floor(mins/60)}h ${mins%60}min`;
    return {raw,cls,label,pic,since};
  }

  function alarmId(host){
    let chosen='';try{chosen=localStorage.getItem('cp_security_alarm_target134')||''}catch(_){}
    if(!chosen&&state(host,NATIVE_ALARM134)?.attributes?.server_supports_native)return NATIVE_ALARM134;
    if(chosen&&state(host,chosen))return chosen;
    const ids=Object.keys(host?._hass?.states||{}).filter(id=>id.startsWith('alarm_control_panel.'));
    const ready=ids.filter(id=>!['unknown','unavailable'].includes(String(state(host,id)?.state)));
    if(ready.includes('alarm_control_panel.cloudpelizzon_security'))return 'alarm_control_panel.cloudpelizzon_security';
    if(ready.includes('alarm_control_panel.alarme_residencial'))return 'alarm_control_panel.alarme_residencial';
    return ready.length===1?ready[0]:ids.length===1?ids[0]:'';
  }
  function alarmPicker(host){const ids=Object.keys(host?._hass?.states||{}).filter(id=>id.startsWith('alarm_control_panel.'));return `<select data-alarm-target aria-label="Central de alarme" style="margin-left:auto;max-width:58%;min-width:0;background:#042431;color:#dcf7ff;border:1px solid #12617a;border-radius:5px;font-size:10px"><option value="">Selecionar central</option>${ids.map(id=>`<option value="${esc(id)}" ${alarmId(host)===id?'selected':''}>${esc(state(host,id)?.attributes?.friendly_name||id)} · ${esc(state(host,id)?.state||'')}</option>`).join('')}</select>`;}

  function gateId(host){ return state(host,'cover.portao_da_garagem_door')?'cover.portao_da_garagem_door':configuredIds(host,['cover']).find(id=>/portao|garagem|gate|garage/.test(norm(`${id} ${state(host,id)?.attributes?.friendly_name||''}`)))||''; }
  function fenceId(host){ return state(host,'switch.cerca_eletrica_r3_cerca_eletrica')?'switch.cerca_eletrica_r3_cerca_eletrica':configuredIds(host,['switch']).find(id=>/cerca/.test(norm(`${id} ${state(host,id)?.attributes?.friendly_name||''}`)))||''; }
  function mode(host){ return state(host,'select.cloudpelizzon_security_mode')?.attributes?.server_supports_native?'select.cloudpelizzon_security_mode':'input_select.modo_casa'; }
  function visitId(host){ return state(host,'input_boolean.modo_visita')?'input_boolean.modo_visita':''; }

  function statuses(host){
    const openings=openingIds(host); const open=openings.filter(id=>isOpen(state(host,id)));
    const doors=openings.filter(id=>openingType(host,id)==='door'); const windows=openings.filter(id=>openingType(host,id)==='window');
    const cams=cameraIds(host); const camOnline=cams.filter(id=>!['unknown','unavailable'].includes(String(state(host,id)?.state||'')));
    const entities=[...new Set([...configuredIds(host,['binary_sensor','sensor','camera','cover','switch']),...openings])];
    const offline=entities.filter(id=>['unknown','unavailable'].includes(String(state(host,id)?.state||'')));
    const bats=batterySensors(host); const crit=bats.filter(x=>x.value<15); const attention=bats.filter(x=>x.value>=15&&x.value<30);
    const fence=fenceId(host), gate=gateId(host), alarm=alarmId(host), house=String(state(host,mode(host))?.state||'Casa');
    const fenceOn=String(state(host,fence)?.state||'off')==='on'; const gateRaw=String(state(host,gate)?.state||'unknown'); const alarmRaw=String(state(host,alarm)?.state||'unknown');
    const gas=state(host,'binary_sensor.gas_sensor_2_gas');
    const alerts=[];
    const native=state(host,NATIVE_ALARM134);
    if(native&&['unavailable','unknown'].includes(native.state))alerts.push({tone:'red',icon:'mdi:shield-alert',title:'Central virtual sem confirmação do motor',sub:'Confira conexão e acesso do módulo',entity:NATIVE_ALARM134});
    for(const fault of native?.attributes?.faults||[])alerts.push({tone:'red',icon:'mdi:shield-alert',title:fault==='no_protection_sensors'?'Central virtual sem sensores configurados':fault==='presence_unconfirmed'?'Presença não confirmada':'Motor nativo requer atenção',sub:fault==='presence_unconfirmed'?'Localização ausente ou desatualizada':'Revise os motores e suas permissões',entity:NATIVE_ALARM134});
    if(!fenceOn) alerts.push({tone:'red',icon:'mdi:electric-switch',title:'Cerca elétrica desativada',sub:'Perímetro requer atenção',entity:fence});
    if(offline.length) alerts.push({tone:'red',icon:'mdi:wifi-off',title:`${offline.length} dispositivo(s) offline`,sub:'Telemetria indisponível',entity:offline[0]});
    if(crit.length) alerts.push({tone:'red',icon:'mdi:battery-alert',title:`${crit.length} bateria(s) abaixo de 15%`,sub:'Substituição recomendada',entity:crit[0]?.id});
    if(gas?.state==='on') alerts.unshift({tone:'red',icon:'mdi:gas-cylinder',title:'Gás detectado',sub:'Alerta crítico ativo',entity:gas.entity_id});
    if(open.length) alerts.push({tone:'amber',icon:'mdi:door-open',title:`${open.length} abertura(s) aberta(s)`,sub:'Verifique o perímetro',entity:open[0]});
    let score=100;
    score-=Math.min(18,offline.length*6); score-=crit.length*6; score-=open.length*7;
    if(!fenceOn) score-=house==='Casa'?5:15;
    if(['Ausente','Viagem'].includes(house) && ['disarmed','unknown','unavailable'].includes(alarmRaw)) score-=20;
    if(gas?.state==='on') score=0;
    score=Math.max(0,Math.min(100,Math.round(score)));
    return {openings,open,doors,windows,cams,camOnline,entities,offline,bats,crit,attention,fence,gate,alarm,house,fenceOn,gateRaw,alarmRaw,alerts,score};
  }

  function cameraCard(host,id,small=false){
    const st=state(host,id), name=String(st?.attributes?.friendly_name||fmtName(id)), pic=String(st?.attributes?.entity_picture||'');
    const picture=pic.startsWith('/api/camera_proxy/')?pic+(pic.includes('?')?'&':'?')+'cp_frame='+Math.floor(Date.now()/15000):pic;
    const raw=String(st?.state||'unknown'); const online=!['unknown','unavailable'].includes(raw);
    return `<button class="cp60-camera ${small?'small':''}" data-entity="${esc(id)}"><div class="cp60-cam-media">${pic?`<img src="${esc(picture)}" alt="${esc(name)}">`:''}<div class="cp60-cam-fallback" style="display:${pic?'none':'grid'}"><ha-icon icon="mdi:cctv"></ha-icon></div><span class="cp60-live ${online?'on':'off'}">${online?(!pic?'SEM IMAGEM':st?.attributes?.cloudpelizzon_read_only?'IMAGEM RECENTE':raw==='recording'?'GRAVANDO':'AO VIVO'):'OFFLINE'}</span></div><div class="cp60-cam-name">${esc(name)}</div></button>`;
  }

  function personCard(host,r){
    const x=residentInfo(host,r); const avatar=x.pic?`<img src="${esc(x.pic)}">`:`<span>${esc(r.name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase())}</span>`;
    return `<button class="cp60-person ${x.cls}" data-entity="${esc(r.id)}"><div class="cp60-avatar">${avatar}</div><div class="cp60-person-copy"><b>${esc(r.name)}</b><strong>${esc(x.label)}</strong><span>${esc(x.since)}</span></div><ha-icon icon="mdi:chevron-right"></ha-icon></button>`;
  }

  function eventRows(host){
    const rows=[];
    const push=(st,title,cat,tone='blue')=>{if(!st)return;const ts=new Date(st.last_changed||st.last_updated||0).getTime();if(!ts)return;rows.push({ts,title,cat,tone,time:new Date(ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})});};
    for(const r of residents(host)){const st=state(host,r.id);push(st,`${r.name}: ${residentInfo(host,r).label}`,'Presença','green');}
    const a=state(host,alarmId(host)); if(a) push(a,`Central de alarme: ${String(a.state||'')}`,'Alarme','blue');
    const f=state(host,fenceId(host)); if(f) push(f,`Cerca elétrica: ${f.state==='on'?'Ligada':'Desligada'}`,'Perímetro',f.state==='on'?'green':'red');
    const g=state(host,gateId(host)); if(g) push(g,`Portão: ${String(g.state||'')}`,'Perímetro','blue');
    for(const e of state(host,NATIVE_ALARM134)?.attributes?.events||[]){const ts=e.at*1000;if(Number.isFinite(ts))rows.push({ts,title:e.title,cat:'Motor nativo',tone:'blue',time:new Date(ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})});}
    return rows.sort((a,b)=>b.ts-a.ts).slice(0,8);
  }

  function iconForSensor(type){ return type==='door'?'mdi:door-closed':type==='window'?'mdi:window-closed-variant':type==='motion'?'mdi:motion-sensor':'mdi:access-point'; }
  function sensorStateLabel(item){
    const raw=String(item.st?.state||'unknown');
    if(['unknown','unavailable'].includes(raw)) return {label:'Offline',cls:'red'};
    if(item.type==='motion') return isOpen(item.st)?{label:'Movimento',cls:'amber'}:{label:'Normal',cls:'green'};
    return isOpen(item.st)?{label:'Aberta',cls:'red'}:{label:'Fechada',cls:'green'};
  }

  function sidebar(view){
    const tabs=[['overview','mdi:radar','Todos'],['cameras','mdi:cctv','Câmeras'],['sensors','mdi:motion-sensor','Sensores'],['openings','mdi:door-open','Portas/Janelas'],['perimeter','mdi:vector-square','Perímetro'],['fence','mdi:transmission-tower','Cerca Elétrica'],['zones','mdi:crosshairs-gps','Zonas'],['batteries','mdi:battery-sync-outline','Baterias'],['sensorview','mdi:view-dashboard-variant','Visão Sensores']];
    return `<nav class="cp60-nav">${tabs.map(([id,ico,label])=>`<button data-view="${id}" class="${view===id?'active':''}"><ha-icon icon="${ico}"></ha-icon><span>${label}</span></button>`).join('')}</nav>`;
  }

  function overviewView(host,s){
    const imgChips=`<div class="cp60-map-chip win"><ha-icon icon="mdi:window-closed-variant"></ha-icon><span><b>Janelas</b><small>${s.windows.length-s.open.filter(id=>openingType(host,id)==='window').length}/${s.windows.length} protegidas</small></span></div><div class="cp60-map-chip sens"><ha-icon icon="mdi:motion-sensor"></ha-icon><span><b>Sensores internos</b><small>${sensorCandidates(host).filter(x=>x.type==='motion').length} monitorados</small></span></div><div class="cp60-map-chip fence ${s.fenceOn?'ok':'bad'}"><ha-icon icon="mdi:electric-switch"></ha-icon><span><b>Cerca elétrica</b><small>${s.fenceOn?'Ativada':'Desativada'}</small></span></div><div class="cp60-map-chip gate"><ha-icon icon="mdi:garage"></ha-icon><span><b>Portão</b><small>${s.gateRaw==='closed'?'Fechado':s.gateRaw==='open'?'Aberto':esc(s.gateRaw)}</small></span></div>`;
    return `<div class="cp60-map"><img src="${ASSET}" alt="Residência"><svg class="cp132-light-routes" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="cp132Route"><stop stop-color="#33eaff"/><stop offset="1" stop-color="#49ffd1"/></linearGradient></defs><path class="edge" d="M35 400 L35 80 L270 25 L750 25 L965 95 L965 425 L730 480 L280 480 Z"/><path class="route one" d="M320 60 L320 160 L500 240 L830 110"/><path class="route two" d="M80 390 L270 390 L500 330 L500 450"/><circle cx="320" cy="160" r="3"/><circle cx="830" cy="110" r="3"/><circle cx="270" cy="390" r="3"/><circle cx="500" cy="450" r="3"/></svg>${imgChips}</div>`;
  }

  function camerasView(host,s){ return `<div class="cp60-scroll cp60-camera-grid">${s.cams.map(id=>cameraCard(host,id)).join('')||'<div class="cp60-empty">Nenhuma câmera cadastrada.</div>'}</div>`; }

  function sensorListView(host){
    const bats=batterySensors(host), rows=sensorCandidates(host);
    return `<div class="cp60-scroll cp60-sensor-list">${rows.map(it=>{const si=sensorStateLabel(it), b=batteryFor(host,it,bats);return `<button class="cp60-sensor-row" data-entity="${esc(it.id)}"><ha-icon icon="${iconForSensor(it.type)}"></ha-icon><span><b>${esc(it.name)}</b><small>${esc(it.id)}</small></span><strong class="${si.cls}">${si.label}</strong><em>${b?`${Math.round(b.value)}%`:'—'}</em></button>`;}).join('')||'<div class="cp60-empty">Nenhum sensor físico encontrado.</div>'}</div>`;
  }

  function openingsView(host,s){
    return `<div class="cp60-detail"><div class="cp60-stats4">${[['Portas',s.doors.length,'mdi:door-closed'],['Janelas',s.windows.length,'mdi:window-closed-variant'],['Abertas',s.open.length,'mdi:door-open'],['Fechadas',Math.max(0,s.openings.length-s.open.length),'mdi:shield-check-outline']].map(([l,v,i])=>`<div><ha-icon icon="${i}"></ha-icon><span><small>${l}</small><b>${v}</b></span></div>`).join('')}</div><div class="cp60-scroll cp60-open-list">${s.openings.map(id=>{const st=state(host,id);const open=isOpen(st);return `<button data-entity="${esc(id)}"><ha-icon icon="${openingType(host,id)==='window'?'mdi:window-closed-variant':'mdi:door-closed'}"></ha-icon><span><b>${esc(st?.attributes?.friendly_name||fmtName(id))}</b><small>${openingType(host,id)==='window'?'Janela física':'Porta física'}</small></span><strong class="${open?'red':'green'}">${open?'ABERTA':'FECHADA'}</strong></button>`;}).join('')}</div></div>`;
  }

  function perimeterView(host,s){
    const integrity=Math.max(0,100-(s.open.length*15)-(!s.fenceOn?10:0)-(s.gateRaw==='open'?15:0));
    return `<div class="cp60-detail"><div class="cp60-per-top"><div class="cp60-score-ring" style="--score:${integrity}"><b>${integrity}%</b><span>Integridade do perímetro</span></div>${[['Porta',s.doors.length,s.doors.length? (s.open.some(id=>openingType(host,id)==='door')?'Aberta':'Fechada'):'—','mdi:door-closed'],['Janelas',s.windows.length,s.open.some(id=>openingType(host,id)==='window')?'Abertas':'Fechadas','mdi:window-closed-variant'],['Cerca',s.fenceOn?'ON':'OFF',s.fenceOn?'Protegida':'Atenção','mdi:electric-switch'],['Portão',s.gateRaw==='closed'?'Fechado':s.gateRaw==='open'?'Aberto':s.gateRaw,'Acesso','mdi:garage']].map(([a,b,c,i])=>`<div class="cp60-per-card"><ha-icon icon="${i}"></ha-icon><span><small>${a}</small><b>${b}</b><em>${c}</em></span></div>`).join('')}</div><div class="cp60-scroll cp60-per-list">${s.openings.map(id=>{const st=state(host,id),open=isOpen(st);return `<button data-entity="${esc(id)}"><ha-icon icon="${openingType(host,id)==='window'?'mdi:window-closed-variant':'mdi:door-closed'}"></ha-icon><span><b>${esc(st?.attributes?.friendly_name||fmtName(id))}</b><small>${openingType(host,id)==='window'?'Janela física':'Porta física'}</small></span><strong class="${open?'red':'green'}">${open?'ABERTA':'FECHADA'}</strong></button>`;}).join('')}</div><div class="cp60-actions"><button data-gate="open"><ha-icon icon="mdi:garage-open"></ha-icon>Abrir portão</button><button data-gate="close"><ha-icon icon="mdi:garage"></ha-icon>Fechar portão</button></div></div>`;
  }

  function fenceView(host,s){ return `<div class="cp60-center-action"><div class="cp60-orb ${s.fenceOn?'on':'off'}"><ha-icon icon="mdi:electric-switch"></ha-icon><b>${s.fenceOn?'Cerca ativada':'Cerca desativada'}</b><small>${esc(s.fence||'Sem entidade configurada')}</small></div><div class="cp60-actions"><button data-fence="on"><ha-icon icon="mdi:flash"></ha-icon>Ligar</button><button class="danger" data-fence="off"><ha-icon icon="mdi:flash-off"></ha-icon>Desligar</button></div></div>`; }

  function zonesView(host){
    const zones=Object.entries(host?._hass?.states||{}).filter(([id])=>id.startsWith('zone.')).map(([id,st])=>({id,name:st.attributes?.friendly_name||fmtName(id),persons:st.attributes?.persons?.length??0}));
    return `<div class="cp60-detail"><div class="cp60-zone-head"><div><ha-icon icon="mdi:map-marker-radius"></ha-icon><b>${zones.length}</b><span>Zonas disponíveis</span></div><button data-native-config="Zonas"><ha-icon icon="mdi:cog-outline"></ha-icon>Configurar zonas</button></div><div class="cp60-scroll cp60-zone-list">${zones.map(z=>`<button data-entity="${esc(z.id)}"><ha-icon icon="mdi:map-marker"></ha-icon><span><b>${esc(z.name)}</b><small>${esc(z.id)}</small></span><strong>${z.persons} pessoa(s)</strong></button>`).join('')||'<div class="cp60-empty">Nenhuma zona disponível.</div>'}</div></div>`;
  }

  function batteriesView(host,s){
    const min=s.bats.length?Math.min(...s.bats.map(b=>b.value)):null;
    return `<div class="cp60-detail"><div class="cp60-stats4">${[['Baterias',s.bats.length,'mdi:battery-heart-variant'],['Críticas <15%',s.crit.length,'mdi:battery-alert'],['Atenção 15–29%',s.attention.length,'mdi:battery-50'],['Menor nível',min==null?'—':`${Math.round(min)}%`,'mdi:battery-low']].map(([l,v,i])=>`<div><ha-icon icon="${i}"></ha-icon><span><small>${l}</small><b>${v}</b></span></div>`).join('')}</div><div class="cp60-scroll cp60-bat-list">${s.bats.map(b=>`<button data-entity="${esc(b.id)}" class="${b.value<15?'critical':b.value<30?'attention':''}"><ha-icon icon="${b.value<15?'mdi:battery-alert':b.value<30?'mdi:battery-30':'mdi:battery-check'}"></ha-icon><span><b>${esc(b.name)}</b><small>${esc(b.id)}</small><i><u style="width:${Math.max(2,Math.min(100,b.value))}%"></u></i></span><strong>${Math.round(b.value)}%</strong></button>`).join('')||'<div class="cp60-empty">Nenhuma bateria de sensor encontrada.</div>'}</div></div>`;
  }

  function sensorView(host,s){
    const selected=selectedCameras(host,s.cams); return `<div class="cp60-monitor"><div class="cp60-monitor-head"><span><b>Monitoramento 4 câmeras</b><small>Seleção persistente neste navegador</small></span><button data-overlay="camera-select"><ha-icon icon="mdi:cog-outline"></ha-icon>Selecionar</button></div><div class="cp60-monitor-grid">${selected.map(id=>cameraCard(host,id,true)).join('')}</div></div>`;
  }

  function selectedCameras(host,available=cameraIds(host)){
    let saved=[];try{saved=JSON.parse(localStorage.getItem(CAM_KEY)||'[]')}catch(_){saved=[]}
    saved=arr(saved).filter(id=>available.includes(id)).slice(0,4);for(const id of available){if(saved.length>=4)break;if(!saved.includes(id))saved.push(id)}
    try{localStorage.setItem(CAM_KEY,JSON.stringify(saved))}catch(_){} return saved;
  }

  function centerView(host,s,view){
    if(view==='overview')return overviewView(host,s); if(view==='cameras')return camerasView(host,s); if(view==='sensors')return sensorListView(host); if(view==='openings')return openingsView(host,s); if(view==='perimeter')return perimeterView(host,s); if(view==='fence')return fenceView(host,s); if(view==='zones')return zonesView(host); if(view==='batteries')return batteriesView(host,s); if(view==='sensorview')return sensorView(host,s); return overviewView(host,s);
  }

  function kpiStrip(s){
    return `<div class="cp60-kpis"><button data-view="sensors"><ha-icon icon="mdi:access-point"></ha-icon><span><small>Sensores</small><b>${sensorCandidates(window.__cp60Host||{}).length || s.entities.length}</b><em>${Math.max(0,(sensorCandidates(window.__cp60Host||{}).length||s.entities.length)-s.offline.length)} ativos</em></span></button><button data-view="devices"><ha-icon icon="mdi:chip"></ha-icon><span><small>Dispositivos</small><b>${s.entities.length}</b><em>${s.entities.length-s.offline.length} online</em></span></button><button data-view="cameras"><ha-icon icon="mdi:cctv"></ha-icon><span><small>Câmeras</small><b>${s.camOnline.length}/${s.cams.length}</b><em>Online</em></span></button><button data-view="openings"><ha-icon icon="mdi:door-sliding-lock"></ha-icon><span><small>Portas / Janelas</small><b>${s.open.length}/${s.openings.length}</b><em>${s.doors.length} porta · ${s.windows.length} janelas</em></span></button><button data-view="fence" class="${s.fenceOn?'':'bad'}"><ha-icon icon="mdi:electric-switch"></ha-icon><span><small>Cerca elétrica</small><b>${s.fenceOn?'Ativada':'Desativada'}</b><em>${s.fenceOn?'Protegida':'Atenção'}</em></span></button><button data-view="zones"><ha-icon icon="mdi:map-marker-radius-outline"></ha-icon><span><small>Zonas</small><b>${Object.keys((window.__cp60Host?._hass?.states)||{}).filter(id=>id.startsWith('zone.')).length}</b><em>Monitoradas</em></span></button></div>`;
  }

  function devicesView(host,s){ return `<div class="cp60-scroll cp60-device-list">${s.entities.map(id=>{const st=state(host,id),off=['unknown','unavailable'].includes(String(st?.state||''));return `<button data-entity="${esc(id)}"><ha-icon icon="${id.startsWith('camera.')?'mdi:cctv':id.startsWith('binary_sensor.')?'mdi:access-point':id.startsWith('cover.')?'mdi:garage':'mdi:chip'}"></ha-icon><span><b>${esc(st?.attributes?.friendly_name||fmtName(id))}</b><small>${esc(id)}</small></span><strong class="${off?'red':'green'}">${off?'OFFLINE':esc(String(st?.state||'—').toUpperCase())}</strong></button>`;}).join('')}</div>`; }

  function alarmProgress137(host){
    const st=state(host,alarmId(host)),p=st?.attributes?.pending;
    const bypass=st?.attributes?.bypassed_sensors||[];
    const suffix=bypass.length?` · ${bypass.length} ignorado(s)`:'';
    if(['arming','pending'].includes(st?.state)&&p&&Number.isFinite(p.due)){
      const seconds=Math.max(0,Math.ceil(p.due-Date.now()/1000));
      const label=st.state==='pending'?'Atraso de entrada':p.target==='armed_home'?'Armando parcial':'Armando total';
      return seconds?`${label} · ${seconds}s`:'Aguardando confirmação do motor';
    }
    return ({disarmed:'Desarmado',armed_home:'Parcial armado'+suffix,armed_away:'Proteção total armada',triggered:'Alarme disparado',panic:'Pânico acionado',unknown:'Estado sem confirmação',unavailable:'Motor sem conexão'})[st?.state]||'Comando direto da central';
  }
  function tickAlarm137(host){
    const el=host.shadowRoot?.querySelector('[data-native-countdown137]');
    if(el){const text=alarmProgress137(host);if(el.textContent!==text)el.textContent=text;}
  }
  function rightPanel(host,s){
    const house=s.house; const visit=state(host,'select.cloudpelizzon_security_mode')?.attributes?.server_supports_native?house==='Visitantes':visitId(host)&&state(host,visitId(host))?.state==='on'; const modes=[['Casa','mdi:home'],['Ausente','mdi:home-export-outline'],['Dormindo','mdi:weather-night'],['Viagem','mdi:airplane-clock'],['Férias','mdi:palm-tree'],['Visitantes','mdi:account-group']];
    const bypass=alarmId(host)===NATIVE_ALARM134?(state(host,NATIVE_ALARM134)?.attributes?.bypassed_sensors||[]):[];
    const bypassNames=bypass.map(id=>state(host,id)?.attributes?.friendly_name||id).join(', ');
    const pending=state(host,s.alarm)?.attributes?.pending;
    const aMap={disarmed:'Desarmar',armed_home:'Parcial',armed_away:'Armado',triggered:'Pânico'}; const activeAlarm=s.alarmRaw==='arming'?(pending?.target==='armed_home'?'Parcial':'Armado'):aMap[s.alarmRaw]||'';
    return `<div class="cp60-right"><section class="cp60-card"><header><ha-icon icon="mdi:home-automation"></ha-icon><span><b>Modo da residência</b><small>Operação atual da casa</small></span></header><div class="cp60-mode-grid">${modes.map(([m,i])=>{const active=m==='Visitantes'?visit:(m==='Férias'?house==='Férias':house===m);return `<button data-mode="${m}" class="${active?'active':''}"><ha-icon icon="${i}"></ha-icon><span><b>${m}</b><small>${active?'Modo ativo':'Ativar modo'}</small></span></button>`}).join('')}</div></section><section class="cp60-card"><header><ha-icon icon="mdi:shield-home"></ha-icon><span><b>Controle do alarme</b><small data-native-countdown137 title="${esc(bypassNames)}">${esc(alarmProgress137(host))}</small></span>${alarmPicker(host)}</header><div class="cp60-alarm-grid">${[['Desarmar','mdi:shield-check','Acesso livre'],['Parcial','mdi:shield-half-full','Perímetro'],['Armado','mdi:lock','Proteção total'],['Pânico','mdi:alarm-light','Emergência']].map(([m,i,sub])=>`<button data-alarm="${m}" class="${activeAlarm===m?(s.alarmRaw==='arming'?'arming':'active'):''}"><ha-icon icon="${i}"></ha-icon><span><b>${m}</b><small>${s.alarmRaw==='arming'&&activeAlarm===m?'Contagem de saída':sub}</small></span></button>`).join('')}</div></section><section class="cp60-card cp60-mini"><header><ha-icon icon="mdi:gate"></ha-icon><span><b>Controle do portão</b><small>${s.gateRaw==='closed'?'Fechado':s.gateRaw==='open'?'Aberto':esc(s.gateRaw)}</small></span><i class="cp60-dot ${['unknown','unavailable'].includes(s.gateRaw)?'off':'on'}"></i></header><div class="cp60-actions"><button data-gate="open"><ha-icon icon="mdi:garage-open"></ha-icon>Abrir</button><button data-gate="close"><ha-icon icon="mdi:garage"></ha-icon>Fechar</button></div></section><section class="cp60-card cp60-mini"><header><ha-icon icon="mdi:electric-switch"></ha-icon><span><b>Cerca elétrica</b><small>Comando manual do perímetro</small></span><strong class="${s.fenceOn?'green':'red'}">${s.fenceOn?'ATIVADA':'DESATIVADA'}</strong></header><div class="cp60-actions"><button data-fence="on"><ha-icon icon="mdi:flash"></ha-icon>Ligar</button><button data-fence="off" class="danger"><ha-icon icon="mdi:flash-off"></ha-icon>Desligar</button></div></section><section class="cp60-card cp60-summary"><header><ha-icon icon="mdi:chart-box-outline"></ha-icon><span><b>Resumo operacional</b><small>Estado atual e alertas</small></span><button data-overlay="alerts" class="cp60-alert-count">${s.alerts.length} alertas</button></header><div class="cp60-summary-list">${s.alerts.slice(0,5).map(a=>`<button data-entity="${esc(a.entity||'')}"><ha-icon icon="${a.icon}"></ha-icon><span><b>${esc(a.title)}</b><small>${esc(a.sub)}</small></span><em>agora</em></button>`).join('')||'<div class="cp60-ok"><ha-icon icon="mdi:check-circle"></ha-icon>Sem alertas ativos</div>'}</div></section></div>`;
  }

  function bottomPanel(host,s,view){
    const people=residents(host); const ev=eventRows(host);
    if(view==='sensorview'){
      const bats=s.bats; const cards=sensorCandidates(host).map(it=>{const si=sensorStateLabel(it),b=batteryFor(host,it,bats);return `<button class="cp60-mini-sensor" data-entity="${esc(it.id)}"><ha-icon icon="${iconForSensor(it.type)}"></ha-icon><span><b>${esc(it.name)}</b><small>${si.label}</small></span><em class="${b&&b.value<15?'red':b&&b.value<30?'amber':'green'}">${b?`${Math.round(b.value)}%`:'—'}</em></button>`}).join('');
      return `<section class="cp60-bottom-card cp60-sensor-inventory"><header><ha-icon icon="mdi:access-point"></ha-icon><span><b>Sensores físicos</b><small>Estado + bateria em tempo real</small></span></header><div class="cp60-mini-sensor-grid">${cards||'<div class="cp60-empty">Nenhum sensor encontrado.</div>'}</div></section><section class="cp60-bottom-card"><header><ha-icon icon="mdi:account-group"></ha-icon><span><b>Presença</b><small>${people.length} moradores</small></span></header><div class="cp60-people">${people.map(r=>personCard(host,r)).join('')}</div></section><section class="cp60-bottom-card"><header><ha-icon icon="mdi:timeline-clock-outline"></ha-icon><span><b>Eventos recentes</b><small>Atividades da central</small></span></header><div class="cp60-events">${ev.map(e=>`<div><time>${e.time}</time><i class="${e.tone}"></i><span><b>${esc(e.title)}</b><small>${esc(e.cat)}</small></span></div>`).join('')}</div></section>`;
    }
    return `<section class="cp60-bottom-card"><header><ha-icon icon="mdi:cctv"></ha-icon><span><b>Câmeras ao vivo</b><small>${s.camOnline.length} online</small></span><button data-view="cameras">Ver todas ›</button></header><div class="cp60-cam-row">${s.cams.slice(0,4).map(id=>cameraCard(host,id,true)).join('')}</div></section><section class="cp60-bottom-card"><header><ha-icon icon="mdi:account-group"></ha-icon><span><b>Presença e eventos</b><small>${people.length} moradores · tempo real</small></span></header><div class="cp60-people">${people.map(r=>personCard(host,r)).join('')||'<div class="cp60-empty">Nenhum morador configurado.</div>'}</div></section><section class="cp60-bottom-card"><header><ha-icon icon="mdi:timeline-clock-outline"></ha-icon><span><b>Eventos recentes</b><small>Atividades da central</small></span></header><div class="cp60-events">${ev.map(e=>`<div><time>${e.time}</time><i class="${e.tone}"></i><span><b>${esc(e.title)}</b><small>${esc(e.cat)}</small></span></div>`).join('')}</div></section>`;
  }

  function header(host,s){
    const scoreCls=s.score>=80?'green':s.score>=60?'amber':'red';
    return `<header class="cp60-top"><div class="cp60-brand"><div class="cp60-shield"><ha-icon icon="mdi:shield-home"></ha-icon><i></i><i></i></div><span><small>CP-SECURITY · COMMAND CORE 0.6.1</small><b>Central de Segurança</b></span></div><button data-overlay="engines" class="cp60-top-status"><span class="cp60-ring ${scoreCls}" style="--score:${s.score}"><b>${s.score}%</b></span><span><b>Segurança ${s.score}%</b><small>Clique para motores nativos</small></span><ha-icon icon="mdi:chevron-right"></ha-icon></button><div class="cp60-top-status"><ha-icon icon="mdi:home"></ha-icon><span><b>${esc(s.house)}</b><small>Modo atual</small></span></div><button data-overlay="offline" class="cp60-top-status ${s.offline.length?'warning':'ok'}"><ha-icon icon="mdi:access-point-network-off"></ha-icon><span><b>${s.offline.length} offline</b><small>Ver dispositivos</small></span><ha-icon icon="mdi:chevron-right"></ha-icon></button><button data-overlay="alerts" class="cp60-top-status ${s.alerts.length?'warning':'ok'}"><ha-icon icon="mdi:shield-alert-outline"></ha-icon><span><b>${s.alerts.length} alerta(s)</b><small>Ver alertas</small></span><ha-icon icon="mdi:chevron-right"></ha-icon></button><div class="cp60-clock"><b>${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</b><small>${new Date().toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}</small></div><button class="cp60-menu" data-native><ha-icon icon="mdi:cog-outline"></ha-icon></button></header>`;
  }

  async function loadEngines(host,force=false){
    if(host.__cp60EngineLoading) return; if(host.__cp60Engines && !force)return;
    host.__cp60EngineLoading=true; try{ host.__cp60Engines=await host._hass.callWS({type:'cloudpelizzon/security/engines/list'}); host.__cp60EngineError=''; }
    catch(e){host.__cp60Engines=null;host.__cp60EngineError=String(e?.message||e||'Motor indisponível');}
    finally{host.__cp60EngineLoading=false;}
  }

  const permissionServices={light:['turn_on','turn_off','toggle'],switch:['turn_on','turn_off','toggle'],input_boolean:['turn_on','turn_off'],input_select:['select_option'],input_number:['set_value'],cover:['open_cover','close_cover','stop_cover'],alarm_control_panel:['alarm_arm_home','alarm_arm_away','alarm_arm_night','alarm_disarm','alarm_trigger'],siren:['turn_on','turn_off']};
  function permissionChoices(host){
    const result=[];
    for(const id of Object.keys(host._hass.states||{}).sort()){
      const domain=id.split('.')[0];
      for(const service of permissionServices[domain]||[])result.push([domain,service,id]);
    }
    for(const name of Object.keys(host._hass.services?.notify||{}).sort())result.push(['notify',name,'']);
    if(host._hass.services?.persistent_notification?.create)result.push(['persistent_notification','create','']);
    for(const row of host.__cp127Permissions?.effects||[])if(!result.some(x=>JSON.stringify(x)===JSON.stringify(row)))result.push(row);
    return result;
  }
  async function loadPermissions127(host){
    try{const result=await host._hass.callWS({type:'cloudpelizzon/security/permissions'});host.__cp127Permissions=result.policy;host.__cp127PermissionError='';}
    catch(error){host.__cp127Permissions=null;host.__cp127PermissionError=String(error?.message||error);}
  }
  function permissionMarkup127(host){
    const p=host.__cp127Permissions;
    if(!p)return modal('Permissões de Segurança','mdi:shield-key',`<p>${esc(host.__cp127PermissionError||'Carregando permissões...')}</p>`);
    const ids=[...new Set([...Object.keys(host._hass.states||{}),...p.reads])].sort();
    const effects=permissionChoices(host);const notify=effects.filter(x=>['notify','persistent_notification'].includes(x[0]));
    const value=row=>row.join('|');
    return modal('Permissões de Segurança','mdi:shield-key',`<p>Escolha os sensores que podem enviar estados ao servidor e os comandos permitidos para cada dispositivo. Nenhum dispositivo vem autorizado. Limites: 64 sensores e 200 comandos.</p><div class="cp60-engine-fields"><label><span>Leitura de estados</span><select multiple size="10" data-security-reads>${ids.map(id=>`<option value="${esc(id)}" ${p.reads.includes(id)?'selected':''}>${esc(host._hass.states[id]?.attributes?.friendly_name||id)} · ${esc(id)}</option>`).join('')}</select></label><label><span>Comandos permitidos</span><select multiple size="10" data-security-effects>${effects.map(row=>`<option value="${esc(value(row))}" ${p.effects.some(x=>value(x)===value(row))?'selected':''}>${esc(row[2]||'Notificação')} · ${esc(row[0]+'.'+row[1])}</option>`).join('')}</select></label><label><span>Destino dos avisos</span><select data-security-notification><option value="">Não enviar avisos</option>${notify.map(row=>`<option value="${esc(value(row))}" ${p.notification?.join('|')===row.slice(0,2).join('|')?'selected':''}>${esc(row[0]+'.'+row[1])}</option>`).join('')}</select></label></div><p>Use Ctrl ou Shift para selecionar vários itens. O destino escolhido para avisos também será incluído nos comandos autorizados.</p><p>Após salvar, configure os motores desejados. Para permitir comandos, desative “Modo sombra” nas configurações de Segurança.</p><div class="cp60-modal-actions"><button data-overlay-back="engines">Voltar</button><button class="ok" data-security-permissions-save>Salvar permissões</button></div>`);
  }
  function capturePermissions127(host){
    const root=host.shadowRoot,reads=root.querySelector('[data-security-reads]'),effects=root.querySelector('[data-security-effects]'),notification=root.querySelector('[data-security-notification]');
    if(!reads||!effects||!notification)return;
    const rows=[...effects.selectedOptions].map(x=>x.value.split('|'));
    const destination=notification.value?notification.value.split('|'):null;
    if(destination&&!rows.some(x=>x.join('|')===destination.join('|')))rows.push(destination);
    host.__cp127Permissions={reads:[...reads.selectedOptions].map(x=>x.value),effects:rows,notification:destination?.slice(0,2)||null};
  }
  async function savePermissions127(host){
    capturePermissions127(host);
    const p=host.__cp127Permissions;
    if(!p||p.reads.length>64||p.effects.length>200){toast(host,'Selecione até 64 sensores e 200 comandos.','error');return;}
    if(!window.confirm('Autorizar os sensores, comandos e destino de avisos selecionados para Segurança?'))return;
    try{await host._hass.callWS({type:'cloudpelizzon/security/permissions/save',policy:p,confirmed:true});await loadPermissions127(host);toast(host,'Permissões salvas.','success');}
    catch(error){toast(host,String(error?.message||error),'error');}
  }

  const NATIVE_ALARM134='alarm_control_panel.cloudpelizzon_security_internal';
  function nativeDefaults134(){return {enabled:true,exit_seconds:60,entry_seconds:30,sensors:[],siren:'',siren_seconds:180,notify:true,mode_entity:'',actions:{},presence:{enabled:false,residents:[],arrival_seconds:15,departure_seconds:300,max_age_seconds:900,arm_on_departure:false,disarm_on_arrival:false,allowed_modes:['Casa','Ausente']}};}
  function nativeMarkup134(host){
    if(!state(host,NATIVE_ALARM134)?.attributes?.server_supports_native)return modal('Motores nativos ainda indisponíveis','mdi:shield-alert','<p>O servidor ainda não confirmou o suporte à central virtual e à presença. Instale a atualização privada dos motores e confirme o acesso do módulo antes de configurar.</p>');
    const c=host._config?.native134||nativeDefaults134(),p=c.presence,states=host._hass?.states||{};
    const ids=domain=>Object.keys(states).filter(id=>id.startsWith(domain+'.')).sort();
    const options=(domain,chosen)=>'<option value="">Não vincular</option>'+ids(domain).map(id=>`<option value="${esc(id)}" ${chosen===id?'selected':''}>${esc(states[id].attributes?.friendly_name||id)}</option>`).join('');
    const check=(name,text,value)=>`<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" data-n134="${name}" ${value?'checked':''}>${text}</label>`;
    const number=(name,text,value,min=0)=>`<label>${text}<input type="number" min="${min}" max="3600" data-n134="${name}" value="${esc(value)}"></label>`;
    const existingFence=Object.values(c.actions||{}).flat().find(x=>x.domain==='switch')?.entity_id||'';
    return modal('Central virtual e presença','mdi:shield-home',`<p>A central e as regras de presença são executadas pelo motor privado do módulo. Não exigem outra central nem automações particulares. Os sensores de localização devem estar configurados no Home Assistant.</p><div class="cp60-engine-fields">${check('enabled','Central interna habilitada',c.enabled)}${check('physical','Permitir ações reais nos dispositivos selecionados',host._config?.geral?.modo_sombra===false)}${number('exit','Tempo de saída (segundos)',c.exit_seconds)}${number('entry','Tempo de entrada (segundos)',c.entry_seconds)}${number('sirenSeconds','Tempo máximo da sirene (segundos)',c.siren_seconds,5)}${check('notify','Enviar avisos ao destino autorizado nas Permissões de Segurança',c.notify)}<label>Sirene da central (mesma de Sirene e Luzes)<select data-n134="siren">${options('siren',c.siren)}</select></label><label>Sincronizar modo com seletor existente (opcional)<select data-n134="mode">${options('input_select',c.mode_entity)}</select></label><label>Cerca: ligar em Ausente e desligar em Casa (opcional)<select data-n134="fence">${options('switch',existingFence)}</select></label></div><h3>Sensores que protegem a residência</h3><p>Em Parcial, os sensores marcados que já estiverem abertos serão ignorados até o desarme; os fechados ficarão protegidos. É necessário pelo menos um sensor fechado. Sensores indisponíveis bloqueiam o armamento. Em Armado, todos devem estar fechados.</p><div style="max-height:240px;overflow:auto">${ids('binary_sensor').map(id=>{const s=c.sensors.find(x=>x.entity_id===id),kind=s?.kind||(['motion','occupancy','presence'].includes(states[id].attributes?.device_class)?'interior':'entry');return `<div data-n134-sensor="${esc(id)}" style="display:grid;grid-template-columns:22px minmax(160px,1fr) 145px 85px;gap:8px;align-items:center;margin:5px 0"><input type="checkbox" data-picked ${s?'checked':''}><span>${esc(states[id].attributes?.friendly_name||id)}</span><select data-kind>${[['entry','Entrada com atraso'],['perimeter','Perímetro imediato'],['interior','Movimento interno'],['tamper','Violação/tamper']].map(([v,t])=>`<option value="${v}" ${kind===v?'selected':''}>${t}</option>`).join('')}</select><label><input type="checkbox" data-home ${s?.home===true?'checked':''}>Parcial</label></div>`}).join('')}</div><h3>Geolocalização e moradores</h3><div class="cp60-engine-fields">${check('presence','Mudar o modo pela primeira chegada e última saída',p.enabled)}${check('autoarm','Armar a central na última saída confirmada',p.arm_on_departure)}${check('autodisarm','Desarmar a central na primeira chegada confirmada',p.disarm_on_arrival)}${number('arrival','Confirmar chegada durante (segundos)',p.arrival_seconds)}${number('departure','Confirmar ausência durante (segundos)',p.departure_seconds)}${number('age','Idade máxima da localização (segundos)',p.max_age_seconds,30)}</div><p>Por padrão, a presença só alterna Casa e Ausente. Viagem, Férias, Dormindo e Visitantes são preservados. Localização desconhecida ou antiga não confirma saída.</p><div>${ids('person').map(id=>{const resident=p.residents.find(r=>r.sources.includes(id));return `<div data-n134-person="${esc(id)}" style="display:grid;grid-template-columns:22px 1fr 1fr;gap:8px;align-items:center;margin:5px 0"><input type="checkbox" data-picked ${resident?'checked':''}><span>${esc(states[id].attributes?.friendly_name||id)}</span><label>Fonte Wi-Fi adicional<select data-wifi>${options('device_tracker',resident?.sources.find(x=>x.startsWith('device_tracker.'))||'')}</select></label></div>`}).join('')||'<p>Nenhuma pessoa cadastrada no Home Assistant.</p>'}</div><p>A configuração autoriza somente as leituras e ações selecionadas. A central continua sujeita à trial/licença e à conexão com o motor privado.</p><div class="cp60-modal-actions"><button data-overlay-back="engines">Voltar</button><button data-native-save134 class="ok">Salvar motores nativos</button></div>`);
  }
  async function saveNative134(host){
    const root=host.shadowRoot,get=name=>root.querySelector(`[data-n134="${name}"]`),checked=name=>get(name).checked,num=name=>Number(get(name).value);
    const c=JSON.parse(JSON.stringify(host._config?.native134||nativeDefaults134()));c.enabled=checked('enabled');c.exit_seconds=num('exit');c.entry_seconds=num('entry');c.siren_seconds=num('sirenSeconds');c.notify=checked('notify');c.siren=get('siren').value;c.mode_entity=get('mode').value;
    c.sensors=[...root.querySelectorAll('[data-n134-sensor]')].filter(e=>e.querySelector('[data-picked]').checked).map(e=>({entity_id:e.dataset.n134Sensor,kind:e.querySelector('[data-kind]').value,home:e.querySelector('[data-home]').checked}));
    c.presence={...c.presence,enabled:checked('presence'),arrival_seconds:num('arrival'),departure_seconds:num('departure'),max_age_seconds:num('age'),arm_on_departure:checked('autoarm'),disarm_on_arrival:checked('autodisarm'),residents:[...root.querySelectorAll('[data-n134-person]')].filter(e=>e.querySelector('[data-picked]').checked).map(e=>({id:e.dataset.n134Person.replace(/[^a-z0-9_-]/gi,'_'),sources:[e.dataset.n134Person,e.querySelector('[data-wifi]').value].filter(Boolean)}))};
    const fence=get('fence').value;c.actions={...c.actions,Casa:(c.actions?.Casa||[]).filter(x=>x.domain!=='switch'),Ausente:(c.actions?.Ausente||[]).filter(x=>x.domain!=='switch')};if(fence){c.actions.Casa.push({domain:'switch',service:'turn_off',entity_id:fence});c.actions.Ausente.push({domain:'switch',service:'turn_on',entity_id:fence});}
    if(c.sensors.length>48)throw Error('Selecione até 48 sensores para a central.');
    if(c.presence.enabled&&!c.presence.residents.length)throw Error('Selecione ao menos um morador para geolocalização.');
    if(!window.confirm('Salvar os motores nativos e autorizar as leituras e ações selecionadas?'+(checked('physical')?' As ações nos dispositivos serão reais.':'')))return;
    const result=await host._hass.callWS({type:'cloudpelizzon/security/permissions'}),p=result.policy;
    const reads=[...new Set([...p.reads,...c.sensors.map(x=>x.entity_id),...c.presence.residents.flatMap(r=>r.sources)])];
    const effects=p.effects.map(x=>[...x]),add=(d,s,e)=>{if(e&&!effects.some(x=>x.join('|')===[d,s,e].join('|')))effects.push([d,s,e]);};
    for(const svc of ['turn_on','turn_off']){add('siren',svc,c.siren);add('switch',svc,fence);}add('input_select','select_option',c.mode_entity);
    if(reads.length>64||effects.length>200)throw Error('A configuração excede 64 leituras ou 200 ações autorizadas.');
    await host._hass.callWS({type:'cloudpelizzon/security/permissions/save',policy:{...p,reads,effects},confirmed:true});
    const next={...host._config,sirene:{...host._config.sirene,habilitada:Boolean(c.siren),entidade:c.siren||null,duracao_segundos:c.siren_seconds},native134:c,geral:{...host._config.geral,modo_sombra:!checked('physical')}};
    const saved=await host._hass.callApi('POST',CP_SEG_API,next);host._config=saved?.configuracao||next;host.__cp60Overlay='';render(host);toast(host,'Motores nativos configurados.','success');
  }

  function overlayMarkup(host,s){
    const kind=host.__cp60Overlay||''; if(!kind)return '';
    if(kind==='native134')return nativeMarkup134(host);
    if(kind==='permissions')return permissionMarkup127(host);
    if(kind==='alerts') return modal('Alertas ativos','mdi:shield-alert-outline',`<div class="cp60-modal-list">${s.alerts.map(a=>`<button data-entity="${esc(a.entity||'')}"><ha-icon icon="${a.icon}"></ha-icon><span><b>${esc(a.title)}</b><small>${esc(a.sub)}</small></span></button>`).join('')||'<div class="cp60-empty">Nenhum alerta ativo.</div>'}</div>`);
    if(kind==='offline') return modal('Dispositivos offline','mdi:access-point-network-off',`<div class="cp60-modal-list">${s.offline.map(id=>`<button data-entity="${esc(id)}"><ha-icon icon="mdi:wifi-off"></ha-icon><span><b>${esc(state(host,id)?.attributes?.friendly_name||fmtName(id))}</b><small>${esc(id)}</small></span></button>`).join('')||'<div class="cp60-empty">Nenhum dispositivo offline.</div>'}</div>`);
    if(kind==='camera-select'){const avail=s.cams,sel=selectedCameras(host,avail);return modal('Selecionar 4 câmeras','mdi:cctv',`<p class="cp60-help">Escolha até quatro câmeras para a Visão Sensores.</p><div class="cp60-modal-list">${avail.map(id=>`<button data-cam-pick="${esc(id)}" class="${sel.includes(id)?'selected':''}"><ha-icon icon="${sel.includes(id)?'mdi:checkbox-marked-circle':'mdi:checkbox-blank-circle-outline'}"></ha-icon><span><b>${esc(state(host,id)?.attributes?.friendly_name||fmtName(id))}</b><small>${esc(id)}</small></span></button>`).join('')}</div>`);}
    if(kind==='engines'){const data=host.__cp60Engines; if(!data && !host.__cp60EngineLoading) setTimeout(()=>{loadEngines(host,true).then(()=>render(host))},0); const rows=arr(data?.engines);return modal('Motores nativos do CP-SECURITY','mdi:brain',`<div class="cp60-modal-actions"><button data-overlay="permissions">Permissões de Segurança</button><button data-overlay="native134">Central virtual e geolocalização</button></div><div class="cp60-explain"><b>Central virtual e geolocalização nativas</b><p>Configure os sensores, moradores e ações no botão acima. A central externa é opcional.</p></div><div class="cp60-engine-summary"><div><small>Motores</small><b>${rows.length}</b></div><div><small>Ativos</small><b>${rows.filter(x=>x.enabled).length}</b></div><div><small>Inativos</small><b>${rows.filter(x=>!x.enabled).length}</b></div><div><small>Execução</small><b>${data?.global?.connected?'CONECTADA':'DESCONECTADA'}</b></div></div>${host.__cp60EngineError?`<div class="cp60-engine-error"><ha-icon icon="mdi:alert-circle"></ha-icon><span><b>Motor não carregado</b><small>${esc(host.__cp60EngineError)}</small></span></div>`:''}<div class="cp60-engine-list">${rows.map(e=>`<div><span class="cp60-code">${esc(e.code)}</span><span><b>${esc(e.code==='ALR-001'?'Integração com central externa (opcional)':e.name)}</b><small>${esc(e.category)} · ${esc(e.description||'')}</small></span><button data-engine-edit="${esc(e.code)}">Editar</button><button data-engine-toggle="${esc(e.code)}" data-desired="${e.enabled?'0':'1'}" class="${e.enabled?'danger':'ok'}">${e.enabled?'Desativar':'Ativar'}</button></div>`).join('')||(!host.__cp60EngineError?'<div class="cp60-empty">Carregando motores...</div>':'')}</div>`);}
    if(kind==='engine-edit'){const e=arr(host.__cp60Engines?.engines).find(x=>x.code===host.__cp60EditCode); if(!e)return modal('Editar motor','mdi:cog-outline','<div class="cp60-empty">Motor não encontrado.</div>'); const fields=arr(e.fields).map(f=>{const v=e.config?.[f.key]; if(f.type==='list')return `<label><span><b>${esc(f.label)}</b><small>${esc(f.help||'')}</small></span><textarea data-engine-field="${esc(f.key)}" data-type="list">${esc(arr(v).join('\n'))}</textarea></label>`; if(f.type==='number')return `<label><span><b>${esc(f.label)}</b><small>${esc(f.help||'')}</small></span><input type="number" value="${esc(v??'')}" data-engine-field="${esc(f.key)}" data-type="number"></label>`; return `<label><span><b>${esc(f.label)}</b><small>${esc(f.help||'')}</small></span><input value="${esc(v??'')}" data-engine-field="${esc(f.key)}" data-type="text"></label>`}).join(''); return modal(`${e.code} · ${e.name}`,'mdi:cog-outline',`<div class="cp60-engine-fields">${fields}</div><div class="cp60-modal-actions"><button data-overlay-back="engines">Cancelar</button><button class="ok" data-engine-save="${esc(e.code)}">Salvar motor</button></div>`);}
    return '';
  }

  function modal(title,icon,body){ return `<div class="cp60-modal-back"><section class="cp60-modal"><header><ha-icon icon="${icon}"></ha-icon><span><small>CP-SECURITY</small><b>${esc(title)}</b></span><button data-overlay-close><ha-icon icon="mdi:close"></ha-icon></button></header><div class="cp60-modal-body">${body}</div></section></div>`; }

  function viewMeta(view){
    const map={
      overview:['Núcleo de Segurança','Mapa tático da residência em tempo real','mdi:shield-radar'],
      cameras:['Câmeras','Mosaico de vídeo e acesso às entidades reais','mdi:cctv'],
      sensors:['Sensores','Estados físicos monitorados em tempo real','mdi:motion-sensor'],
      devices:['Dispositivos','Inventário operacional e disponibilidade','mdi:server-security'],
      openings:['Portas e Janelas','Aberturas físicas do perímetro','mdi:door-open'],
      perimeter:['Perímetro','Integridade de acessos, cerca e portão','mdi:vector-square'],
      fence:['Cerca Elétrica','Controle manual e estado do perímetro','mdi:transmission-tower'],
      zones:['Zonas','Áreas cadastradas e presença contextual','mdi:crosshairs-gps'],
      batteries:['Baterias','Saúde energética dos sensores','mdi:battery-sync-outline'],
      sensorview:['Visão Sensores','4 câmeras + sensores físicos e bateria','mdi:view-dashboard-variant']
    };
    return map[view]||map.overview;
  }

  function mainMarkup(host){
    const s=statuses(host); let view=host.__cp60View||localStorage.getItem(VIEW_KEY)||'overview';
    const center=view==='devices'?devicesView(host,s):centerView(host,s,view);
    const vm=viewMeta(view);
    return `<div class="cp60-shell">${header(host,s)}<main class="cp60-main"><section class="cp60-hero"><header><ha-icon icon="${vm[2]}"></ha-icon><span><b>${vm[0]}</b><small>${vm[1]}</small></span><em class="cp61-view-pill">${view==='overview'?'AO VIVO':'DETALHES'}</em></header><div class="cp60-hero-body">${sidebar(view)}<div class="cp60-stage">${center}</div></div>${view==='sensorview'?'':kpiStrip(s)}</section>${rightPanel(host,s)}</main><footer class="cp60-bottom ${view==='sensorview'?'sensor-mode':''}">${bottomPanel(host,s,view)}</footer>${overlayMarkup(host,s)}<div class="cp60-toast" data-toast></div></div>`;
  }

  function render(host){
    const root=host?.shadowRoot; if(!root)return; window.__cp60Host=host;
    let mount=root.querySelector('#cp60-root'); if(!mount){mount=document.createElement('div');mount.id='cp60-root';root.appendChild(mount);mount.addEventListener('click',e=>handleClick(host,e));mount.addEventListener('change',()=>capturePermissions127(host));mount.addEventListener('error',e=>{const img=e.target;if(img?.tagName==='IMG'&&img.parentElement?.classList.contains('cp60-cam-media')){img.style.display='none';const fallback=img.parentElement.querySelector('.cp60-cam-fallback');if(fallback)fallback.style.display='grid';const label=img.parentElement.querySelector('.cp60-live');if(label)label.textContent='SEM IMAGEM';}},true);}
    let back=root.querySelector('#cp-back-dashboard');if(back&&!back.__cpBound){back.__cpBound=true;back.addEventListener('click',()=>{host.__cp60NativeMode=false;host.__cp60View='overview';try{localStorage.setItem(VIEW_KEY,'overview')}catch(_){};render(host)});}
    if(host.__cp60NativeMode){mount.style.display='none';return;}
    mount.style.display='block'; if(host.__cp60Overlay==='native134'&&mount.querySelector('[data-native-save134]')){fit(host,mount);return;} const markup=mainMarkup(host);if(mount.__cpMarkup!==markup){mount.innerHTML=markup;mount.__cpMarkup=markup;}fit(host,mount);
  }

  function fit(host,mount){
    const r=host.getBoundingClientRect();
    const top=Math.max(0,Math.min(window.innerHeight-360,Number.isFinite(r.top)?r.top:0));
    const left=Math.max(0,Number.isFinite(r.left)?r.left:0);
    const availableW=Math.max(320,window.innerWidth-left-4);
    const w=Math.max(320,Math.min(availableW,(r.width>320?r.width:availableW)));
    const h=Math.max(460,window.innerHeight-top-4);
    mount.style.setProperty('--cp60-left',`${left}px`);
    mount.style.setProperty('--cp60-top',`${top}px`);
    mount.style.setProperty('--cp60-w',`${w}px`);
    mount.style.setProperty('--cp60-h',`${h}px`);
    mount.classList.toggle('compact',h<790);
    mount.classList.toggle('micro',h<700);
    mount.classList.toggle('narrow',w<1450);
    mount.classList.toggle('wide',w>=1800);
    mount.dataset.viewport=`${Math.round(w)}x${Math.round(h)}`;
    bindAlarmPicker(host);
  }

  function toast(host,msg,tone='info'){const el=host.shadowRoot?.querySelector('#cp60-root [data-toast]');if(!el)return;el.textContent=msg;el.className=`cp60-toast show ${tone}`;clearTimeout(host.__cp60Toast);host.__cp60Toast=setTimeout(()=>el.className='cp60-toast',2500);}

  function bindAlarmPicker(host){const picker=host.shadowRoot?.querySelector('[data-alarm-target]');if(picker)picker.onchange=()=>{try{localStorage.setItem('cp_security_alarm_target134',picker.value)}catch(_){};render(host);};}
  async function service(host,domain,svc,data){
    const targets=Array.isArray(data?.entity_id)?data.entity_id:[data?.entity_id],mirrored=targets.some(id=>state(host,id)?.attributes?.mirror_source==='production_observer');
    if(targets.some(id=>state(host,id)?.attributes?.cloudpelizzon_read_only)){toast(host,'Comandos da produção desativados. Ative “Permitir comandos reais” nas opções da integração CloudPelizzon.','error');return false;}
    try{
      if(targets[0]===NATIVE_ALARM134||targets[0]==='select.cloudpelizzon_security_mode'){
        const action=targets[0]===NATIVE_ALARM134?{alarm_arm_home:'alarm.arm_home',alarm_arm_away:'alarm.arm_away',alarm_disarm:'alarm.disarm',alarm_trigger:'alarm.panic'}[svc]:'native.mode';
        if(!action)throw Error('Ação da central virtual não disponível.');
        if(action.startsWith('alarm.arm_')&&!state(host,NATIVE_ALARM134)?.attributes?.configured_sensors)throw Error('Configure os sensores em Motores → Central virtual e geolocalização antes de armar.');
        const a=state(host,NATIVE_ALARM134)?.attributes||{},b=a.arm_blockers||{};
        const names=ids=>ids.map(id=>state(host,id)?.attributes?.friendly_name||id).join(', ');
        if(action==='alarm.arm_home'&&a.partial_open_bypass){
          if(b.partial_unavailable?.length)throw Error('Parcial bloqueado: sensores indisponíveis — '+names(b.partial_unavailable));
          if(!b.partial_closed?.length)throw Error('Parcial sem cobertura: é necessário pelo menos um sensor marcado e fechado.');
        }
        if(action==='alarm.arm_away'&&b.full?.length)throw Error('Armamento total bloqueado. Verifique: '+names(b.full));
        const r=await host._hass.callWS({type:'cloudpelizzon/security/native',action,payload:action==='native.mode'?{mode:data.option}:{}});
        const bypass=r.native.bypassed_sensors||[];
        const label=({arming:'Armamento solicitado: contagem de saída em andamento',armed_home:'Parcial armado',armed_away:'Proteção total armada',disarmed:'Central desarmada',pending:'Atraso de entrada em andamento',triggered:'Alarme disparado',panic:'Pânico acionado',unknown:'Estado sem confirmação'})[r.native.alarm]||r.native.alarm;
        toast(host,(action==='native.mode'?'Modo: '+r.native.mode:label)+(action==='alarm.arm_home'&&bypass.length?' · Fora da proteção até o desarme: '+names(bypass):'')+(r.effects_queued?' · ações nos dispositivos em processamento':''),r.native.alarm==='arming'?'info':'success');
        setTimeout(()=>schedule(host),100);return true;
      }
      if(mirrored){
        const result=await host._hass.callWS({type:'cloudpelizzon/security/permissions'}),p=result.policy;
        const missing=targets.filter(id=>!p.effects.some(x=>x[0]===domain&&x[1]===svc&&x[2]===id));
        if(missing.length||host._config?.geral?.modo_sombra){
          if(!window.confirm(`Autorizar ${domain}.${svc} em ${targets.join(', ')} na PRODUÇÃO? Esta ação é real. O modo sombra será desativado; as demais permissões serão preservadas.`))return false;
          const policy={...p,reads:[...new Set([...p.reads,...targets])],effects:[...p.effects,...missing.map(id=>[domain,svc,id])]};
          if(host._config?.geral?.modo_sombra){
            const next=JSON.parse(JSON.stringify(host._config));next.geral.modo_sombra=false;
            const saved=await host._hass.callApi('POST',CP_SEG_API,next);
            host._config=saved?.configuracao||next;
          }
          await host._hass.callWS({type:'cloudpelizzon/security/permissions/save',policy,confirmed:true});
        }
      }
      if(domain==='input_select'&&!state(host,targets[0])?.attributes?.options?.includes(data.option))throw Error('Este modo não existe no seletor da produção. Confira a entidade configurada.');
      if(domain==='alarm_control_panel'&&state(host,targets[0])?.attributes?.code_format&&(svc==='alarm_disarm'||state(host,targets[0])?.attributes?.code_arm_required)){
        const code=window.prompt('Código da central de alarme (usado somente neste comando):');if(code===null)return false;data={...data,code};
      }
      const result=await host._hass.callWS({type:'cloudpelizzon/security/command',service:domain+'.'+svc,data:data||{}});
      if(result.delivered!==true)throw Error('Comando não confirmado. Não será repetido automaticamente.');
      toast(host,result.production?(result.production.outcome==='arming'?'Produção em contagem de saída; armamento ainda em andamento.':(result.production.outcome==='already_in_state'?'A produção já estava neste estado: ':'Estado confirmado na produção: ')+result.production.after):'Comando confirmado.','success');return true;
    }catch(e){toast(host,String(e?.message||e),'error');return false}
  }

  async function handleClick(host,e){
    const t=e.composedPath().find(n=>n?.dataset && Object.keys(n.dataset).length) || e.target;
    const btn=e.composedPath().find(n=>n?.matches?.('button,[data-entity]')) || e.target.closest?.('button,[data-entity]'); if(!btn)return;
    if(btn.hasAttribute('data-security-permissions-save')){await savePermissions127(host);return;}
    if(t?.hasAttribute?.('data-alarm-target'))return;
    if(btn.hasAttribute('data-native-save134')){try{await saveNative134(host);}catch(err){toast(host,String(err?.message||err),'error');}return;}
    if(btn.dataset.view){host.__cp60View=btn.dataset.view;try{localStorage.setItem(VIEW_KEY,host.__cp60View)}catch(_){};render(host);return;}
    if(btn.dataset.entity){const id=btn.dataset.entity;if(id){btn.dispatchEvent(new CustomEvent('hass-more-info',{bubbles:true,composed:true,detail:{entityId:id}}));}return;}
    if(btn.dataset.overlay){host.__cp60Overlay=btn.dataset.overlay;if(host.__cp60Overlay==='engines')await loadEngines(host,true);if(host.__cp60Overlay==='permissions')await loadPermissions127(host);render(host);return;}
    if(btn.hasAttribute('data-overlay-close')){host.__cp60Overlay='';render(host);return;}
    if(btn.dataset.overlayBack){host.__cp60Overlay=btn.dataset.overlayBack;render(host);return;}
    if(btn.hasAttribute('data-native')){host.__cp60NativeMode=true;render(host);return;}
    if(btn.dataset.nativeConfig){host.__cp60NativeMode=true;render(host);setTimeout(()=>clickNative(host,btn.dataset.nativeConfig),50);return;}
    if(btn.dataset.mode&&state(host,'select.cloudpelizzon_security_mode')?.attributes?.server_supports_native){await service(host,'select','select_option',{entity_id:'select.cloudpelizzon_security_mode',option:btn.dataset.mode});setTimeout(()=>render(host),250);return;}
    if(btn.dataset.mode){let m=btn.dataset.mode;if(m==='Visitantes'){const id=visitId(host);if(id)await service(host,'input_boolean',state(host,id)?.state==='on'?'turn_off':'turn_on',{entity_id:id});else toast(host,'Modo visitantes não configurado.','error');}else{if(m==='Férias' && !arr(state(host,mode(host))?.attributes?.options).includes('Férias'))m='Viagem';await service(host,'input_select','select_option',{entity_id:mode(host),option:m});}setTimeout(()=>render(host),250);return;}
    if(btn.dataset.alarm){const id=alarmId(host);const map={Desarmar:'alarm_disarm',Parcial:'alarm_arm_home',Armado:'alarm_arm_away',Pânico:'alarm_trigger'};if(id)await service(host,'alarm_control_panel',map[btn.dataset.alarm],{entity_id:id});else toast(host,'Central de alarme não encontrada.','error');return;}
    if(btn.dataset.gate){const id=gateId(host);if(id)await service(host,'cover',btn.dataset.gate==='open'?'open_cover':'close_cover',{entity_id:id});else toast(host,'Portão não encontrado.','error');return;}
    if(btn.dataset.fence){const id=fenceId(host);if(id)await service(host,'switch',btn.dataset.fence==='on'?'turn_on':'turn_off',{entity_id:id});else toast(host,'Cerca elétrica não encontrada.','error');return;}
    if(btn.dataset.camPick){let sel=selectedCameras(host,cameraIds(host));const id=btn.dataset.camPick;if(sel.includes(id))sel=sel.filter(x=>x!==id);else if(sel.length<4)sel=[...sel,id];else{toast(host,'Selecione no máximo 4 câmeras.','error');return;}localStorage.setItem(CAM_KEY,JSON.stringify(sel));render(host);return;}
    if(btn.dataset.engineEdit){host.__cp60EditCode=btn.dataset.engineEdit;host.__cp60Overlay='engine-edit';render(host);return;}
    if(btn.dataset.engineToggle){const e0=arr(host.__cp60Engines?.engines).find(x=>x.code===btn.dataset.engineToggle);try{await host._hass.callWS({type:'cloudpelizzon/security/engines/update',code:e0.code,enabled:btn.dataset.desired==='1',config:e0.config||{}});await loadEngines(host,true);toast(host,'Motor atualizado.','success');render(host);}catch(err){toast(host,`Falha no motor: ${err?.message||err}`,'error');}return;}
    if(btn.dataset.engineSave){const code=btn.dataset.engineSave;const e0=arr(host.__cp60Engines?.engines).find(x=>x.code===code);const cfg={...(e0?.config||{})};host.shadowRoot.querySelectorAll('#cp60-root [data-engine-field]').forEach(el=>{const k=el.dataset.engineField;cfg[k]=el.dataset.type==='number'?Number(el.value):el.dataset.type==='list'?String(el.value||'').split(/\n|,/).map(x=>x.trim()).filter(Boolean):String(el.value||'').trim();});try{await host._hass.callWS({type:'cloudpelizzon/security/engines/update',code,enabled:Boolean(e0?.enabled),config:cfg});await loadEngines(host,true);host.__cp60Overlay='engines';toast(host,'Motor salvo.','success');render(host);}catch(err){toast(host,`Falha ao salvar: ${err?.message||err}`,'error');}return;}
  }

  function clickNative(host,label){const root=host.shadowRoot;if(!root)return;const n=norm(label);const candidates=[...root.querySelectorAll('button,a,[role="button"]')];const el=candidates.find(x=>norm(x.textContent)===n)||candidates.find(x=>norm(x.textContent).includes(n));el?.click();}

  function ensureStyle(root){if(root.querySelector('#cp60-style'))return;const st=document.createElement('style');st.id='cp60-style';st.textContent=`
#cp60-root{
  --bg0:#02090f;--bg1:#03131c;--bg2:#052331;--bg3:#073245;
  --line:#0c607c;--line2:#1592b8;--cyan:#34dcff;--cyan2:#00b8ef;
  --green:#1ee0ae;--amber:#ffc94a;--red:#ff526b;--text:#f3fbff;--muted:#b8d6df;
  --shadow:0 14px 34px rgba(0,0,0,.52);--r:13px;
  position:fixed;left:var(--cp60-left);top:var(--cp60-top);width:var(--cp60-w);height:var(--cp60-h);
  z-index:30;background:var(--bg0);color:var(--text);font-family:Inter,"Segoe UI",Arial,sans-serif;
  overflow:hidden;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision
}
#cp60-root *{box-sizing:border-box;min-width:0}
#cp60-root button{font:inherit;color:inherit;outline:none}
#cp60-root button:focus-visible{outline:2px solid var(--cyan);outline-offset:1px}
#cp60-root ha-icon{color:var(--cyan);--mdc-icon-size:21px;filter:drop-shadow(0 0 7px rgba(52,220,255,.22))}
#cp60-root ::-webkit-scrollbar{width:7px;height:7px}
#cp60-root ::-webkit-scrollbar-track{background:#021018}
#cp60-root ::-webkit-scrollbar-thumb{background:#0f5e77;border-radius:8px;border:1px solid #0b3545}
#cp60-root ::-webkit-scrollbar-thumb:hover{background:#1584a5}
.cp60-shell{
  height:100%;display:grid;grid-template-rows:58px minmax(0,1fr) 166px;gap:6px;padding:6px;
  background:radial-gradient(circle at 28% 0%,rgba(0,170,230,.12),transparent 32%),radial-gradient(circle at 88% 35%,rgba(0,255,190,.055),transparent 26%),linear-gradient(180deg,#03131c,#01080d 78%);
  position:relative;isolation:isolate
}
.cp60-shell:before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.28;background-image:linear-gradient(rgba(34,198,239,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(34,198,239,.035) 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(to bottom,#000 0 70%,transparent)}
.cp60-top,.cp60-hero,.cp60-card,.cp60-bottom-card{
  border:1px solid rgba(22,126,158,.82);border-radius:var(--r);background:linear-gradient(180deg,rgba(6,37,51,.97),rgba(3,20,29,.98));
  box-shadow:var(--shadow),inset 0 1px 0 rgba(102,225,255,.08),inset 0 0 26px rgba(0,168,215,.035);min-width:0;min-height:0
}
.cp60-top{display:grid;grid-template-columns:minmax(280px,1.5fr) minmax(160px,.82fr) repeat(3,minmax(126px,.64fr)) 126px 42px;gap:6px;padding:5px 8px;align-items:center}
.cp60-brand{display:flex;align-items:center;gap:11px;min-width:0}.cp60-brand span{display:flex;flex-direction:column;min-width:0}.cp60-brand small{font-size:9.5px;letter-spacing:1.7px;color:#a9dce8;font-weight:800}.cp60-brand b{font-size:21px;line-height:1.08;color:#fff;white-space:nowrap;text-shadow:0 0 16px rgba(55,220,255,.16)}
.cp60-shield{width:46px;height:46px;border:1px solid #24d2f5;border-radius:14px;display:grid;place-items:center;position:relative;background:linear-gradient(145deg,#07405a,#062534);box-shadow:0 0 24px rgba(0,216,255,.34),inset 0 0 18px rgba(0,204,255,.12)}
.cp60-shield:after{content:"";position:absolute;inset:4px;border-radius:10px;background:radial-gradient(circle at 50% 36%,rgba(38,236,255,.15),transparent 58%);pointer-events:none}.cp60-shield ha-icon{--mdc-icon-size:29px;animation:cp60Pulse 2.7s ease-in-out infinite;z-index:2}.cp60-shield i{position:absolute;inset:-4px;border:1px solid rgba(31,224,255,.38);border-radius:17px;animation:cp60Ring 3.2s linear infinite}.cp60-shield i+i{inset:-8px;animation-delay:-1.6s;opacity:.26}
.cp60-top-status,.cp60-clock{height:44px;border:1px solid rgba(14,102,129,.85);border-radius:9px;background:linear-gradient(180deg,#052634,#041a25);display:flex;align-items:center;gap:8px;padding:5px 9px;min-width:0;box-shadow:inset 0 1px rgba(255,255,255,.025)}
.cp60-top-status{cursor:pointer;transition:.18s ease}.cp60-top-status:hover{border-color:#1eaed5;background:#063044;transform:translateY(-1px);box-shadow:0 7px 18px rgba(0,0,0,.22),0 0 14px rgba(0,184,239,.1)}.cp60-top-status.ok>ha-icon{color:var(--green)}.cp60-top-status.warning>ha-icon{color:var(--amber)}
.cp60-top-status>span:not(.cp60-ring){min-width:0;display:flex;flex-direction:column}.cp60-top-status b{font-size:10.5px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp60-top-status small{font-size:8.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp60-top-status>ha-icon:last-child{margin-left:auto;--mdc-icon-size:15px}
.cp60-ring{--tone:var(--amber);width:36px;height:36px;flex:0 0 36px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(var(--tone) calc(var(--score)*1%),#103544 0);box-shadow:0 0 15px color-mix(in srgb,var(--tone) 32%,transparent)}.cp60-ring:after{content:"";position:absolute;inset:4px;background:#05202b;border-radius:50%;box-shadow:inset 0 0 10px #0008}.cp60-ring.green{--tone:var(--green)}.cp60-ring.red{--tone:var(--red)}.cp60-ring b{font-size:9.5px;z-index:1}
.cp60-clock{justify-content:center;flex-direction:column;gap:0;text-align:center}.cp60-clock b{font-size:20px;line-height:1}.cp60-clock small{font-size:8px;color:#c2dce4;white-space:nowrap}.cp60-menu{width:38px;height:38px;border:1px solid #0d607a;border-radius:9px;background:#052431;cursor:pointer;display:grid;place-items:center;transition:.18s}.cp60-menu:hover{border-color:var(--cyan);background:#07344a;transform:rotate(4deg)}
.cp60-main{display:grid;grid-template-columns:minmax(0,2.18fr) minmax(410px,.92fr);gap:6px;min-height:0}
.cp60-hero{display:grid;grid-template-rows:36px minmax(0,1fr) 50px;overflow:hidden}.cp60-hero>header,.cp60-card>header,.cp60-bottom-card>header{display:flex;align-items:center;gap:8px;padding:5px 9px;border-bottom:1px solid rgba(12,86,109,.82);min-height:0;background:linear-gradient(90deg,rgba(8,52,70,.5),transparent 70%)}
.cp60-hero>header span,.cp60-card>header span,.cp60-bottom-card>header span{display:flex;flex-direction:column;min-width:0}.cp60-hero>header b,.cp60-card>header b,.cp60-bottom-card>header b{font-size:11.5px;color:#fff}.cp60-hero>header small,.cp60-card>header small,.cp60-bottom-card>header small{font-size:8.5px;color:#b7d5de;line-height:1.15}.cp61-view-pill{margin-left:auto;font-style:normal;font-size:7.5px;letter-spacing:1.2px;font-weight:900;color:#8fe8fb;border:1px solid #0e6c87;border-radius:999px;padding:3px 7px;background:#052633}
.cp60-hero-body{display:grid;grid-template-columns:146px minmax(0,1fr);min-height:0}.cp60-nav{padding:5px;display:grid;grid-template-rows:repeat(9,minmax(0,1fr));gap:4px;background:linear-gradient(180deg,#03141e,#020e15);border-right:1px solid #084c63;min-height:0}.cp60-nav button{border:1px solid #0b5871;background:linear-gradient(180deg,#052532,#041c27);border-radius:8px;display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:9.5px;font-weight:800;cursor:pointer;min-height:0;transition:.16s ease;position:relative;overflow:hidden}.cp60-nav button:before{content:"";position:absolute;left:0;top:20%;bottom:20%;width:2px;background:transparent;border-radius:2px}.cp60-nav button:hover{border-color:#1595b8;background:#073047;transform:translateX(1px)}.cp60-nav button.active{background:linear-gradient(90deg,#086f92,#0b9dc4);border-color:#3be2ff;box-shadow:0 0 15px rgba(0,191,255,.24),inset 0 0 18px rgba(79,230,255,.08)}.cp60-nav button.active:before{background:#6af2ff;box-shadow:0 0 8px #62ecff}.cp60-nav button ha-icon{--mdc-icon-size:18px}.cp60-stage{min-width:0;min-height:0;overflow:hidden;background:radial-gradient(circle at 55% 42%,#06202b,#010b11 67%);padding:6px}
.cp60-map{height:100%;position:relative;border-radius:10px;overflow:hidden;border:1px solid #0b536a;background:#010b10;box-shadow:inset 0 0 30px #0008}.cp60-map>img{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(1.08) contrast(1.05) brightness(.94);transform:scale(1.003)}.cp60-map:before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(115deg,transparent 0 42%,rgba(45,220,255,.055) 50%,transparent 58%);animation:cp61Scan 8s linear infinite}.cp60-map:after{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(0,183,255,.07),transparent 30%,rgba(0,19,30,.18)),repeating-linear-gradient(90deg,rgba(0,191,255,.05) 0 1px,transparent 1px 72px),repeating-linear-gradient(0deg,rgba(0,191,255,.03) 0 1px,transparent 1px 72px);pointer-events:none}.cp60-map-chip{position:absolute;z-index:3;display:flex;align-items:center;gap:8px;background:linear-gradient(180deg,rgba(5,44,58,.95),rgba(3,28,39,.94));border:1px solid #23cce9;border-radius:9px;padding:6px 9px;box-shadow:0 9px 22px #000a,0 0 16px rgba(0,215,255,.22),inset 0 1px rgba(255,255,255,.05);backdrop-filter:blur(5px)}.cp60-map-chip ha-icon{--mdc-icon-size:23px}.cp60-map-chip span{display:flex;flex-direction:column}.cp60-map-chip b{font-size:10.5px}.cp60-map-chip small{font-size:8.5px;color:#2ff0be;font-weight:800}.cp60-map-chip.win{left:28%;top:7%}.cp60-map-chip.sens{right:4%;top:14%}.cp60-map-chip.fence{left:3%;bottom:11%}.cp60-map-chip.fence.bad{border-color:#ff4b64;box-shadow:0 9px 22px #000a,0 0 18px rgba(255,59,86,.2)}.cp60-map-chip.fence.bad ha-icon,.cp60-map-chip.fence.bad small{color:#ff6176}.cp60-map-chip.gate{left:44%;bottom:5%}
.cp60-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;padding:4px;background:#03131d}.cp60-kpis button{border:1px solid #0b5871;background:linear-gradient(180deg,#052530,#041c26);border-radius:8px;display:grid;grid-template-columns:31px minmax(0,1fr);align-items:center;text-align:left;gap:6px;padding:4px 6px;cursor:pointer;min-width:0;transition:.16s}.cp60-kpis button:hover{border-color:#20bde5;background:#073047;transform:translateY(-1px)}.cp60-kpis button.bad{border-color:#a92e44;background:linear-gradient(180deg,#35131d,#211016)}.cp60-kpis button span{display:flex;flex-direction:column;min-width:0}.cp60-kpis small{font-size:8.5px;color:#c2d9e0}.cp60-kpis b{font-size:14px;line-height:1.02}.cp60-kpis em{font-size:8px;color:#a8cbd6;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp60-kpis button.bad b{color:#ff6177}.cp60-kpis ha-icon{--mdc-icon-size:21px}
.cp60-right{display:grid;grid-template-rows:minmax(95px,1.12fr) minmax(92px,1.08fr) 68px 68px minmax(98px,1.35fr);gap:5px;min-height:0}.cp60-card{overflow:hidden;display:grid;grid-template-rows:32px minmax(0,1fr)}.cp60-card>header{height:32px}.cp60-card>header>strong{margin-left:auto;font-size:8.5px}.cp60-dot{margin-left:auto;width:8px;height:8px;border-radius:50%;background:var(--red)}.cp60-dot.on{background:var(--green);box-shadow:0 0 11px var(--green)}.cp60-mode-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:3px;padding:4px}.cp60-mode-grid button,.cp60-alarm-grid button{border:1px solid #0b5972;background:#052431;border-radius:8px;display:flex;align-items:center;gap:6px;padding:4px 6px;min-width:0;cursor:pointer;transition:.16s}.cp60-mode-grid button:hover,.cp60-alarm-grid button:hover{border-color:#1797bb;background:#073147}.cp60-mode-grid button.active,.cp60-alarm-grid button.active{border-color:#25e6bd;background:linear-gradient(135deg,#075951,#087a64);box-shadow:0 0 14px rgba(0,255,184,.13),inset 0 0 17px rgba(0,255,174,.08)}.cp60-mode-grid button span,.cp60-alarm-grid button span{display:flex;flex-direction:column;min-width:0}.cp60-mode-grid b,.cp60-alarm-grid b{font-size:9.5px;white-space:nowrap}.cp60-mode-grid small,.cp60-alarm-grid small{font-size:8.5px;color:#d0e3e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp60-mode-grid ha-icon,.cp60-alarm-grid ha-icon{--mdc-icon-size:19px}.cp60-alarm-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;padding:4px}.cp60-mini{grid-template-rows:31px minmax(0,1fr)}.cp60-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:4px;min-height:0}.cp60-actions button{border:1px solid #1486ac;border-radius:7px;background:linear-gradient(180deg,#0a6f96,#063b51);font-size:10px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;min-height:28px;transition:.16s}.cp60-actions button:hover{filter:brightness(1.12);border-color:#37d8ff;box-shadow:0 0 14px rgba(0,194,255,.12)}.cp60-actions button.danger{border-color:#aa3247;background:linear-gradient(180deg,#681d31,#38101e)}.cp60-summary{grid-template-rows:32px minmax(0,1fr)}.cp60-alert-count{margin-left:auto;border:1px solid #bf3149;background:#501420;border-radius:7px;padding:2px 7px;font-size:10px}.cp60-summary-list{overflow:auto;padding:1px 7px}.cp60-summary-list button{width:100%;border:0;border-bottom:1px solid #0a3f52;background:transparent;display:grid;grid-template-columns:23px minmax(0,1fr) 34px;gap:6px;align-items:center;text-align:left;padding:4px 0;min-height:30px}.cp60-summary-list button:hover{background:rgba(20,108,138,.09)}.cp60-summary-list button span{display:flex;flex-direction:column;min-width:0}.cp60-summary-list b{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp60-summary-list small,.cp60-summary-list em{font-size:8px;color:#b6d2db;font-style:normal}.cp60-ok{height:100%;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--green);font-weight:800;font-size:10px}
.cp60-bottom{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,.85fr) minmax(0,.75fr);gap:6px;min-height:0}.cp60-bottom.sensor-mode{grid-template-columns:minmax(0,1.58fr) minmax(0,.78fr) minmax(0,.72fr)}.cp60-bottom-card{display:grid;grid-template-rows:31px minmax(0,1fr);overflow:hidden}.cp60-bottom-card>header{height:31px}.cp60-bottom-card>header>span{display:flex;align-items:center;gap:6px;min-width:0}.cp60-bottom-card>header>span b{font-size:10.5px}.cp60-bottom-card>header>span small{margin-left:3px}.cp60-bottom-card>header>button{margin-left:auto;background:none;border:0;color:#d2e7ed;font-size:8.5px;cursor:pointer}.cp60-bottom-card>header>button:hover{color:#4ee7ff}.cp60-cam-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:4px;min-height:0}.cp60-camera{border:1px solid #0b5871;background:#020c12;border-radius:8px;overflow:hidden;padding:0;cursor:pointer;display:grid;grid-template-rows:minmax(0,1fr) 23px;min-width:0;min-height:0;transition:.16s}.cp60-camera:hover{border-color:#21bbe3;box-shadow:0 0 15px rgba(0,191,255,.12);transform:translateY(-1px)}.cp60-cam-media{position:relative;min-height:0;background:#01090e;overflow:hidden}.cp60-cam-media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .25s ease,filter .25s ease}.cp60-camera:hover img{transform:scale(1.02);filter:contrast(1.04)}.cp60-cam-fallback{position:absolute;inset:0;display:grid;place-items:center}.cp60-live{position:absolute;left:5px;top:4px;border-radius:10px;padding:2px 6px;font-size:7.5px;font-weight:900;background:#06382d;border:1px solid #13ba91;box-shadow:0 0 10px rgba(0,226,171,.16)}.cp60-live.off{background:#441622;border-color:#a62a42}.cp60-cam-name{display:flex;align-items:center;padding:3px 6px;font-size:8.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp60-people{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px;min-height:0}.cp60-person{border:1px solid #0a677b;background:linear-gradient(180deg,#041e2a,#031720);border-radius:8px;display:grid;grid-template-columns:38px minmax(0,1fr) 13px;gap:6px;align-items:center;padding:5px;min-width:0;cursor:pointer;position:relative;overflow:hidden;transition:.16s}.cp60-person:after{content:"";position:absolute;left:5px;right:5px;bottom:2px;height:2px;border-radius:2px;background:#1495b7;opacity:.65}.cp60-person:hover{transform:translateY(-1px);background:#052331}.cp60-person.home{border-color:#18dba7}.cp60-person.home:after{background:var(--green);box-shadow:0 0 8px var(--green)}.cp60-person.away{border-color:#ff4c64}.cp60-person.away:after{background:var(--red)}.cp60-person.zone{border-color:#30a9ff}.cp60-person.zone:after{background:#30a9ff}.cp60-avatar{width:38px;height:38px;border-radius:50%;border:2px solid currentColor;overflow:hidden;display:grid;place-items:center;color:#1ee2b5;background:#062737;box-shadow:0 0 13px currentColor}.cp60-avatar img{width:100%;height:100%;object-fit:cover}.cp60-person-copy{display:flex;flex-direction:column;min-width:0}.cp60-person-copy b{font-size:9px;color:#fff;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp60-person-copy strong{font-size:8.5px;color:#24e7b6;margin-top:2px}.cp60-person.away strong{color:#ff6377}.cp60-person.zone strong{color:#55bdff}.cp60-person-copy span{font-size:8px;color:#c0d7de;margin-top:2px}.cp60-person>ha-icon{--mdc-icon-size:13px}.cp60-events{overflow:auto;padding:3px 6px}.cp60-events>div{display:grid;grid-template-columns:36px 7px minmax(0,1fr);gap:5px;align-items:center;min-height:25px;border-bottom:1px solid #083647}.cp60-events time{font-size:8px;color:#b4cfd8}.cp60-events i{width:6px;height:6px;border-radius:50%;background:#2ac7ff;box-shadow:0 0 7px currentColor}.cp60-events i.green{background:#16e8ad}.cp60-events i.red{background:#ff4d65}.cp60-events span{display:flex;flex-direction:column;min-width:0}.cp60-events b{font-size:8.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp60-events small{font-size:7.8px;color:#acc9d2}
.cp60-scroll{overflow:auto;min-height:0}.cp60-detail{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr);gap:6px;min-height:0}.cp60-detail:has(.cp60-per-top){grid-template-rows:auto minmax(0,1fr) 45px}.cp60-stats4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.cp60-stats4>div{border:1px solid #0b5871;background:linear-gradient(180deg,#052532,#041c26);border-radius:10px;display:grid;grid-template-columns:38px minmax(0,1fr);gap:7px;align-items:center;padding:9px;min-height:74px}.cp60-stats4>div ha-icon{--mdc-icon-size:27px}.cp60-stats4>div span{display:flex;flex-direction:column}.cp60-stats4 small{font-size:9px;color:#b7d1d9}.cp60-stats4 b{font-size:23px;line-height:1.1}.cp60-open-list,.cp60-zone-list,.cp60-device-list,.cp60-sensor-list,.cp60-per-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;align-content:start}.cp60-open-list button,.cp60-zone-list button,.cp60-device-list button,.cp60-sensor-row,.cp60-per-list button,.cp60-modal-list button{border:1px solid #0a526a;background:#04202c;border-radius:8px;display:grid;grid-template-columns:30px minmax(0,1fr) 70px;gap:7px;align-items:center;text-align:left;padding:7px;min-height:50px;transition:.14s}.cp60-open-list button:hover,.cp60-zone-list button:hover,.cp60-device-list button:hover,.cp60-sensor-row:hover,.cp60-per-list button:hover,.cp60-modal-list button:hover{border-color:#1689aa;background:#052a39}.cp60-open-list button span,.cp60-zone-list button span,.cp60-device-list button span,.cp60-sensor-row span,.cp60-per-list button span,.cp60-modal-list button span{display:flex;flex-direction:column;min-width:0}.cp60-open-list b,.cp60-zone-list b,.cp60-device-list b,.cp60-sensor-row b,.cp60-per-list b,.cp60-modal-list b{font-size:9.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp60-open-list small,.cp60-zone-list small,.cp60-device-list small,.cp60-sensor-row small,.cp60-per-list small,.cp60-modal-list small{font-size:8px;color:#b2ced6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp60-open-list strong,.cp60-zone-list strong,.cp60-device-list strong,.cp60-sensor-row strong,.cp60-per-list strong{font-size:8.5px;text-align:right}.green{color:var(--green)!important}.red{color:var(--red)!important}.amber{color:var(--amber)!important}.cp60-sensor-row{grid-template-columns:30px minmax(0,1fr) 70px 40px}
.cp60-per-top{display:grid;grid-template-columns:1.18fr repeat(4,minmax(0,1fr));gap:6px}.cp60-score-ring,.cp60-per-card{border:1px solid #0b5c76;background:linear-gradient(180deg,#052532,#041b25);border-radius:10px;min-height:82px}.cp60-score-ring{--tone:var(--green);display:flex;align-items:center;justify-content:center;gap:12px;position:relative;overflow:hidden}.cp60-score-ring:before{content:"";width:56px;height:56px;border-radius:50%;background:conic-gradient(var(--tone) calc(var(--score)*1%),#103544 0);box-shadow:0 0 18px rgba(30,224,174,.16)}.cp60-score-ring:after{content:"";position:absolute;left:18px;width:44px;height:44px;border-radius:50%;background:#05202b}.cp60-score-ring b{font-size:18px;z-index:1;position:absolute;left:26px}.cp60-score-ring span{font-size:10px;font-weight:800;margin-left:54px;max-width:85px}.cp60-per-card{display:grid;grid-template-columns:32px minmax(0,1fr);gap:6px;align-items:center;padding:8px}.cp60-per-card span{display:flex;flex-direction:column}.cp60-per-card small{font-size:8px;color:#b2d0d8;text-transform:uppercase;letter-spacing:.5px}.cp60-per-card b{font-size:16px}.cp60-per-card em{font-size:8px;color:#aac9d3;font-style:normal}.cp60-center-action{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}.cp60-orb{width:178px;height:178px;border-radius:50%;border:2px solid #ff4b62;box-shadow:0 0 40px rgba(255,39,69,.25),inset 0 0 30px rgba(255,39,69,.08);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;background:rgba(59,17,28,.32)}.cp60-orb.on{border-color:#19e7b2;box-shadow:0 0 40px rgba(0,231,177,.25),inset 0 0 30px rgba(0,231,177,.09);background:rgba(8,56,46,.52)}.cp60-orb ha-icon{--mdc-icon-size:46px}.cp60-orb b{font-size:17px}.cp60-orb small{font-size:8.5px;color:#c1d9e0;max-width:150px;overflow:hidden;text-overflow:ellipsis}.cp60-center-action>.cp60-actions{width:min(500px,80%)}.cp60-zone-head{display:flex;align-items:center;justify-content:space-between;border:1px solid #0b5871;background:#052330;border-radius:9px;padding:9px 11px}.cp60-zone-head>div{display:flex;align-items:center;gap:9px}.cp60-zone-head b{font-size:22px}.cp60-zone-head span{font-size:9.5px}.cp60-zone-head button,.cp60-monitor-head button{border:1px solid #1181a4;background:#06405a;border-radius:7px;padding:6px 10px;font-size:9px;cursor:pointer}.cp60-bat-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;align-content:start}.cp60-bat-list button{border:1px solid #0a526a;background:#04202c;border-radius:8px;display:grid;grid-template-columns:32px minmax(0,1fr) 45px;gap:8px;align-items:center;text-align:left;padding:7px;min-height:54px}.cp60-bat-list button.attention{border-color:#8d761d;background:#2d281409}.cp60-bat-list button.critical{border-color:#a62c43;background:#32121b}.cp60-bat-list button span{display:flex;flex-direction:column;min-width:0}.cp60-bat-list b{font-size:9.5px}.cp60-bat-list small{font-size:8px;color:#b4ced6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp60-bat-list i{height:4px;background:#07374a;border-radius:4px;margin-top:4px;overflow:hidden}.cp60-bat-list u{display:block;height:100%;background:var(--green);border-radius:4px}.cp60-bat-list button.attention u{background:var(--amber)}.cp60-bat-list button.critical u{background:var(--red)}.cp60-bat-list strong{font-size:11px}.cp60-monitor{height:100%;display:grid;grid-template-rows:36px minmax(0,1fr);gap:5px}.cp60-monitor-head{display:flex;align-items:center;justify-content:space-between;border:1px solid #0b5871;border-radius:8px;background:#052330;padding:5px 9px}.cp60-monitor-head span{display:flex;flex-direction:column}.cp60-monitor-head b{font-size:10.5px}.cp60-monitor-head small{font-size:8px;color:#b4d0d8}.cp60-monitor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:5px;min-height:0}.cp60-sensor-inventory{grid-column:span 1}.cp60-mini-sensor-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:52px;gap:4px;padding:4px;overflow:auto}.cp60-mini-sensor{border:1px solid #0a526a;background:#04202c;border-radius:7px;display:grid;grid-template-columns:25px minmax(0,1fr) 34px;gap:5px;align-items:center;text-align:left;padding:4px;min-width:0}.cp60-mini-sensor:hover{border-color:#1588a9;background:#052a39}.cp60-mini-sensor span{display:flex;flex-direction:column;min-width:0}.cp60-mini-sensor b{font-size:8.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cp60-mini-sensor small{font-size:8px;color:#b6d0d8}.cp60-mini-sensor em{font-size:8.5px;font-style:normal;font-weight:900}
.cp60-modal-back{position:absolute;inset:0;background:rgba(0,4,8,.78);display:grid;place-items:center;z-index:90;backdrop-filter:blur(7px)}.cp60-modal{width:min(1120px,90%);height:min(700px,88%);border:1px solid #167894;border-radius:15px;background:linear-gradient(180deg,#041b26,#020f16);box-shadow:0 25px 70px #000;display:grid;grid-template-rows:62px minmax(0,1fr);overflow:hidden}.cp60-modal>header{display:grid;grid-template-columns:44px minmax(0,1fr) 40px;gap:9px;align-items:center;padding:7px 12px;border-bottom:1px solid #0b5b74;background:linear-gradient(90deg,#063149,#031923)}.cp60-modal>header>ha-icon{--mdc-icon-size:29px}.cp60-modal>header span{display:flex;flex-direction:column}.cp60-modal>header small{font-size:8.5px;letter-spacing:1.3px;color:#a7cfda}.cp60-modal>header b{font-size:17px}.cp60-modal>header button{width:36px;height:36px;border:1px solid #0d607b;border-radius:9px;background:#052839;cursor:pointer}.cp60-modal-body{padding:10px;overflow:auto}.cp60-modal-list{display:grid;gap:6px}.cp60-modal-list button{grid-template-columns:32px minmax(0,1fr)}.cp60-modal-list button.selected{border-color:#17e2ae;background:#07342e}.cp60-help{color:#c4dce3;font-size:9.5px}.cp60-engine-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:8px}.cp60-engine-summary>div{border:1px solid #0b5871;background:#052330;border-radius:9px;padding:10px;display:flex;flex-direction:column}.cp60-engine-summary small{font-size:8.5px;color:#b5d0d8}.cp60-engine-summary b{font-size:20px}.cp60-engine-error{display:flex;align-items:center;gap:9px;border:1px solid #a62a42;background:#431522;border-radius:9px;padding:9px;margin-bottom:8px}.cp60-engine-error span{display:flex;flex-direction:column}.cp60-engine-error b{font-size:10.5px}.cp60-engine-error small{font-size:8.5px;color:#ffd5dc}.cp60-engine-list{display:grid;gap:5px}.cp60-engine-list>div{display:grid;grid-template-columns:64px minmax(0,1fr) 78px 82px;gap:7px;align-items:center;border:1px solid #0a526a;background:#04202c;border-radius:8px;padding:7px}.cp60-code{font-size:8.5px;color:#40dcff;font-weight:900}.cp60-engine-list>div>span:nth-child(2){display:flex;flex-direction:column}.cp60-engine-list b{font-size:9.5px}.cp60-engine-list small{font-size:8px;color:#b1ccd4;line-height:1.25}.cp60-engine-list button,.cp60-modal-actions button{border:1px solid #147d9e;background:#063b52;border-radius:7px;padding:6px;font-size:8.5px;cursor:pointer}.cp60-engine-list button.ok,.cp60-modal-actions button.ok{border-color:#169f7b;background:#073d32}.cp60-engine-list button.danger{border-color:#a62a42;background:#471523}.cp60-engine-fields{display:grid;gap:7px}.cp60-engine-fields label{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(0,1.2fr);gap:10px;align-items:center;border:1px solid #0a526a;border-radius:8px;background:#04202c;padding:8px}.cp60-engine-fields label>span{display:flex;flex-direction:column}.cp60-engine-fields b{font-size:9.5px}.cp60-engine-fields small{font-size:8px;color:#b2ccd4}.cp60-engine-fields input,.cp60-engine-fields textarea{background:#021018;color:#f1fbff;border:1px solid #0d6783;border-radius:7px;padding:7px;font-size:9.5px}.cp60-engine-fields textarea{min-height:66px}.cp60-modal-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:8px}.cp60-empty{display:grid;place-items:center;color:#bad3db;font-size:10.5px;height:100%;min-height:70px}.cp60-toast{position:absolute;right:16px;bottom:16px;z-index:120;background:#063b52;border:1px solid #1592b9;border-radius:8px;padding:9px 12px;font-size:9.5px;opacity:0;transform:translateY(8px);pointer-events:none;transition:.2s;box-shadow:0 12px 28px #0008}.cp60-toast.show{opacity:1;transform:none}.cp60-toast.error{background:#571728;border-color:#b42f49}.cp60-toast.success{background:#083c32;border-color:#17ae88}
#cp60-root.compact .cp60-shell{grid-template-rows:54px minmax(0,1fr) 150px;gap:5px;padding:5px}#cp60-root.compact .cp60-top{grid-template-columns:minmax(245px,1.35fr) minmax(145px,.78fr) repeat(3,minmax(112px,.62fr)) 112px 38px;padding:4px 7px;gap:5px}#cp60-root.compact .cp60-brand b{font-size:18px}#cp60-root.compact .cp60-brand small{font-size:8.5px}#cp60-root.compact .cp60-shield{width:40px;height:40px}#cp60-root.compact .cp60-top-status,#cp60-root.compact .cp60-clock{height:40px;padding:4px 7px}#cp60-root.compact .cp60-top-status b{font-size:9.5px}#cp60-root.compact .cp60-top-status small{font-size:8px}#cp60-root.compact .cp60-clock b{font-size:17px}#cp60-root.compact .cp60-main{grid-template-columns:minmax(0,2.18fr) minmax(390px,.9fr);gap:5px}#cp60-root.compact .cp60-hero{grid-template-rows:33px minmax(0,1fr) 47px}#cp60-root.compact .cp60-hero-body{grid-template-columns:136px minmax(0,1fr)}#cp60-root.compact .cp60-nav{gap:3px;padding:4px}#cp60-root.compact .cp60-nav button{font-size:9px;padding:3px 6px}#cp60-root.compact .cp60-stage{padding:5px}#cp60-root.compact .cp60-right{grid-template-rows:minmax(88px,1.08fr) minmax(85px,1.03fr) 62px 62px minmax(88px,1.28fr);gap:4px}#cp60-root.compact .cp60-card{grid-template-rows:29px minmax(0,1fr)}#cp60-root.compact .cp60-card>header{height:29px;padding:3px 6px}#cp60-root.compact .cp60-hero>header b,#cp60-root.compact .cp60-card>header b,#cp60-root.compact .cp60-bottom-card>header b{font-size:10.5px}#cp60-root.compact .cp60-hero>header small,#cp60-root.compact .cp60-card>header small,#cp60-root.compact .cp60-bottom-card>header small{font-size:8px}#cp60-root.compact .cp60-mode-grid,#cp60-root.compact .cp60-alarm-grid{padding:3px;gap:3px}#cp60-root.compact .cp60-mode-grid b,#cp60-root.compact .cp60-alarm-grid b{font-size:9px}#cp60-root.compact .cp60-mode-grid small,#cp60-root.compact .cp60-alarm-grid small{font-size:8px}#cp60-root.compact .cp60-bottom{gap:5px}#cp60-root.compact .cp60-bottom-card{grid-template-rows:29px minmax(0,1fr)}#cp60-root.compact .cp60-bottom-card>header{height:29px;padding:3px 6px}#cp60-root.compact .cp60-cam-row,#cp60-root.compact .cp60-people{padding:3px;gap:3px}#cp60-root.compact .cp60-person{grid-template-columns:34px minmax(0,1fr) 12px;padding:4px}#cp60-root.compact .cp60-avatar{width:34px;height:34px}#cp60-root.compact .cp60-person-copy b{font-size:8.5px}#cp60-root.compact .cp60-person-copy strong{font-size:8px}#cp60-root.compact .cp60-person-copy span{font-size:7.8px}#cp60-root.compact .cp60-events>div{min-height:23px}#cp60-root.compact .cp60-stats4>div{min-height:64px;padding:7px}#cp60-root.compact .cp60-stats4 b{font-size:20px}#cp60-root.compact .cp60-per-top{gap:4px}#cp60-root.compact .cp60-score-ring,#cp60-root.compact .cp60-per-card{min-height:72px}#cp60-root.compact .cp60-bat-list button{min-height:50px}
#cp60-root.micro .cp60-shell{grid-template-rows:50px minmax(0,1fr) 136px}#cp60-root.micro .cp60-brand small,#cp60-root.micro .cp60-clock small{display:none}#cp60-root.micro .cp60-top{grid-template-columns:minmax(220px,1.25fr) minmax(138px,.72fr) repeat(3,minmax(100px,.58fr)) 96px 36px}#cp60-root.micro .cp60-brand b{font-size:17px}#cp60-root.micro .cp60-shield{width:37px;height:37px}#cp60-root.micro .cp60-top-status,#cp60-root.micro .cp60-clock{height:37px}#cp60-root.micro .cp60-top-status small{display:none}#cp60-root.micro .cp60-main{grid-template-columns:minmax(0,2.2fr) minmax(370px,.82fr)}#cp60-root.micro .cp60-right{grid-template-rows:minmax(80px,1.04fr) minmax(78px,1fr) 57px 57px minmax(78px,1.2fr)}#cp60-root.micro .cp60-map-chip{padding:4px 6px}#cp60-root.micro .cp60-map-chip b{font-size:9px}#cp60-root.micro .cp60-map-chip small{font-size:8px}#cp60-root.micro .cp60-radar{width:82px;height:82px}#cp60-root.micro .cp60-kpis b{font-size:12px}#cp60-root.micro .cp60-kpis small,#cp60-root.micro .cp60-kpis em{font-size:8px}#cp60-root.micro .cp60-mini-sensor-grid{grid-auto-rows:46px}
#cp60-root.narrow .cp60-top{grid-template-columns:minmax(220px,1.3fr) minmax(138px,.72fr) repeat(3,minmax(104px,.6fr)) 104px 38px}#cp60-root.narrow .cp60-brand b{font-size:18px}#cp60-root.narrow .cp60-main{grid-template-columns:minmax(0,1.95fr) minmax(365px,.88fr)}#cp60-root.narrow .cp60-hero-body{grid-template-columns:130px minmax(0,1fr)}#cp60-root.narrow .cp60-nav button span{font-size:8.8px}#cp60-root.narrow .cp60-bottom{grid-template-columns:minmax(0,1.35fr) minmax(0,.9fr) minmax(0,.78fr)}#cp60-root.narrow .cp60-top-status small{display:none}
#cp60-root.wide .cp60-shell{grid-template-rows:62px minmax(0,1fr) 178px}#cp60-root.wide .cp60-top{grid-template-columns:minmax(330px,1.55fr) minmax(175px,.82fr) repeat(3,minmax(150px,.67fr)) 142px 44px}#cp60-root.wide .cp60-brand b{font-size:23px}#cp60-root.wide .cp60-main{grid-template-columns:minmax(0,2.25fr) minmax(455px,.9fr)}#cp60-root.wide .cp60-hero-body{grid-template-columns:154px minmax(0,1fr)}#cp60-root.wide .cp60-mini-sensor-grid{grid-template-columns:repeat(5,minmax(0,1fr))}
@media(max-width:1180px){#cp60-root{overflow:auto}.cp60-shell{height:auto;min-height:100%;grid-template-rows:auto auto auto}.cp60-top{grid-template-columns:1fr 1fr}.cp60-brand{grid-column:1/-1}.cp60-menu{justify-self:end}.cp60-main,.cp60-bottom,.cp60-bottom.sensor-mode{grid-template-columns:1fr}.cp60-right{grid-template-rows:auto}.cp60-hero{min-height:620px}.cp60-bottom-card{min-height:175px}.cp60-people{grid-template-columns:repeat(3,minmax(0,1fr))}.cp60-top-status,.cp60-clock{min-height:44px}.cp60-mini-sensor-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.cp60-top{grid-template-columns:1fr}.cp60-brand{grid-column:auto}.cp60-main{grid-template-columns:1fr}.cp60-hero-body{grid-template-columns:1fr}.cp60-nav{grid-template-columns:repeat(3,1fr);grid-template-rows:none;border-right:0;border-bottom:1px solid #084c63}.cp60-nav button{min-height:42px}.cp60-stage{min-height:420px}.cp60-kpis{grid-template-columns:repeat(2,1fr)}.cp60-stats4,.cp60-per-top{grid-template-columns:repeat(2,1fr)}.cp60-open-list,.cp60-zone-list,.cp60-device-list,.cp60-sensor-list,.cp60-per-list,.cp60-bat-list{grid-template-columns:1fr}.cp60-cam-row,.cp60-people,.cp60-mini-sensor-grid{grid-template-columns:repeat(2,1fr)}.cp60-engine-summary{grid-template-columns:repeat(2,1fr)}.cp60-engine-list>div{grid-template-columns:1fr}.cp60-engine-fields label{grid-template-columns:1fr}}
/* Security footer: icon beside a two-line heading, independent of legacy CSS. */
#cp60-root .cp60-bottom-card{grid-template-rows:42px minmax(0,1fr)}
#cp60-root .cp60-bottom-card>header{height:auto;min-height:42px;display:flex;flex-direction:row;align-items:center;gap:8px;padding:5px 9px;overflow:visible}
#cp60-root .cp60-bottom-card>header>ha-icon{position:static;inset:auto;display:inline-flex;flex:0 0 20px;width:20px;height:20px;margin:0;--mdc-icon-size:20px;overflow:visible}
#cp60-root .cp60-bottom-card>header>span{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-width:0}
#cp60-root .cp60-bottom-card>header b{display:block;font-size:11px;line-height:14px;white-space:normal;margin:0}
#cp60-root .cp60-bottom-card>header small{display:block;font-size:9px;line-height:12px;white-space:normal;margin:0}
#cp60-root .cp60-bottom-card>header>button{flex-shrink:0;align-self:center}
#cp60-root .cp60-events{padding:4px 8px;min-height:0;overflow:auto}
#cp60-root .cp60-events>div{position:relative;display:grid;grid-template-columns:42px 8px minmax(0,1fr);gap:7px;align-items:start;min-height:44px;height:auto;padding:6px 0}
#cp60-root .cp60-events>div>time,#cp60-root .cp60-events>div>i,#cp60-root .cp60-events>div>span{position:static!important;inset:auto!important;transform:none;min-width:0;margin:0}
#cp60-root .cp60-events>div>time{font-size:10px;line-height:15px;white-space:nowrap}
#cp60-root .cp60-events>div>i{margin-top:4px;width:6px;height:6px}
#cp60-root .cp60-events>div>span{display:flex;flex-direction:column;gap:3px}
#cp60-root .cp60-events b{display:block;font-size:11px;line-height:15px;white-space:normal;overflow-wrap:anywhere;overflow:visible}
#cp60-root .cp60-events small{display:block;font-size:9px;line-height:13px;white-space:normal;overflow-wrap:anywhere}
#cp60-root .cp60-map>img{display:block;max-width:none}


/* Architectural edge lighting: no overlay in the centre of the residence. */
#cp60-root .cp60-map{isolation:isolate;border-color:#20b9db;box-shadow:0 0 0 1px #19bfe52b,0 0 24px #00a9de22,inset 0 0 30px #0008}
#cp60-root .cp60-map:before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;border-radius:inherit;background:linear-gradient(90deg,#65eeffbb,transparent) left top/110px 2px no-repeat,linear-gradient(180deg,#65eeffbb,transparent) left top/2px 72px no-repeat,linear-gradient(270deg,#20d8b6aa,transparent) right bottom/110px 2px no-repeat,linear-gradient(0deg,#20d8b6aa,transparent) right bottom/2px 72px no-repeat;animation:cp129Edge 6s ease-in-out infinite;transform:none}
#cp60-root .cp60-map:after{background:linear-gradient(180deg,#00121d18,transparent 20%,transparent 78%,#00121d44);pointer-events:none}
@keyframes cp129Edge{0%,100%{opacity:.55}50%{opacity:1}}
@media(prefers-reduced-motion:reduce){#cp60-root .cp60-map:before{animation:none;opacity:.85}}


#cp60-root .cp60-camera-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:minmax(190px,1fr);align-content:start;gap:8px;height:100%;padding:3px}
#cp60-root .cp60-camera{display:grid;grid-template-rows:minmax(0,1fr) 26px;min-width:0;width:100%;min-height:110px;padding:0;overflow:hidden;border:1px solid #087a99;border-radius:10px;background:#020d15;color:#f3fbff;text-align:left}
#cp60-root .cp60-cam-media{position:relative;min-height:0;height:100%;overflow:hidden}
#cp60-root .cp60-cam-media img{display:block;width:100%;height:100%;object-fit:cover}
#cp60-root .cp60-cam-fallback{position:absolute;inset:0;place-items:center;background:radial-gradient(ellipse at center,#073142,#020d15)}
#cp60-root .cp60-cam-fallback ha-icon{--mdc-icon-size:34px}
#cp60-root .cp60-cam-name{font-size:11px;line-height:16px;padding:4px 8px}
#cp60-root .cp60-map:before{background:linear-gradient(90deg,transparent,#7beeff,transparent) 0 0/45% 3px no-repeat,linear-gradient(270deg,transparent,#25ffd0,transparent) 100% 100%/45% 3px no-repeat,linear-gradient(180deg,#51e5ff88,transparent 40%,transparent 60%,#28ffd077) 0 0/3px 100% no-repeat,linear-gradient(180deg,#51e5ff88,transparent 40%,transparent 60%,#28ffd077) 100% 0/3px 100% no-repeat;animation:cp131Perimeter 5s ease-in-out infinite;opacity:1;box-shadow:inset 0 0 28px #19c8ed22}
#cp60-root .cp60-map{box-shadow:0 0 0 1px #42e7ff99,0 0 22px #00caff44,inset 0 0 34px #00b4dd33}
@keyframes cp131Perimeter{0%,100%{background-position:0 0,100% 100%,0 0,100% 0;filter:brightness(1)}50%{background-position:100% 0,0 100%,0 0,100% 0;filter:brightness(1.6)}}
@media(max-width:760px){#cp60-root .cp60-camera-grid{grid-template-columns:1fr}}


#cp60-root .cp132-light-routes{position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;filter:drop-shadow(0 0 5px #36e7ff);fill:none;stroke:url(#cp132Route);stroke-width:1.8}
#cp60-root .cp132-light-routes .edge{stroke-dasharray:36 760;animation:cp132Travel 12s linear infinite;opacity:.85}
#cp60-root .cp132-light-routes .route{stroke-dasharray:8 90;animation:cp132Link 7s linear infinite;opacity:.48}
#cp60-root .cp132-light-routes .two{animation-delay:-3s;stroke:#50ffd3}
#cp60-root .cp132-light-routes circle{fill:#92ffff;stroke:none;animation:cp132Light 3s ease-in-out infinite}
#cp60-root .cp132-light-routes circle:nth-last-child(2n){animation-delay:-1.5s}
#cp60-root .cp60-map-chip:not(.bad){animation:cp132Chip 4s ease-in-out infinite}
#cp60-root .cp60-map-chip.sens{animation-delay:-2s}
@keyframes cp132Travel{to{stroke-dashoffset:-3184}}
@keyframes cp132Link{to{stroke-dashoffset:-294}}
@keyframes cp132Light{50%{opacity:.35;filter:drop-shadow(0 0 9px #50ffd3)}}
@keyframes cp132Chip{50%{box-shadow:0 0 22px #2ef5ff66,inset 0 0 14px #36dfff22}}

@media(prefers-reduced-motion:reduce){#cp60-root *{animation:none!important;transition:none!important}}
#cp60-root .cp60-alarm-grid button.arming{border-color:#f0c24f;background:#6b4d1766;box-shadow:inset 0 0 12px #e9b72e33}
#cp60-root input[type=checkbox][data-n134],#cp60-root [data-n134-sensor] input[type=checkbox],#cp60-root [data-n134-person] input[type=checkbox]{width:18px!important;height:18px!important;min-width:18px!important;flex:0 0 18px;margin:0 8px 0 0;accent-color:#22decd}
#cp60-root .cp60-engine-fields label:has(input[type=checkbox][data-n134]){justify-content:flex-start}
@keyframes cp60Pulse{0%,100%{filter:drop-shadow(0 0 4px #00ddff)}50%{filter:drop-shadow(0 0 13px #00ffca);transform:scale(1.045)}}
@keyframes cp60Ring{0%{transform:scale(.9);opacity:.6}100%{transform:scale(1.15);opacity:0}}
@keyframes cp60Radar{0%{transform:scale(.45);opacity:.75}100%{transform:scale(1.45);opacity:0}}
@keyframes cp61Scan{0%{transform:translateX(-125%)}100%{transform:translateX(125%)}}
`;root.appendChild(st)}

  function ensureClock137(host){
    if(host.__cp61Clock)return;
    host.__cp137FullRefresh=Date.now();
    host.__cp61Clock=setInterval(()=>{
      if(!host.isConnected){clearInterval(host.__cp61Clock);host.__cp61Clock=null;return;}
      tickAlarm137(host);
      if(Date.now()-host.__cp137FullRefresh>=15000){host.__cp137FullRefresh=Date.now();schedule(host)}
    },1000);
  }
  function mount(host){ if(!host?.isConnected||!host?.shadowRoot||!host?._hass)return; ensureClock137(host);ensureStyle(host.shadowRoot); render(host); }

  function schedule(host){cancelAnimationFrame(host.__cp60Frame);host.__cp60Frame=requestAnimationFrame(()=>mount(host));}

  function install(){
    customElements.whenDefined(TAG).then(()=>{
      const K=customElements.get(TAG); if(!K||K.prototype.__cp60Installed)return; K.prototype.__cp60Installed=true;
      const hd=Object.getOwnPropertyDescriptor(K.prototype,'hass');
      if(hd?.set)Object.defineProperty(K.prototype,'hass',{...hd,set(value){
        const before=this._hass;hd.set.call(this,value);
        const id=alarmId(this);
        if(before?.states?.[id]!==value?.states?.[id]||before?.states?.['select.cloudpelizzon_security_mode']!==value?.states?.['select.cloudpelizzon_security_mode'])schedule(this);
      }});
      const r=K.prototype.render; if(typeof r==='function')K.prototype.render=function(...a){if(this.__cp60Overlay==='native134'&&this.shadowRoot?.querySelector('[data-native-save134]')){schedule(this);return;}const out=r.apply(this,a);schedule(this);return out};
      const c=K.prototype.connectedCallback; K.prototype.connectedCallback=function(...a){const out=typeof c==='function'?c.apply(this,a):undefined;this.__cp60NativeMode=false;this.__cp60View=localStorage.getItem(VIEW_KEY)||'overview';window.__cp60Host=this;clearInterval(this.__cp61Clock);this.__cp61Clock=null;ensureClock137(this);schedule(this);return out};
      const d=K.prototype.disconnectedCallback; K.prototype.disconnectedCallback=function(...a){cancelAnimationFrame(this.__cp60Frame);clearInterval(this.__cp61Clock);this.__cp61Clock=null;return typeof d==='function'?d.apply(this,a):undefined};
      document.querySelectorAll(TAG).forEach(h=>{h.__cp60NativeMode=false;schedule(h)});
    });
    document.addEventListener('click',e=>{const p=e.composedPath?.()||[];const b=p.find(x=>x?.matches?.('button,a,[role="button"]')&&norm(x.textContent)==='seguranca');if(b){const h=window.__cp60Host; if(h){h.__cp60NativeMode=false;h.__cp60View=localStorage.getItem(VIEW_KEY)||'overview';[20,100,300,700].forEach(ms=>setTimeout(()=>schedule(h),ms));}}},true);
    window.addEventListener('resize',()=>window.__cp60Host&&schedule(window.__cp60Host));
    const mo=new MutationObserver(()=>{const h=window.__cp60Host||document.querySelector(TAG);if(h&&h.isConnected&&getComputedStyle(h).display!=='none')schedule(h)});mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden']});window.__cp60Observer=mo;
  }
  install();
})();
/* CP_SECURITY_V0610_RUNTIME_END */
