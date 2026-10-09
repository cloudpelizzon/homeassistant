"""CloudPelizzon CP-SECURITY native rule engine.

This component intentionally does not create Home Assistant automation entities.
Rules are executed by listeners owned by the CloudPelizzon integration and persisted
in Home Assistant's storage registry.
"""
from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import datetime
import logging
from typing import Any

import probatio

from homeassistant.components import websocket_api
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, EVENT_STATE_CHANGED
from homeassistant.core import HomeAssistant, Event, callback
from homeassistant.helpers.event import async_call_later, async_track_time_change
from homeassistant.helpers.storage import Store

DOMAIN = "cloudpelizzon_security_engine"
STORAGE_KEY = "cloudpelizzon_security_engines"
STORAGE_VERSION = 1
_LOGGER = logging.getLogger(__name__)


def f(key,label,type_="text",help_="",min_=None,max_=None):
    d={"key":key,"label":label,"type":type_,"help":help_}
    if min_ is not None:d["min"]=min_
    if max_ is not None:d["max"]=max_
    return d

CATALOG = {
 "CAS-001": {"name":"Baterias baixas dos sensores","category":"Baterias","description":"Verificação semanal de baterias com faixas crítica e atenção.","default_enabled":True,"fields":[f("critical_pct","Crítico abaixo de (%)","number","Dispara alerta crítico abaixo deste percentual.",1,50),f("attention_pct","Atenção abaixo de (%)","number","Faixa de atenção.",1,80),f("weekday","Dia da semana","text","mon,tue,wed,thu,fri,sat,sun"),f("time","Horário","text","HH:MM")],"config":{"critical_pct":10,"attention_pct":20,"weekday":"mon","time":"09:30"}},
 "CAS-002": {"name":"Modo Casa por moradores","category":"Presença","description":"Define Casa/Ausente conforme presença do grupo de moradores.","default_enabled":True,"fields":[f("group","Grupo de moradores","text"),f("away_delay","Confirmação de ausência (s)","number","Tempo antes de mudar para Ausente.",0,3600),f("mode_entity","Entidade modo da casa","text"),f("visit_entity","Modo visitantes","text")],"config":{"group":"group.moradores","away_delay":300,"mode_entity":"input_select.modo_casa","visit_entity":"input_boolean.modo_visita"}},
 "SEG-001": {"name":"Abrir Portão","category":"Perímetro","description":"Motor manual de abertura do portão.","default_enabled":False,"mode":"manual","fields":[f("gate","Portão","text")],"config":{"gate":"cover.portao_da_garagem_door"}},
 "SEG-002": {"name":"Conquistas Segurança - Dias Sem Falhas","category":"Segurança","description":"Registra conquistas de 7, 15 e 30 dias sem falha crítica.","default_enabled":True,"fields":[f("last_problem","Último problema","text"),f("run_time","Horário diário","text")],"config":{"last_problem":"input_datetime.seguranca_ultimo_problema","run_time":"13:05"}},
 "SEG-003": {"name":"Registrar falha da cerca","category":"Segurança","description":"Registra falha quando Ausente/Viagem permanece com a cerca desligada.","default_enabled":True,"fields":[f("fence","Cerca elétrica","text"),f("mode_entity","Modo da casa","text"),f("delay","Atraso (s)","number","Tempo desligada antes de registrar falha.",0,7200)],"config":{"fence":"switch.cerca_eletrica_r3_cerca_eletrica","mode_entity":"input_select.modo_casa","delay":1200}},
 "SEG-004": {"name":"Fechar Portão","category":"Perímetro","description":"Motor manual de fechamento do portão.","default_enabled":False,"mode":"manual","fields":[f("gate","Portão","text")],"config":{"gate":"cover.portao_da_garagem_door"}},
 "SEG-005": {"name":"Atualizar localização móvel","category":"Presença","description":"Solicita atualização periódica de localização do aplicativo móvel.","default_enabled":True,"fields":[f("notify_service","Serviço notify","text"),f("interval_minutes","Intervalo (min)","number","Frequência da atualização.",1,240)],"config":{"notify_service":"notify.mobile_app_iphone","interval_minutes":15}},
 "SEG-006": {"name":"Ativar modo Viagem","category":"Segurança","description":"Reforça a proteção ao entrar em Viagem.","default_enabled":True,"fields":[f("mode_entity","Modo da casa","text"),f("fence","Cerca elétrica","text"),f("lights_off","Luzes para desligar","list"),f("switches_off","Switches para desligar","list")],"config":{"mode_entity":"input_select.modo_casa","fence":"switch.cerca_eletrica_r3_cerca_eletrica","lights_off":["light.led_sala_de_estar","light.led_hall_de_entrada","light.luz_escada"],"switches_off":["switch.interruptor_cozinha_interruptor_1","switch.rele_sala_de_jantar_l1"]}},
 "SEG-007": {"name":"Auditoria Noturna","category":"Auditoria","description":"Audita portão, cerca e iluminação no horário configurado.","default_enabled":True,"fields":[f("time","Horário","text"),f("gate","Portão","text"),f("fence","Cerca","text"),f("mode_entity","Modo da casa","text"),f("lights","Luzes auditadas","list")],"config":{"time":"23:30","gate":"cover.portao_da_garagem_door","fence":"switch.cerca_eletrica_r3_cerca_eletrica","mode_entity":"input_select.modo_casa","lights":[]}},
 "SEG-008": {"name":"Cerca elétrica por presença","category":"Perímetro","description":"Controla a cerca pela presença do morador de referência, com confirmação e reconciliação.","default_enabled":True,"fields":[f("person","Pessoa de referência","text"),f("fence","Cerca elétrica","text"),f("away_delay","Ausência confirmada (s)","number","Confirmação antes de ligar a cerca.",0,3600),f("retry_count","Tentativas","number","Tentativas de comando.",1,10),f("verify_minutes","Reconciliação (min)","number","Intervalo de verificação.",1,60)],"config":{"person":"person.alex_pelizzon","fence":"switch.cerca_eletrica_r3_cerca_eletrica","away_delay":300,"retry_count":3,"verify_minutes":2}},
 "SEG-009": {"name":"Luz ligada em modo Viagem","category":"Segurança","description":"Alerta ao detectar luz monitorada ligada em Viagem.","default_enabled":True,"fields":[f("mode_entity","Modo da casa","text"),f("lights","Luzes monitoradas","list")],"config":{"mode_entity":"input_select.modo_casa","lights":["light.luz_banheiro","light.luz_pia_do_banheiro"]}},
 "SEG-010": {"name":"Morador chegou com casa segura","category":"Presença","description":"Retorna o modo Casa quando um morador chega durante Ausente/Viagem.","default_enabled":True,"fields":[f("group","Grupo moradores","text"),f("mode_entity","Modo da casa","text"),f("fence","Cerca elétrica","text"),f("visit_entity","Modo visitantes","text")],"config":{"group":"group.moradores","mode_entity":"input_select.modo_casa","fence":"switch.cerca_eletrica_r3_cerca_eletrica","visit_entity":"input_boolean.modo_visita"}},
 "SEG-011": {"name":"Portão aberto por muito tempo","category":"Perímetro","description":"Alerta se o portão permanecer aberto além do limite.","default_enabled":True,"fields":[f("gate","Portão","text"),f("delay","Tempo aberto (s)","number","Limite antes do alerta.",30,7200)],"config":{"gate":"cover.portao_da_garagem_door","delay":300}},
 "SEG-012": {"name":"Portão abriu com casa vazia","category":"Perímetro","description":"Alerta imediatamente se o portão abrir em modo Ausente.","default_enabled":True,"fields":[f("gate","Portão","text"),f("mode_entity","Modo da casa","text")],"config":{"gate":"cover.portao_da_garagem_door","mode_entity":"input_select.modo_casa"}},
 "SEG-013": {"name":"Verificar casa ao ativar Ausente/Viagem","category":"Segurança","description":"Confirma cerca, portão, alarme e cargas quando a casa entra em modo seguro.","default_enabled":True,"fields":[f("mode_entity","Modo da casa","text"),f("fence","Cerca","text"),f("gate","Portão","text"),f("alarm","Central de alarme","text"),f("delay","Atraso inicial (s)","number","Tempo após mudar de modo.",0,300),f("lights_off","Luzes para desligar","list")],"config":{"mode_entity":"input_select.modo_casa","fence":"switch.cerca_eletrica_r3_cerca_eletrica","gate":"cover.portao_da_garagem_door","alarm":"alarm_control_panel.cloudpelizzon_security","delay":5,"lights_off":[]}},
 "SEG-014": {"name":"Verificar portão ao dormir","category":"Segurança","description":"Alerta se o portão estiver aberto ao entrar em Dormindo.","default_enabled":True,"fields":[f("mode_entity","Modo da casa","text"),f("gate","Portão","text")],"config":{"mode_entity":"input_select.modo_casa","gate":"cover.portao_da_garagem_door"}},
 "ALR-001": {"name":"Central de Alarme Residencial","category":"Alarme","description":"Motor central de armamento, entrada, disparo, tamper e bateria.","default_enabled":True,"fields":[f("alarm","Central de alarme","text"),f("mode_entity","Modo da casa","text"),f("opening_group","Grupo portas/janelas","text"),f("tamper_group","Grupo tamper","text"),f("battery_low_group","Grupo bateria baixa","text"),f("siren","Sirene","text"),f("exit_delay","Saída (s)","number","Tempo antes do armamento.",0,300),f("entry_delay","Entrada (s)","number","Tempo para desarmar.",0,180)],"config":{"alarm":"alarm_control_panel.cloudpelizzon_security","mode_entity":"input_select.modo_casa","opening_group":"group.sensores_alarme_total","tamper_group":"group.sensores_alarme_tamper","battery_low_group":"group.sensores_alarme_bateria_baixa","siren":"siren.0xa4c138273f816b2c","exit_delay":60,"entry_delay":30}},
 "ALR-002": {"name":"Reset mensal de disparos","category":"Alarme","description":"Zera o contador mensal no primeiro dia do mês.","default_enabled":True,"fields":[f("counter","Contador","text"),f("time","Horário","text")],"config":{"counter":"input_number.alarme_residencial_disparos_mes","time":"00:05"}},
 "ALR-003": {"name":"Proteção de feriado até 10h","category":"Alarme","description":"Impede Casa/Desarmado antes das 10h em dias não úteis.","default_enabled":True,"fields":[f("mode_entity","Modo da casa","text"),f("alarm","Central de alarme","text"),f("workday","Sensor dia útil","text"),f("until_hour","Proteção até hora","number","Hora limite.",0,23)],"config":{"mode_entity":"input_select.modo_casa","alarm":"alarm_control_panel.cloudpelizzon_security","workday":"binary_sensor.workday_sensor","until_hour":10}},
 "ALR-004": {"name":"Notificação de mudança do alarme","category":"Alarme","description":"Notifica mudanças finais de Armado, Parcial e Desarmado.","default_enabled":True,"fields":[f("alarm","Central de alarme","text")],"config":{"alarm":"alarm_control_panel.cloudpelizzon_security"}},
 "ALR-005": {"name":"Zerar contador mensal de disparos","category":"Alarme","description":"Segundo reset mensal preservado do legado. Pode permanecer inativo se ALR-002 estiver ativo.","default_enabled":False,"fields":[f("counter","Contador","text"),f("time","Horário","text")],"config":{"counter":"input_number.alarme_residencial_disparos_mes","time":"00:01"}},
 "GAS-005": {"name":"Vazamento de Gás Detectado","category":"Gás","description":"Alerta crítico imediato no celular/Alexa quando o sensor confirma gás.","default_enabled":True,"fields":[f("sensor","Sensor de gás","text"),f("confirm_seconds","Confirmação (s)","number","Tempo em alarme antes do alerta.",0,60)],"config":{"sensor":"binary_sensor.gas_sensor_2_gas","confirm_seconds":2}},
 "GAS-006": {"name":"Vazamento de Gás Persistente","category":"Gás","description":"Reforça alerta se o gás persistir.","default_enabled":True,"fields":[f("sensor","Sensor de gás","text"),f("delay","Persistência (s)","number","Tempo antes do reforço.",30,3600)],"config":{"sensor":"binary_sensor.gas_sensor_2_gas","delay":120}},
 "GAS-007": {"name":"Vazamento Encerrado","category":"Gás","description":"Confirma normalização após o sensor permanecer normal.","default_enabled":True,"fields":[f("sensor","Sensor de gás","text"),f("confirm_seconds","Confirmação normal (s)","number","Tempo em normal antes de encerrar.",1,300)],"config":{"sensor":"binary_sensor.gas_sensor_2_gas","confirm_seconds":15}},
 "GAS-008": {"name":"Sensor de Gás Offline","category":"Gás","description":"Alerta indisponibilidade prolongada do sensor.","default_enabled":True,"fields":[f("sensor","Sensor de gás","text"),f("delay","Offline (s)","number","Tempo indisponível antes do alerta.",30,7200)],"config":{"sensor":"binary_sensor.gas_sensor_2_gas","delay":600}},
 "GAS-009": {"name":"Sensor de Gás Recuperado","category":"Gás","description":"Confirma recuperação estável do sensor.","default_enabled":True,"fields":[f("sensor","Sensor de gás","text"),f("stable_seconds","Estável (s)","number","Tempo estável antes de confirmar.",1,600)],"config":{"sensor":"binary_sensor.gas_sensor_2_gas","stable_seconds":60}},
 "GAS-010": {"name":"Sensor de Gás Travado","category":"Gás","description":"Alerta crítico se o sensor permanecer em alarme por tempo excessivo.","default_enabled":True,"fields":[f("sensor","Sensor de gás","text"),f("delay","Tempo em alarme (s)","number","Limite de alarme contínuo.",300,7200)],"config":{"sensor":"binary_sensor.gas_sensor_2_gas","delay":1800}},
 "GAS-011": {"name":"Check-up Diário do Sensor de Gás","category":"Gás","description":"Executa diagnóstico diário do sensor de gás.","default_enabled":True,"fields":[f("sensor","Sensor de gás","text"),f("time","Horário","text")],"config":{"sensor":"binary_sensor.gas_sensor_2_gas","time":"12:20"}},
}

