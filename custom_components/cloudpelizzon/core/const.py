"""Constants for CloudPelizzon Core."""
DOMAIN = "cloudpelizzon_core"
VERSION = "0.13.0"
STORAGE_VERSION = 1
STORAGE_KEY = "cloudpelizzon_core.data"

# Production/pilot licensing policy: installed commercial modules require an
# activated online lease. A signed CP1 token by itself is no longer enough.
ONLINE_LICENSE_REQUIRED = True
LICENSE_SERVER_URL_DEFAULT = "https://portal.cloudpelizzon.com.br/cloudpelizzon-license-api"
DEFAULT_CHECKIN_INTERVAL_SEC = 21600
DEFAULT_OFFLINE_GRACE_SEC = 604800

LICENSE_PUBLIC_N = 23396696485064911679333491508699836484602977630094954536828449005705491342160236569191604436217975939190035365258869881466170763588943979610372882444338751015296070345141582185443547699322554308800815197285590629416782921752076545333309975825240403674567455203614324956682926463780819803581223990602715701580322849838322820090378621369303868419732728290012212244054162338676166536800152651751207521740015033496201378703565890117854581043811968621669345942400497173511714220958463290742440365651946265674399340390005973188295961139482861743091926727874758086402418845226505132276308930556203234706438776344524899921297
LICENSE_PUBLIC_E = 65537
MODULES = {
    "CP-MAINTENANCE": {
        "name": "Manutenção Residencial Preventiva",
        "domain": "cloudpelizzon_maintenance",
        "path": "/cloudpelizzon-maintenance",
        "preview": "maintenance.svg",
        "description": "Revisões, vencimentos, histórico e manutenção preventiva da residência.",
    },

    "CP-NOC": {
        "name": "Infraestrutura e NOC",
        "domain": "cloudpelizzon_noc",
        "path": "/cloudpelizzon-noc",
        "preview": "noc.svg",
        "description": "Saúde da plataforma, infraestrutura, serviços, disponibilidade e diagnóstico.",
    },

    "CP-ALEXA": {
        "name": "Central de Monitoramento das Alexas",
        "domain": "cloudpelizzon_alexa",
        "path": "/cloudpelizzon-alexa",
        "preview": "alexa.svg",
        "description": "Status, comunicação, testes, alertas e saúde operacional das Alexas.",
    },

    "CP-ENERGY": {
        "name": "Inteligência de Energia",
        "domain": "cloudpelizzon_energy",
        "path": "/cloudpelizzon-energy",
        "preview": "energy.svg",
        "description": "Consumo, importação, exportação, eficiência e indicadores energéticos.",
    },

    "CP-SOLAR": {
        "name": "Inteligência Solar",
        "domain": "cloudpelizzon_solar",
        "path": "/cloudpelizzon-solar",
        "preview": "energy.svg",
        "description": "Geração fotovoltaica, inversores, produção, eficiência e desempenho solar.",
    },

    "CP-BACKUP": {
        "name": "Inteligência de Backups",
        "domain": "cloudpelizzon_backup",
        "path": "/cloudpelizzon-backup",
        "preview": "backup.svg",
        "description": "Proteção, replicação, integridade, monitoramento e restauração.",
    },

    "CP-SECURITY": {
        "name": "Central de Segurança",
        "domain": "cloudpelizzon_security",
        "path": "/cloudpelizzon-security",
        "preview": "security.svg",
        "description": "Alarmes, sensores, presença e eventos de segurança.",
    },

    "CP-SECURITY-PRO": {
        "name": "Central de Segurança Pro",
        "domain": "cloudpelizzon_security_pro",
        "path": "/cloudpelizzon-security-pro",
        "preview": "security.svg",
        "description": "Segurança avançada com correlação, automações e gestão de incidentes.",
    },

    "CP-CAMERAS": {
        "name": "Inteligência de Câmeras",
        "domain": "cloudpelizzon_cameras",
        "path": "/cloudpelizzon-cameras",
        "preview": "security.svg",
        "description": "Câmeras, eventos, disponibilidade e alertas de monitoramento.",
    },

    "CP-AUTOMATION": {
        "name": "Central Inteligente de Automações",
        "domain": "cloudpelizzon_automation_intelligence",
        "path": "/cloudpelizzon-automation",
        "preview": "automation.svg",
        "description": "Monitoramento, governança e desempenho das automações.",
    },

    "CP-AMBIENTE": {
        "name": "Ambiente",
        "domain": "cloudpelizzon_ambiente",
        "path": "/cloudpelizzon-ambiente",
        "preview": "ambiente.svg",
        "description": "Temperatura, umidade e indicadores ambientais.",
    },

    "CP-WATER": {
        "name": "Inteligência de Água",
        "domain": "cloudpelizzon_water",
        "path": "/cloudpelizzon-water",
        "preview": "ambiente.svg",
        "description": "Consumo, fluxo, reservatório e eventos relacionados à água.",
    },

    "CP-GAS": {
        "name": "Segurança de Gás",
        "domain": "cloudpelizzon_gas",
        "path": "/cloudpelizzon-gas",
        "preview": "security.svg",
        "description": "Monitoramento de gás, alertas críticos e histórico.",
    },

    "CP-PRESENCE": {
        "name": "Presença Inteligente",
        "domain": "cloudpelizzon_presence",
        "path": "/cloudpelizzon-presence",
        "preview": "automation.svg",
        "description": "Chegadas, saídas, ocupação e presença baseada em contexto.",
    },

    "CP-FITOS": {
        "name": "FIT OS",
        "domain": "cloudpelizzon_fitos",
        "path": "/cloudpelizzon-fitos",
        "preview": "fitos.svg",
        "description": "Treinos, metas, evolução e desempenho fitness.",
    },

    "CP-GAMIFICATION": {
        "name": "Gamificação",
        "domain": "cloudpelizzon_gamification",
        "path": "/cloudpelizzon-gamification",
        "preview": "fitos.svg",
        "description": "Conquistas, recordes, metas e engajamento da família.",
    },

    "CP-NOTIFICATIONS-PRO": {
        "name": "Notificações Pro",
        "domain": "cloudpelizzon_notifications_pro",
        "path": "/cloudpelizzon-notifications-pro",
        "preview": "automation.svg",
        "description": "Notificações inteligentes por contexto, prioridade e múltiplos canais.",
    },
}
