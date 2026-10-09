"""CloudPelizzon internal Update Center constants."""

from ..registry import COMPONENTS, PLATFORM_DOMAIN


DOMAIN = "cloudpelizzon_updater"

VERSION = "1.1.0-unified"

STORAGE_VERSION = 1
STORAGE_KEY = "cloudpelizzon_updater.data"

# Preservado para não perder Activation ID / Installation ID existentes.
CORE_STORAGE_FILE = ".storage/cloudpelizzon_core.data"

DEFAULT_SERVER_URL = (
    "https://portal.cloudpelizzon.com.br/"
    "cloudpelizzon-license-api"
)