# Add mode defaults where omitted.
for _v in CATALOG.values(): _v.setdefault("mode","native")


class SecurityEngineManager:
    def __init__(self,hass:HomeAssistant):
        self.hass=hass
        self.store=Store(hass,STORAGE_VERSION,STORAGE_KEY)
        self.data={"engines":{},"events":[],"global":{"version":"0.6.1","execution":"native","automation_dependency":False,"script_dependency":False}}
        self._unsub=[]
        self._delayed={}
        self.started=False
        for code, meta in CATALOG.items():
            self.data["engines"][code] = {"enabled":False,"config":deepcopy(meta["config"]),"last_run":None,"last_result":"","runs":0}

    async def async_start(self):
        if self.started:
            return
        self.started=True
        saved=await self.store.async_load() or {}
        self.data["events"]=list(saved.get("events",[]))[-100:]
        self.data["global"].update(saved.get("global",{}))
        self.data["global"].update({"version":"0.6.1","execution":"native","automation_dependency":False,"script_dependency":False,"embedded":True})
        stored=saved.get("engines",{})
        for code,meta in CATALOG.items():
            ent=stored.get(code,{})
            self.data["engines"][code]={
                "enabled":bool(ent.get("enabled",False)), # safe first install: migrate explicitly
                "config":{**deepcopy(meta["config"]),**(ent.get("config") or {})},
                "last_run":ent.get("last_run"),"last_result":ent.get("last_result",""),"runs":int(ent.get("runs",0)),
            }
        await self._save()
        self._unsub.append(self.hass.bus.async_listen(EVENT_STATE_CHANGED,self._state_event))
        self._unsub.append(async_track_time_change(self.hass,self._minute_tick,second=0))
        await self._log("CORE","Motor nativo iniciado","28 motores internos carregados; execução depende do estado Ativo de cada motor.")

    async def async_stop(self):
        for u in self._unsub:
            try:u()
            except Exception:pass
        for u in list(self._delayed.values()):
            try:u()
            except Exception:pass
        self._unsub.clear();self._delayed.clear()

    def public(self):
        rows=[]
        for code,meta in CATALOG.items():
            st=self.data["engines"][code]
            rows.append({"code":code,"name":meta["name"],"category":meta["category"],"description":meta["description"],"mode":meta.get("mode","native"),"enabled":st["enabled"],"config":deepcopy(st["config"]),"fields":deepcopy(meta.get("fields",[])),"last_run":st.get("last_run"),"last_result":st.get("last_result",""),"runs":st.get("runs",0)})
        return {"version":"0.6.1","engines":rows,"global":deepcopy(self.data["global"]),"events":list(self.data["events"])[-30:]}

    async def update(self,code,enabled=None,config=None):
        if code not in CATALOG: raise ValueError("Motor desconhecido")
        st=self.data["engines"][code]
        if enabled is not None: st["enabled"]=bool(enabled)
        if isinstance(config,dict): st["config"].update(config)
        await self._save()
        await self._log(code,"Configuração atualizada",f"Motor {'ativo' if st['enabled'] else 'inativo'}")
        return self.public()


    async def _save(self): await self.store.async_save(self.data)
    def enabled(self,code): return bool(self.data["engines"].get(code,{}).get("enabled"))
    def cfg(self,code): return self.data["engines"][code]["config"]
    def state(self,eid,default="unknown"):
        if not eid:return default
        st=self.hass.states.get(eid); return st.state if st else default
    def is_state(self,eid,val): return self.state(eid)==val
    async def service(self,domain,service,data=None):
        try: await self.hass.services.async_call(domain,service,data or {},blocking=False); return True
        except Exception as exc: _LOGGER.warning("CP-SECURITY service %s.%s failed: %s",domain,service,exc); return False
    async def service_entity(self,eid,service):
        if not eid or "." not in eid:return False
        return await self.service(eid.split(".",1)[0],service,{"entity_id":eid})
    async def set_mode(self,eid,option): return await self.service("input_select","select_option",{"entity_id":eid,"option":option})

    async def notify(self,title,message,critical=False,alexa=True):
        services=self.hass.services.async_services().get("notify",{})
        mobile=[n for n in services if "mobile_app" in n]
        for svc in mobile:
            data={"title":title,"message":message}
            if critical:data["data"]={"push":{"interruption-level":"critical","sound":{"name":"default","critical":1,"volume":1}},"ttl":0,"priority":"high"}
            await self.service("notify",svc,data)
        if alexa and "alexa_media" in services:
            targets=[]
            for st in self.hass.states.async_all("media_player"):
                hay=f"{st.entity_id} {st.attributes.get('friendly_name','')}".lower()
                if "echo" in hay or "alexa" in hay: targets.append(st.entity_id)
            if targets:
                await self.service("notify","alexa_media",{"target":targets,"message":message,"data":{"type":"announce","method":"all"}})

    async def _log(self,code,title,result):
        event={"time":datetime.now().isoformat(),"code":code,"title":title,"result":str(result)}
        self.data["events"]=(self.data.get("events",[])+[event])[-100:]
        if code in self.data["engines"]:
            st=self.data["engines"][code];st["last_run"]=event["time"];st["last_result"]=str(result)[:220];st["runs"]=int(st.get("runs",0))+1
        await self._save()
        self.hass.bus.async_fire("cloudpelizzon_security_engine_event",event)

    def schedule(self,key,seconds,coro_factory):
        old=self._delayed.pop(key,None)
        if old:
            try:old()
            except Exception:pass
        @callback
        def fire(_now):
            self._delayed.pop(key,None)
            self.hass.async_create_task(coro_factory())
        self._delayed[key]=async_call_later(self.hass,max(0,float(seconds)),fire)
    def cancel(self,key):
        old=self._delayed.pop(key,None)
        if old:
            try:old()
            except Exception:pass

    @callback
    def _state_event(self,event:Event):
        eid=event.data.get("entity_id"); old=event.data.get("old_state"); new=event.data.get("new_state")
        if not eid or not new:return
        self.hass.async_create_task(self._handle_state(eid,old.state if old else None,new.state))

    async def _handle_state(self,eid,old,new):
        # CAS-002 presence
        if self.enabled("CAS-002"):
            c=self.cfg("CAS-002")
            if eid==c["group"]:
                if new=="home":
                    self.cancel("CAS-002-away")
                    if self.state(c["mode_entity"]) not in ["Viagem"] and self.state(c["visit_entity"])!="on":
                        await self.set_mode(c["mode_entity"],"Casa"); await self._log("CAS-002","Morador em casa","Modo Casa solicitado")
                elif new=="not_home" and self.state(c["mode_entity"])!="Viagem" and self.state(c["visit_entity"])!="on":
                    async def _away():
                        if self.state(c["group"])=="not_home": await self.set_mode(c["mode_entity"],"Ausente"); await self._log("CAS-002","Casa vazia","Modo Ausente solicitado")
                    self.schedule("CAS-002-away",c["away_delay"],_away)
        # SEG-003 fence off too long
        if self.enabled("SEG-003"):
            c=self.cfg("SEG-003")
            if eid in [c["fence"],c["mode_entity"]]:
                if self.state(c["fence"])=="off" and self.state(c["mode_entity"]) in ["Ausente","Viagem"]:
                    async def _fence_problem():
                        if self.state(c["fence"])=="off" and self.state(c["mode_entity"]) in ["Ausente","Viagem"]:
                            await self.notify("🛡️ Falha Segurança","A casa permaneceu em modo seguro com a cerca elétrica desligada.",False,True); await self._log("SEG-003","Cerca desligada","Falha registrada após atraso")
                    self.schedule("SEG-003",c["delay"],_fence_problem)
                else:self.cancel("SEG-003")
        # SEG-008 Alex / fence
        if self.enabled("SEG-008"):
            c=self.cfg("SEG-008")
            if eid==c["person"]:
                if new=="home": self.cancel("SEG-008-away"); await self._ensure_fence("SEG-008",False)
                elif new not in ["unknown","unavailable","none",""]:
                    async def _away_fence():
                        if self.state(c["person"])!="home": await self._ensure_fence("SEG-008",True)
                    self.schedule("SEG-008-away",c["away_delay"],_away_fence)
        # SEG-009 bathroom lights
        if self.enabled("SEG-009"):
            c=self.cfg("SEG-009")
            if eid in c["lights"] and new=="on" and self.state(c["mode_entity"])=="Viagem": await self.notify("⚠️ Segurança","Uma luz monitorada foi ligada com a casa em modo Viagem.",False,True); await self._log("SEG-009","Luz em Viagem",eid)
        # SEG-010 resident returned
        if self.enabled("SEG-010"):
            c=self.cfg("SEG-010")
            if eid==c["group"] and new=="home" and self.state(c["mode_entity"]) in ["Ausente","Viagem"] and self.state(c["visit_entity"])!="on":
                await self.set_mode(c["mode_entity"],"Casa"); await self.service_entity(c["fence"],"turn_off"); await self.notify("🏠 Bem-vindo","Um morador chegou e a casa voltou para o modo Casa.",False,True); await self._log("SEG-010","Morador chegou","Modo Casa + cerca desligada")
        # SEG-011 gate duration
        if self.enabled("SEG-011"):
            c=self.cfg("SEG-011")
            if eid==c["gate"]:
                if new in ["open","opening"]:
                    async def _gate_long():
                        if self.state(c["gate"]) in ["open","opening"]: await self.notify("⚠️ Portão aberto","O portão permanece aberto além do período seguro.",False,True); await self._log("SEG-011","Portão aberto por muito tempo",c["gate"])
                    self.schedule("SEG-011",c["delay"],_gate_long)
                else:self.cancel("SEG-011")
        # SEG-012 gate opened away
        if self.enabled("SEG-012"):
            c=self.cfg("SEG-012")
            if eid==c["gate"] and new in ["open","opening"] and self.state(c["mode_entity"])=="Ausente": await self.notify("🚨 Portão abriu com casa vazia","O portão foi aberto enquanto a casa estava em modo Ausente.",True,True); await self._log("SEG-012","Portão aberto com casa vazia",c["gate"])
        # mode-driven engines
        for code in ["SEG-006","SEG-013","SEG-014"]:
            if self.enabled(code):
                c=self.cfg(code)
                if eid==c["mode_entity"]:
                    if code=="SEG-006" and new=="Viagem": await self._travel(c)
                    elif code=="SEG-013" and new in ["Ausente","Viagem"]: self.schedule("SEG-013",c["delay"],lambda:self._secure_house(c,new))
                    elif code=="SEG-014" and new=="Dormindo" and self.state(c["gate"]) in ["open","opening"]: await self.notify("⚠️ Portão aberto","A casa entrou em Dormindo, mas o portão está aberto.",False,True); await self._log("SEG-014","Portão aberto ao dormir",c["gate"])
        # ALR-001 simplified native alarm core
        if self.enabled("ALR-001"):
            c=self.cfg("ALR-001")
            if eid==c["mode_entity"]:
                if new in ["Ausente","Viagem","Dormindo"]:
                    self.schedule("ALR-001-arm",c["exit_delay"],lambda:self._arm_alarm(c,new))
                elif new=="Casa": self.cancel("ALR-001-arm"); await self._alarm_service(c["alarm"],"alarm_disarm")
            group_members=[]
            for g in [c["opening_group"],c["tamper_group"],c["battery_low_group"]]:
                st=self.hass.states.get(g); group_members += list(st.attributes.get("entity_id",[])) if st else []
            if eid in group_members and new=="on":
                if eid in list((self.hass.states.get(c["battery_low_group"]) or {}).attributes.get("entity_id",[]) if self.hass.states.get(c["battery_low_group"]) else []):
                    await self.notify("🟡 Bateria baixa",f"Sensor de segurança com bateria baixa: {eid}",False,False); await self._log("ALR-001","Bateria baixa",eid)
                elif eid in list((self.hass.states.get(c["tamper_group"]) or {}).attributes.get("entity_id",[]) if self.hass.states.get(c["tamper_group"]) else []):
                    await self._trigger_alarm(c,eid,"Violação/tamper")
                elif self.state(c["alarm"]) in ["armed_away","armed_home","armed_night","armed_vacation","armed_custom_bypass"]:
                    async def _entry():
                        if self.state(eid)=="on" and self.state(c["alarm"]).startswith("armed_"): await self._trigger_alarm(c,eid,"Entrada")
                    self.schedule(f"ALR-entry-{eid}",c["entry_delay"],_entry)
        # ALR-004 alarm state notification
        if self.enabled("ALR-004"):
            c=self.cfg("ALR-004")
            if eid==c["alarm"] and old!=new and new in ["disarmed","armed_away","armed_home","armed_night","triggered"]:
                await self.notify("🛡️ Alarme residencial",f"Novo estado: {new}.",new=="triggered",True); await self._log("ALR-004","Mudança de alarme",new)
        # gas engines
        for code in ["GAS-005","GAS-006","GAS-007","GAS-008","GAS-009","GAS-010"]:
            if not self.enabled(code):continue
            c=self.cfg(code)
            if eid!=c["sensor"]:continue
            if code=="GAS-005":
                if new=="on": self.schedule(code,c["confirm_seconds"],lambda:self._gas_alert(code,c["sensor"],"Vazamento de gás detectado",True))
                else:self.cancel(code)
            elif code=="GAS-006":
                if new=="on": self.schedule(code,c["delay"],lambda:self._gas_alert(code,c["sensor"],"Vazamento de gás persistente",True))
                else:self.cancel(code)
            elif code=="GAS-007":
                if new=="off": self.schedule(code,c["confirm_seconds"],lambda:self._gas_clear(code,c["sensor"]))
                else:self.cancel(code)
            elif code=="GAS-008":
                if new in ["unavailable","unknown"]: self.schedule(code,c["delay"],lambda:self._gas_offline(code,c["sensor"]))
                else:self.cancel(code)
            elif code=="GAS-009":
                if old in ["unavailable","unknown"] and new not in ["unavailable","unknown"]: self.schedule(code,c["stable_seconds"],lambda:self._gas_recovered(code,c["sensor"]))
            elif code=="GAS-010":
                if new=="on": self.schedule(code,c["delay"],lambda:self._gas_alert(code,c["sensor"],"Sensor em alarme há tempo excessivo",True))
                else:self.cancel(code)

    @callback
    def _minute_tick(self,now): self.hass.async_create_task(self._handle_minute(now))
    async def _handle_minute(self,now):
        hhmm=now.strftime("%H:%M"); weekday=now.strftime("%a").lower()[:3]
        if self.enabled("CAS-001"):
            c=self.cfg("CAS-001")
            if hhmm==c["time"] and weekday==str(c["weekday"]).lower()[:3]: await self._battery_check(c)
        if self.enabled("SEG-002") and hhmm==self.cfg("SEG-002")["run_time"]: await self._achievement_check(self.cfg("SEG-002"))
        if self.enabled("SEG-005"):
            c=self.cfg("SEG-005"); interval=max(1,int(c["interval_minutes"] or 15))
            if now.minute%interval==0:
                svc=str(c["notify_service"])
                if "." in svc: await self.service(*svc.split(".",1),{"message":"request_location_update"}); await self._log("SEG-005","Atualização de localização",svc)
        if self.enabled("SEG-007") and hhmm==self.cfg("SEG-007")["time"]: await self._night_audit(self.cfg("SEG-007"))
        if self.enabled("SEG-008"):
            c=self.cfg("SEG-008"); n=max(1,int(c["verify_minutes"] or 2))
            if now.minute%n==0:
                st=self.state(c["person"])
                if st=="home": await self._ensure_fence("SEG-008",False)
                elif st not in ["unknown","unavailable","none",""]: await self._ensure_fence("SEG-008",True)
        for code in ["ALR-002","ALR-005"]:
            if self.enabled(code):
                c=self.cfg(code)
                if now.day==1 and hhmm==c["time"]: await self.service("input_number","set_value",{"entity_id":c["counter"],"value":0}); await self._log(code,"Reset mensal","Contador zerado")
        if self.enabled("ALR-003"): await self._holiday_guard(self.cfg("ALR-003"),now)
        if self.enabled("GAS-011") and hhmm==self.cfg("GAS-011")["time"]: await self._gas_daily(self.cfg("GAS-011"))

    async def _battery_check(self,c):
        crit=[];att=[]
        for st in self.hass.states.async_all("sensor"):
            if st.attributes.get("device_class")!="battery":continue
            try:v=float(str(st.state).replace(",","."))
            except:continue
            hay=f"{st.entity_id} {st.attributes.get('friendly_name','')}".lower()
            if any(x in hay for x in ["iphone","inversor","microinversor"]):continue
            if v<float(c["critical_pct"]):crit.append(f"{st.attributes.get('friendly_name',st.entity_id)} {v:.0f}%")
            elif v<float(c["attention_pct"]):att.append(f"{st.attributes.get('friendly_name',st.entity_id)} {v:.0f}%")
        if crit or att: await self.notify("🔋 Baterias de sensores",f"Críticas: {', '.join(crit) or 'nenhuma'}. Atenção: {', '.join(att) or 'nenhuma'}.",False,False)
        await self._log("CAS-001","Check de baterias",f"{len(crit)} críticas; {len(att)} atenção")
    async def _achievement_check(self,c):
        st=self.hass.states.get(c["last_problem"])
        await self._log("SEG-002","Conquista segurança",f"Último problema: {st.state if st else 'n/d'}")
    async def _travel(self,c):
        for eid in c.get("lights_off",[]): await self.service_entity(eid,"turn_off")
        for eid in c.get("switches_off",[]): await self.service_entity(eid,"turn_off")
        await self.service_entity(c["fence"],"turn_on"); await self.notify("✈️ Modo Viagem","Modo Viagem ativado. Segurança reforçada.",False,True); await self._log("SEG-006","Modo Viagem","Proteção reforçada")
    async def _night_audit(self,c):
        issues=[]
        if self.state(c["gate"]) in ["open","opening"]:issues.append("portão aberto")
        if self.state(c["mode_entity"]) in ["Ausente","Viagem"] and self.state(c["fence"])!="on":issues.append("cerca desligada")
        for eid in c.get("lights",[]):
            if self.state(eid)=="on":issues.append(f"{eid} ligada")
        if issues: await self.notify("🌙 Auditoria de segurança","Pendências: "+", ".join(issues),False,True)
        await self._log("SEG-007","Auditoria noturna",", ".join(issues) if issues else "sem pendências")
    async def _ensure_fence(self,code,on):
        c=self.cfg(code); desired="on" if on else "off"; eid=c["fence"]
        if self.state(eid)==desired:return
        for _ in range(max(1,int(c.get("retry_count",3)))):
            await self.service_entity(eid,"turn_on" if on else "turn_off"); await asyncio.sleep(2)
            if self.state(eid)==desired:break
        ok=self.state(eid)==desired
        if not ok: await self.notify("🚨 Falha na cerca elétrica",f"Não foi possível colocar a cerca em {desired}.",False,True)
        await self._log(code,"Controle de cerca",f"{'confirmado' if ok else 'falhou'} -> {desired}")
    async def _secure_house(self,c,mode):
        for eid in c.get("lights_off",[]): await self.service_entity(eid,"turn_off")
        await self.service_entity(c["fence"],"turn_on"); await self._alarm_service(c["alarm"],"alarm_arm_away")
        issues=[]
        if self.state(c["fence"])!="on":issues.append("cerca")
        if self.state(c["gate"]) in ["open","opening"]:issues.append("portão")
        await self.notify("🛡️ Casa segura" if not issues else "⚠️ Segurança não confirmada",f"Modo {mode}. "+("Proteção confirmada." if not issues else "Verifique: "+", ".join(issues)),False,False)
        await self._log("SEG-013","Verificação de proteção",f"modo {mode}; pendências {issues or 'nenhuma'}")
    async def _alarm_service(self,eid,service):
        if not eid:return False
        return await self.service("alarm_control_panel",service,{"entity_id":eid})
    async def _arm_alarm(self,c,mode):
        service="alarm_arm_night" if mode=="Dormindo" else "alarm_arm_away"
        await self._alarm_service(c["alarm"],service); await self._log("ALR-001","Armamento",f"{service} solicitado")
    async def _trigger_alarm(self,c,origin,why):
        await self._alarm_service(c["alarm"],"alarm_trigger")
        if c.get("siren"): await self.service("siren","turn_on",{"entity_id":c["siren"],"tone":"burglar","duration":120,"volume_level":1.0})
        await self.notify("🚨 ALARME RESIDENCIAL",f"{why}. Origem: {origin}.",True,True); await self._log("ALR-001","Alarme disparado",f"{why}: {origin}")
    async def _holiday_guard(self,c,now):
        if now.hour>=int(c["until_hour"]):return
        nonwork=self.state(c["workday"])!="on"
        if not nonwork:return
        if self.state(c["mode_entity"])=="Casa": await self.set_mode(c["mode_entity"],"Ausente")
        if self.state(c["alarm"])=="disarmed": await self._alarm_service(c["alarm"],"alarm_arm_away")
    async def _gas_alert(self,code,sensor,title,critical):
        if self.state(sensor)!="on":return
        await self.notify("🚨 "+title,"O sensor de gás permanece em alarme. Feche o registro, ventile o ambiente e não opere interruptores.",critical,True); await self._log(code,title,sensor)
    async def _gas_clear(self,code,sensor):
        if self.state(sensor)!="off":return
        await self.notify("✅ Alerta de gás encerrado","O sensor permaneceu normal. Confirme presencialmente a ventilação antes de religar equipamentos.",False,True); await self._log(code,"Gás normalizado",sensor)
    async def _gas_offline(self,code,sensor):
        if self.state(sensor) not in ["unknown","unavailable"]:return
        await self.notify("⚠️ Sensor de gás offline","O ambiente deixou de ser monitorado. Verifique energia, rede e o sensor.",False,False); await self._log(code,"Sensor de gás offline",self.state(sensor))
    async def _gas_recovered(self,code,sensor):
        if self.state(sensor) in ["unknown","unavailable"]:return
        await self.notify("✅ Sensor de gás recuperado",f"Monitoramento restabelecido. Estado atual: {self.state(sensor)}.",False,False); await self._log(code,"Sensor recuperado",self.state(sensor))
    async def _gas_daily(self,c):
        st=self.state(c["sensor"])
        msg="Sensor operacional e sem detecção de gás." if st=="off" else ("Sensor está detectando gás." if st=="on" else f"Sensor em estado {st}.")
        await self.notify("🧪 Check-up do sensor de gás",msg,st=="on",False); await self._log("GAS-011","Check-up diário",msg)


