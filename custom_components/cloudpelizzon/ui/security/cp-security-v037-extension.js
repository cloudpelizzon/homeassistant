/*
 * CloudPelizzon Segurança
 * CP-SECURITY 0.3.7
 */
(async () => {
  const TAG = "cloudpelizzon-security-panel";
  await customElements.whenDefined(TAG);

  const Klass = customElements.get(TAG);
  if (!Klass || Klass.prototype.__cpV037Installed) return;

  const p = Klass.prototype;
  p.__cpV037Installed = true;

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

  function ensure037(host) {
    const c = host._config || (host._config = {});
    c.moradores ??= [];
    c.presenca ??= {};
    c.armamento_por_horario ??= {};
    c.notificacoes ??= {};
    c.notificacoes.destinatarios_por_evento ??= {};

    c.armamento_por_horario.horario_armar ??= "23:00";
    c.armamento_por_horario.horario_desarmar ??= "06:10";
    c.armamento_por_horario.dias_semana ??= [1,2,3,4,5,6,0];

    c.armamento_por_horario.feriado ??= {};
    c.armamento_por_horario.feriado.horario_liberacao ??= "10:00";
    c.armamento_por_horario.feriado.aplicar_feriados ??= true;
    c.armamento_por_horario.feriado.aplicar_finais_semana ??= true;
    c.armamento_por_horario.feriado.aplicar_dias_nao_uteis ??= true;
    c.armamento_por_horario.feriado.ignorar_modo_visita ??= true;
    c.armamento_por_horario.feriado.datas_excecao ??= [];
  }

  function entityByPersonRecord(host, person) {
    const states = Object.entries(host._hass?.states || {})
      .filter(([id]) => id.startsWith("person."));

    let match = states.find(([, st]) =>
      st?.attributes?.id
      && String(st.attributes.id) === String(person.id)
    );
    if (match) return match[0];

    match = states.find(([, st]) =>
      st?.attributes?.user_id
      && person.user_id
      && String(st.attributes.user_id) === String(person.user_id)
    );
    if (match) return match[0];

    match = states.find(([, st]) =>
      norm(st?.attributes?.friendly_name) === norm(person.name)
    );
    if (match) return match[0];

    return "";
  }

  function notifyServices(host) {
    return Object.keys(host._hass?.services?.notify || {})
      .filter(name => name.startsWith("mobile_app_"))
      .map(name => `notify.${name}`)
      .sort((a,b) => a.localeCompare(b, "pt-BR"));
  }

  function findNotifyForResident(host, resident) {
    const services = notifyServices(host);
    const current = String(resident.servico_celular || "");
    if (services.includes(current)) return current;

    const tokens = norm(resident.nome)
      .split(" ")
      .filter(x => x.length >= 3);

    let best = "";
    let score = 0;

    for (const service of services) {
      const text = norm(service);
      const s = tokens.reduce(
        (sum, token) => sum + (text.includes(token) ? 2 : 0),
        0
      );
      if (s > score) {
        best = service;
        score = s;
      }
    }

    return score >= 2 ? best : "";
  }

  function trackerFromPerson(host, person) {
    for (const entityId of arr(person.device_trackers)) {
      if (host._hass?.states?.[entityId]) return entityId;
    }
    return "";
  }

  async function fetchHousehold(host) {
    const [usersResponse, personsResponse] = await Promise.all([
      host._hass.callWS({ type: "config/auth/list" }),
      host._hass.callWS({ type: "person/list" }),
    ]);

    const usersRaw =
      Array.isArray(usersResponse)
        ? usersResponse
        : Array.isArray(usersResponse?.users)
          ? usersResponse.users
          : [];

    const personsRaw =
      Array.isArray(personsResponse)
        ? personsResponse
        : Array.isArray(personsResponse?.persons)
          ? personsResponse.persons
          : [];

    const activeUsers = usersRaw
      .filter(u => u && u.is_active !== false && u.system_generated !== true);

    const activeIds = new Set(activeUsers.map(u => String(u.id)));

    const residents = personsRaw
      .filter(person => person?.user_id)
      .filter(person => activeIds.has(String(person.user_id)))
      .map(person => {
        const user = activeUsers.find(
          u => String(u.id) === String(person.user_id)
        );
        return {
          person,
          user,
          nome: person.name || user?.name || "Morador",
        };
      });

    return { activeUsers, persons: personsRaw, residents };
  }

  function residentKey(r, index = 0) {
    return String(
      r?.usuario_id
      || r?.entidade_pessoa
      || r?.id
      || `morador_${index}`
    );
  }

  async function syncResidents(host, { render = true } = {}) {
    ensure037(host);
    host._cpV037SyncingResidents = true;
    host._cpV037ResidentsError = "";

    try {
      const data = await fetchHousehold(host);
      const previous = arr(host._config.moradores);
      const result = [];

      for (const item of data.residents) {
        const personEntity = entityByPersonRecord(host, item.person);
        const old = previous.find(r =>
          String(r.usuario_id || "") === String(item.person.user_id)
          || (personEntity && r.entidade_pessoa === personEntity)
          || norm(r.nome) === norm(item.nome)
        ) || {};

        const resident = {
          ...old,
          id:
            old.id
            || `user_${String(item.person.user_id).replace(/[^a-z0-9]+/gi, "_")}`,
          usuario_id: item.person.user_id,
          person_id: item.person.id,
          nome: item.nome,
          nome_voz: old.nome_voz || item.nome,
          entidade_pessoa: personEntity || old.entidade_pessoa || "",
          entidade_wifi: old.entidade_wifi || trackerFromPerson(host, item.person),
          servico_celular: old.servico_celular || "",
          habilitado: old.habilitado ?? true,
          participa_seguranca: old.participa_seguranca ?? true,
          desarmar_automaticamente: old.desarmar_automaticamente ?? true,
          participa_ausencia: old.participa_ausencia ?? true,
          receber_notificacoes: old.receber_notificacoes ?? true,
          boas_vindas: old.boas_vindas ?? true,
        };

        if (!resident.servico_celular) {
          resident.servico_celular = findNotifyForResident(host, resident);
        }

        result.push(resident);
      }

      host._config.moradores = result;
      host._cpV037Household = data;
      host._dirty = true;

      for (const [eventKey] of EVENTOS) {
        if (!Array.isArray(
          host._config.notificacoes.destinatarios_por_evento[eventKey]
        )) {
          host._config.notificacoes.destinatarios_por_evento[eventKey] =
            result.map((r, i) => residentKey(r, i));
        }
      }

      if (typeof host.toast === "function") {
        host.toast(
          `${data.activeUsers.length} usuários ativos, `
          + `${data.residents.length} pessoas vinculadas e `
          + `${result.length} moradores sincronizados.`
        );
      }

      if (render) host.render();
      return data;
    } catch (error) {
      console.warn("CP-SECURITY 0.3.7: erro na sincronização.", error);
      host._cpV037ResidentsError = error?.message || String(error);
      if (typeof host.toast === "function") {
        host.toast("Falha ao sincronizar moradores: " + host._cpV037ResidentsError);
      }
      if (render) host.render();
      return null;
    } finally {
      host._cpV037SyncingResidents = false;
    }
  }

  const previousAutodetect = p.autodetectar;
  p.autodetectar = async function(...args) {
    if (previousAutodetect) {
      await previousAutodetect.apply(this, args);
    }
    await syncResidents(this, { render: false });
    this._dirty = true;
    this.render();
  };

  function injectStyle(root) {
    if (root.querySelector("#cp-v037-style")) return;

    const style = document.createElement("style");
    style.id = "cp-v037-style";
    style.textContent = `
      .cp-v037-source {
        margin:0 0 18px;
        padding:14px 16px;
        border:1px solid #19546d;
        border-radius:14px;
        background:#061c27;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
      }
      .cp-v037-source b {display:block;color:#f2fbff;margin-bottom:4px}
      .cp-v037-source span,.cp-v037-source small {
        color:#b9d6e5!important;display:block
      }
      .cp-v037-source small {margin-top:5px;font-size:10px;line-height:1.45}
      .cp-v037-help {
        display:block;margin:7px 0 0;color:#8ec5dc!important;
        font-size:10px!important;line-height:1.45;font-weight:500!important
      }
      .cp-v037-time-panel,.cp-v037-holiday-panel {
        margin-top:12px;padding:14px;border:1px solid #19506a;
        border-radius:12px;background:#041821
      }
      .cp-v037-time-panel h4,.cp-v037-holiday-panel h4 {
        color:#eefaff;margin:0 0 5px;font-size:13px
      }
      .cp-v037-time-panel>p,.cp-v037-holiday-panel>p {
        color:#9fc6d8!important;margin:0 0 12px;font-size:11px;line-height:1.5
      }
      .cp-v037-grid {
        display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px 12px
      }
      .cp-v037-grid label {
        display:grid;gap:6px;color:#d9eef7!important;
        font-size:11px;font-weight:800
      }
      .cp-v037-grid input,.cp-v037-grid select,
      .cp-v037-grid textarea,.cp-v037-mobile-select {
        width:100%;min-height:38px;border:1px solid #176079;
        border-radius:9px;background:#061e29;color:#eefaff;
        padding:8px 10px;font:inherit
      }
      .cp-v037-grid textarea {min-height:86px;resize:vertical}
      .cp-v037-checkboxes {
        display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;margin-top:12px
      }
      .cp-v037-check {
        display:flex!important;align-items:center!important;gap:9px!important;
        padding:9px 11px!important;border:1px solid #123f55!important;
        border-radius:9px!important;background:#061b25!important;
        color:#d8edf7!important
      }
      .cp-v037-check input {width:auto!important;min-height:0!important}
      .cp-v037-matrix-scroll {overflow:auto}
      .cp-v037-matrix {width:100%;border-collapse:collapse;min-width:760px}
      .cp-v037-matrix th,.cp-v037-matrix td {
        padding:10px;border-bottom:1px solid #16445a;text-align:center
      }
      .cp-v037-matrix th:first-child,.cp-v037-matrix td:first-child {
        text-align:left;position:sticky;left:0;background:#061c27;z-index:2
      }
      .cp-v037-matrix th {color:#eaf8ff}
      .cp-v037-matrix th small {
        display:block;font-weight:400;color:#87afc3!important;
        margin-top:4px;max-width:160px;overflow:hidden;text-overflow:ellipsis
      }
      .cp-v037-all {font-weight:900;color:#42d3ff!important}
      .cp-v037-mobile-warning {color:#ffcc78!important}
      @media(max-width:850px){
        .cp-v037-source{align-items:stretch;flex-direction:column}
        .cp-v037-grid,.cp-v037-checkboxes{grid-template-columns:1fr}
      }
    `;
    root.appendChild(style);
  }

  function enhanceResidents(host, root) {
    const text = norm(root.textContent);
    if (!text.includes("moradores")) return;
    if (!text.includes("cadastre quem participa")) return;

    root.querySelector(".cp-user-source")?.remove();

    let box = root.querySelector(".cp-v037-source");
    if (!box) {
      box = document.createElement("section");
      box.className = "cp-v037-source";
      const anchor = root.querySelector(".cp-v035-inventory, .config-card");
      anchor?.parentElement?.insertBefore(box, anchor);
    }

    const hh = host._cpV037Household;
    const active = hh?.activeUsers?.length ?? "?";
    const linked = hh?.residents?.length ?? host._config.moradores.length;

    box.innerHTML = `
      <div>
        <b>Fonte de moradores</b>
        <span>
          ${host._cpV037SyncingResidents
            ? "Sincronizando cadastro..."
            : `${active} usuários ativos • ${linked} pessoas vinculadas • ${host._config.moradores.length} moradores no CP-SECURITY`}
        </span>
        <small>
          O módulo considera morador somente quem está cadastrado em Pessoas
          e vinculado a um usuário ativo do Home Assistant.
        </small>
      </div>
      <button class="secondary small" data-cp-v037-sync-users>
        Sincronizar moradores
      </button>
    `;

    box.querySelector("[data-cp-v037-sync-users]")?.addEventListener("click", () => {
      syncResidents(host);
    });

    root.querySelectorAll(".cp-v035-inventory span").forEach(span => {
      const t = span.textContent || "";
      if (/moradores/i.test(t)) {
        span.textContent = t.replace(
          /\d+\s+moradores?/i,
          `${host._config.moradores.length} moradores`
        );
      }
    });

    const cards = [...root.querySelectorAll(".config-card")]
      .filter(card =>
        norm(card.textContent).includes("servico de notificacao do celular")
      );

    const services = notifyServices(host);

    cards.forEach((card, index) => {
      const resident = host._config.moradores[index];
      if (!resident) return;

      const candidates = [...card.querySelectorAll("input")];
      const input = candidates.find(i =>
        norm(i.parentElement?.textContent)
          .includes("servico de notificacao do celular")
      );

      if (!input || input.dataset.cpV037Replaced) return;

      const select = document.createElement("select");
      select.className = "cp-v037-mobile-select";
      select.innerHTML = [
        `<option value="">Nenhum celular vinculado</option>`,
        ...services.map(service =>
          `<option value="${esc(service)}" ${resident.servico_celular === service ? "selected" : ""}>${esc(service)}</option>`
        )
      ].join("");

      input.replaceWith(select);

      const help = document.createElement("small");
      help.className = "cp-v037-help";
      help.textContent =
        services.length
          ? "Selecione o notify.mobile_app deste morador."
          : "Nenhum serviço notify.mobile_app foi encontrado.";
      select.insertAdjacentElement("afterend", help);

      select.addEventListener("change", () => {
        resident.servico_celular = select.value;
        host._dirty = true;
        host.render();
      });
    });
  }

  function addPresenceHelp(host, root) {
    const text = norm(root.textContent);
    if (!text.includes("presenca e localizacao")) return;

    const candidates = [...root.querySelectorAll("label, div")];

    const items = [
      {
        phrase: "confirmar ausencia apos",
        message: value => {
          const v = Number(value || 0);
          return `Unidade: segundos. ${v} segundos = ${(v/60).toFixed(v % 60 ? 1 : 0)} minuto(s).`;
        },
      },
      {
        phrase: "confirmar chegada apos",
        message: value => {
          const v = Number(value || 0);
          return v === 0
            ? "Unidade: segundos. 0 = confirmação imediata de chegada."
            : `Unidade: segundos. ${v} segundos = ${(v/60).toFixed(v % 60 ? 1 : 0)} minuto(s).`;
        },
      },
      {
        phrase: "intervalo de atualizacao",
        message: value =>
          `Unidade: minutos. Solicita nova atualização a cada ${Number(value || 0)} minuto(s), quando habilitado.`,
      },
    ];

    for (const item of items) {
      const holder = candidates.find(el =>
        norm(el.textContent).includes(item.phrase)
        && el.querySelector?.("input")
      );

      const input = holder?.querySelector("input");
      if (!holder || !input || holder.querySelector(".cp-v037-help")) continue;

      const help = document.createElement("small");
      help.className = "cp-v037-help";
      help.textContent = item.message(input.value);
      holder.appendChild(help);

      input.addEventListener("input", () => {
        help.textContent = item.message(input.value);
      });
    }
  }

  function addSchedulePanels(host, root) {
    const text = norm(root.textContent);
    if (!text.includes("central de alarme") || !text.includes("regras por horario")) {
      return;
    }

    ensure037(host);

    const card = [...root.querySelectorAll(".config-card")]
      .find(x => norm(x.textContent).includes("regras por horario"));
    if (!card) return;

    const cfg = host._config.armamento_por_horario;
    const fer = cfg.feriado;

    const checkboxNear = phrase => {
      const nodes = [...card.querySelectorAll("label,div")];
      for (const node of nodes) {
        if (!norm(node.textContent).includes(phrase)) continue;
        const cb = node.querySelector?.('input[type="checkbox"]');
        if (cb) return cb;
      }
      return null;
    };

    const allowToggle = checkboxNear("permitir regras de horario");
    const holidayToggle = checkboxNear("protecao especial em feriados");

    let schedulePanel = card.querySelector(".cp-v037-time-panel");
    if (!schedulePanel) {
      schedulePanel = document.createElement("section");
      schedulePanel.className = "cp-v037-time-panel";
      card.appendChild(schedulePanel);
    }

    let holidayPanel = card.querySelector(".cp-v037-holiday-panel");
    if (!holidayPanel) {
      holidayPanel = document.createElement("section");
      holidayPanel.className = "cp-v037-holiday-panel";
      card.appendChild(holidayPanel);
    }

    const days = [
      [1,"Seg"],[2,"Ter"],[3,"Qua"],[4,"Qui"],[5,"Sex"],[6,"Sáb"],[0,"Dom"]
    ];

    schedulePanel.hidden = !cfg.habilitado;
    schedulePanel.innerHTML = `
      <h4>Horários automáticos</h4>
      <p>
        Estes campos ficam ativos somente enquanto “Permitir regras de horário”
        estiver habilitado. Presença, Wi-Fi e controles físicos continuam funcionando.
      </p>

      <div class="cp-v037-grid">
        <label>Horário padrão para armar
          <input type="time" data-cp-v037-schedule="horario_armar" value="${esc(cfg.horario_armar)}">
        </label>
        <label>Horário padrão para desarmar
          <input type="time" data-cp-v037-schedule="horario_desarmar" value="${esc(cfg.horario_desarmar)}">
        </label>
      </div>

      <div class="cp-v037-checkboxes">
        ${days.map(([value,label]) => `
          <label class="cp-v037-check">
            <input type="checkbox" data-cp-v037-day="${value}" ${arr(cfg.dias_semana).includes(value) ? "checked" : ""}>
            ${label}
          </label>
        `).join("")}
      </div>
    `;

    holidayPanel.hidden = !cfg.protecao_feriado;
    holidayPanel.innerHTML = `
      <h4>Proteção especial em feriados</h4>
      <p>
        Define até que horário a proteção especial permanece ativa e quais exceções
        devem ser ignoradas.
      </p>

      <div class="cp-v037-grid">
        <label>Manter proteção até
          <input type="time" data-cp-v037-holiday="horario_liberacao" value="${esc(fer.horario_liberacao)}">
          <small class="cp-v037-help">Ex.: 10:00 mantém a proteção até 10 horas.</small>
        </label>

        <label>Datas de exceção
          <textarea data-cp-v037-holiday-dates placeholder="AAAA-MM-DD, uma por linha">${esc(arr(fer.datas_excecao).join("\n"))}</textarea>
          <small class="cp-v037-help">Nestas datas a regra especial não será aplicada.</small>
        </label>
      </div>

      <div class="cp-v037-checkboxes">
        ${[
          ["aplicar_feriados","Aplicar em feriados"],
          ["aplicar_finais_semana","Aplicar em sábados e domingos"],
          ["aplicar_dias_nao_uteis","Aplicar em dias não úteis"],
          ["ignorar_modo_visita","Ignorar regra quando Modo Visita estiver ativo"],
        ].map(([key,label]) => `
          <label class="cp-v037-check">
            <input type="checkbox" data-cp-v037-holiday-bool="${key}" ${fer[key] ? "checked" : ""}>
            ${label}
          </label>
        `).join("")}
      </div>
    `;

    if (allowToggle && !allowToggle.dataset.cpV037Bound) {
      allowToggle.dataset.cpV037Bound = "1";
      allowToggle.addEventListener("change", () => {
        cfg.habilitado = allowToggle.checked;
        host._dirty = true;
        host.render();
      });
    }

    if (holidayToggle && !holidayToggle.dataset.cpV037Bound) {
      holidayToggle.dataset.cpV037Bound = "1";
      holidayToggle.addEventListener("change", () => {
        cfg.protecao_feriado = holidayToggle.checked;
        host._dirty = true;
        host.render();
      });
    }

    schedulePanel.querySelectorAll("[data-cp-v037-schedule]").forEach(input => {
      input.addEventListener("change", () => {
        cfg[input.dataset.cpV037Schedule] = input.value;
        host._dirty = true;
      });
    });

    schedulePanel.querySelectorAll("[data-cp-v037-day]").forEach(input => {
      input.addEventListener("change", () => {
        const value = Number(input.dataset.cpV037Day);
        const set = new Set(arr(cfg.dias_semana).map(Number));
        input.checked ? set.add(value) : set.delete(value);
        cfg.dias_semana = [...set].sort((a,b) => a-b);
        host._dirty = true;
      });
    });

    holidayPanel.querySelectorAll("[data-cp-v037-holiday]").forEach(input => {
      input.addEventListener("change", () => {
        fer[input.dataset.cpV037Holiday] = input.value;
        host._dirty = true;
      });
    });

    holidayPanel.querySelectorAll("[data-cp-v037-holiday-bool]").forEach(input => {
      input.addEventListener("change", () => {
        fer[input.dataset.cpV037HolidayBool] = input.checked;
        host._dirty = true;
      });
    });

    holidayPanel.querySelector("[data-cp-v037-holiday-dates]")?.addEventListener("change", e => {
      fer.datas_excecao = e.target.value
        .split(/\r?\n/)
        .map(x => x.trim())
        .filter(Boolean);
      host._dirty = true;
    });
  }

  function renderNotificationMatrix(host, root) {
    const text = norm(root.textContent);
    if (!text.includes("politica por evento")) return;

    ensure037(host);

    const panel = root.querySelector(".cp-recipient-matrix");
    if (!panel) return;

    const residents = arr(host._config.moradores).map((r, i) => ({
      ...r,
      _key: residentKey(r, i),
    }));

    panel.innerHTML = `
      <div class="cp-section-title">
        <div>
          <h3>Destinatários móveis por evento</h3>
          <p>
            Selecione individualmente os moradores ou use <b>TODAS</b>.
            A configuração pode ser preparada mesmo antes do vínculo do celular.
          </p>
        </div>
      </div>

      ${residents.length ? `
        <div class="cp-v037-matrix-scroll">
          <table class="cp-v037-matrix">
            <thead>
              <tr>
                <th>Evento</th>
                <th class="cp-v037-all">TODAS</th>
                ${residents.map(r => `
                  <th>
                    ${esc(r.nome || "Morador")}
                    <small class="${r.servico_celular ? "" : "cp-v037-mobile-warning"}">
                      ${r.servico_celular ? esc(r.servico_celular) : "celular ainda não vinculado"}
                    </small>
                  </th>
                `).join("")}
              </tr>
            </thead>
            <tbody>
              ${EVENTOS.map(([key,label]) => {
                const selected = new Set(
                  arr(host._config.notificacoes.destinatarios_por_evento[key])
                );
                const allSelected =
                  residents.length > 0
                  && residents.every(r => selected.has(r._key));

                return `
                  <tr>
                    <td><b>${esc(label)}</b></td>
                    <td>
                      <input type="checkbox"
                        data-cp-v037-all="${esc(key)}"
                        ${allSelected ? "checked" : ""}>
                    </td>
                    ${residents.map(r => `
                      <td>
                        <input type="checkbox"
                          data-cp-v037-event="${esc(key)}"
                          data-cp-v037-resident="${esc(r._key)}"
                          ${selected.has(r._key) ? "checked" : ""}>
                      </td>
                    `).join("")}
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="cp-empty">Nenhum morador sincronizado.</div>`}
    `;

    panel.querySelectorAll("[data-cp-v037-event]").forEach(input => {
      input.addEventListener("change", () => {
        const event = input.dataset.cpV037Event;
        const key = input.dataset.cpV037Resident;
        const set = new Set(
          arr(host._config.notificacoes.destinatarios_por_evento[event])
        );
        input.checked ? set.add(key) : set.delete(key);
        host._config.notificacoes.destinatarios_por_evento[event] = [...set];
        host._dirty = true;
      });
    });

    panel.querySelectorAll("[data-cp-v037-all]").forEach(input => {
      input.addEventListener("change", () => {
        const event = input.dataset.cpV037All;
        host._config.notificacoes.destinatarios_por_evento[event] =
          input.checked ? residents.map(r => r._key) : [];
        host._dirty = true;
        host.render();
      });
    });
  }

  async function initialHousehold(host) {
    if (host._cpV037HouseholdLoading || host._cpV037Household) return;

    host._cpV037HouseholdLoading = true;
    try {
      host._cpV037Household = await fetchHousehold(host);

      if (
        host._cpV037Household
        && host._cpV037Household.residents.length !== host._config.moradores.length
      ) {
        await syncResidents(host, { render: false });
      }

      host.render();
    } catch (error) {
      host._cpV037ResidentsError = error?.message || String(error);
    } finally {
      host._cpV037HouseholdLoading = false;
    }
  }

  function enhance(host) {
    if (!host.shadowRoot || !host._config || !host._hass) return;
    ensure037(host);
    injectStyle(host.shadowRoot);
    enhanceResidents(host, host.shadowRoot);
    addPresenceHelp(host, host.shadowRoot);
    addSchedulePanels(host, host.shadowRoot);
    renderNotificationMatrix(host, host.shadowRoot);

    const t = norm(host.shadowRoot.textContent);
    if (
      t.includes("moradores")
      && t.includes("cadastre quem participa")
      && !host._cpV037Household
      && !host._cpV037HouseholdLoading
    ) {
      initialHousehold(host);
    }
  }

  const originalRender = p.render;
  p.render = function(...args) {
    const result = originalRender.apply(this, args);
    queueMicrotask(() => enhance(this));
    return result;
  };

  document.querySelectorAll(TAG).forEach(el => {
    queueMicrotask(() => {
      ensure037(el);
      el.render();
    });
  });

  console.info("CP-SECURITY 0.3.7 carregado.");
})();
