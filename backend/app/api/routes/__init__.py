from backend.app.api.routes.enquiries import router as enquiries_router
from backend.app.api.routes.documents import router as documents_router
from backend.app.api.routes.wiki import router as wiki_router
from backend.app.api.routes.pipeline import router as pipeline_router
from backend.app.api.routes.workflow import router as workflow_router
from backend.app.api.routes.ai import router as ai_router
from backend.app.api.routes.channels import router as channels_router

from backend.app.api.routes.accounting import router as accounting_router
from backend.app.api.routes.sales import router as sales_router
from backend.app.api.routes.purchasing import router as purchasing_router
from backend.app.api.routes.inventory import router as inventory_router
from backend.app.api.routes.crm import router as crm_router
from backend.app.api.routes.projects import router as projects_router
from backend.app.api.routes.hr import router as hr_router
from backend.app.api.routes.marine import router as marine_router
from backend.app.api.routes.assets import router as assets_router
from backend.app.api.routes.reports import router as reports_router
from backend.app.api.routes.dashboard import router as dashboard_router
from backend.app.api.routes.settings import router as settings_router
from backend.app.api.routes.auth import router as auth_router
from backend.app.api.routes.companies import router as companies_router

__all__ = [
    "enquiries_router",
    "documents_router",
    "wiki_router",
    "pipeline_router",
    "workflow_router",
    "ai_router",
    "channels_router",
    "accounting_router",
    "sales_router",
    "purchasing_router",
    "inventory_router",
    "crm_router",
    "projects_router",
    "hr_router",
    "marine_router",
    "assets_router",
    "reports_router",
    "dashboard_router",
    "settings_router",
    "auth_router",
    "companies_router",
]