async def async_setup_cp_security_engine(hass: HomeAssistant) -> bool:
    """Set up CP-SECURITY engine inside the CloudPelizzon integration."""
    if hass.data.get(DOMAIN):
        return True

    manager = SecurityEngineManager(hass)
    hass.data[DOMAIN] = manager

    # Register websocket commands immediately. The manager is initialized before
    # HA becomes available to the frontend, and async_start is idempotent.
    @websocket_api.websocket_command({probatio.Required("type"): "cloudpelizzon/security/engines/list"})
    @websocket_api.async_response
    async def ws_list(hass, connection, msg):
        try:
            if not manager.started and hass.is_running:
                await manager.async_start()
            connection.send_result(msg["id"], manager.public())
        except Exception as exc:
            _LOGGER.exception("CP-SECURITY engine list failed")
            connection.send_error(msg["id"], "cp_security_engine_error", str(exc) or exc.__class__.__name__)

    @websocket_api.websocket_command({
        probatio.Required("type"): "cloudpelizzon/security/engines/update",
        probatio.Required("code"): str,
        probatio.Optional("enabled"): bool,
        probatio.Optional("config"): dict,
    })
    @websocket_api.async_response
    async def ws_update(hass, connection, msg):
        try:
            if not manager.started:
                await manager.async_start()
            result = await manager.update(msg["code"], msg.get("enabled"), msg.get("config"))
            connection.send_result(msg["id"], result)
        except Exception as exc:
            _LOGGER.exception("CP-SECURITY engine update failed")
            connection.send_error(msg["id"], "cp_security_engine_update_failed", str(exc) or exc.__class__.__name__)

    websocket_api.async_register_command(hass, ws_list)
    websocket_api.async_register_command(hass, ws_update)

    if hass.is_running:
        await manager.async_start()
    else:
        @callback
        def _started(_event):
            hass.async_create_task(manager.async_start())
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _started)

    _LOGGER.info("CP-SECURITY 0.6.1 native engine registered inside CloudPelizzon")
    return True
