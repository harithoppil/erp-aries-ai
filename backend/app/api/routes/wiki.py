from fastapi import APIRouter, HTTPException

from backend.app.schemas.enquiry import WikiPageCreate, WikiPageRead, WikiPageUpdate, WikiSearchResult
from backend.app.services.wiki import WikiService

router = APIRouter(prefix="/wiki", tags=["wiki"])
wiki_service = WikiService()


@router.get("/pages", response_model=list[str])
async def list_pages():
    return wiki_service.list_pages()


@router.get("/pages/{page_path:path}", response_model=WikiPageRead)
async def get_page(page_path: str):
    page = wiki_service.read_page(page_path)
    if not page:
        raise HTTPException(404, f"Wiki page not found: {page_path}")
    return page


@router.post("/pages", response_model=WikiPageRead, status_code=201)
async def create_page(data: WikiPageCreate):
    page = wiki_service.write_page(data.path, data.content, data.commit_message)
    return page


@router.put("/pages/{page_path:path}", response_model=WikiPageRead)
async def update_page(page_path: str, data: WikiPageUpdate):
    existing = wiki_service.read_page(page_path)
    if not existing:
        raise HTTPException(404, f"Wiki page not found: {page_path}")
    page = wiki_service.write_page(page_path, data.content, data.commit_message)
    return page


@router.delete("/pages/{page_path:path}", status_code=204)
async def delete_page(page_path: str, commit_message: str = "Delete page"):
    wiki_service.delete_page(page_path, commit_message)


@router.get("/search", response_model=list[WikiSearchResult])
async def search_wiki(q: str, limit: int = 10):
    return wiki_service.search(q, limit=limit)


@router.get("/index")
async def get_index():
    return wiki_service.read_page("index.md")
