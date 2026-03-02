from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
import base64
import io
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'vertragsmanager-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="Vertragsmanager API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class FamilyMemberCreate(BaseModel):
    name: str
    relationship: str  # z.B. "Ehepartner", "Kind", "Eltern"

class FamilyMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    relationship: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DocumentCreate(BaseModel):
    name: str
    content_base64: str  # PDF als Base64
    mime_type: str = "application/pdf"

class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    content_base64: str
    mime_type: str = "application/pdf"
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class ReminderCreate(BaseModel):
    title: str
    date: str  # ISO format date string
    description: Optional[str] = None

class Reminder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    date: str
    description: Optional[str] = None

class ContractCreate(BaseModel):
    name: str
    provider: str  # Anbieter
    category: str  # Versicherungen, Abonnements, Telekommunikation, Energie, Sonstige
    family_member_id: Optional[str] = None
    cost: float  # Kosten
    cost_interval: str = "monatlich"  # monatlich, jährlich, quartalsweise
    start_date: Optional[str] = None
    end_date: Optional[str] = None  # Laufzeit Ende
    cancellation_period: Optional[str] = None  # Kündigungsfrist
    contract_number: Optional[str] = None  # Vertragsnummer
    contact_person: Optional[str] = None  # Ansprechpartner
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None  # Notizen
    tags: List[str] = []
    documents: List[DocumentCreate] = []
    reminders: List[ReminderCreate] = []

class Contract(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    provider: str
    category: str
    family_member_id: Optional[str] = None
    cost: float
    cost_interval: str = "monatlich"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    cancellation_period: Optional[str] = None
    contract_number: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    tags: List[str] = []
    documents: List[Document] = []
    reminders: List[Reminder] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ContractUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    category: Optional[str] = None
    family_member_id: Optional[str] = None
    cost: Optional[float] = None
    cost_interval: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    cancellation_period: Optional[str] = None
    contract_number: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    documents: Optional[List[DocumentCreate]] = None
    reminders: Optional[List[ReminderCreate]] = None

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, username: str) -> str:
    payload = {
        'user_id': user_id,
        'username': username,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="Ungültiger Token")
        
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")
        
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ungültiger Token")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Benutzername bereits vergeben")
    
    # Create user
    user_dict = {
        "id": str(uuid.uuid4()),
        "username": user_data.username,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_dict)
    
    token = create_token(user_dict["id"], user_dict["username"])
    
    return {
        "token": token,
        "user": {
            "id": user_dict["id"],
            "username": user_dict["username"],
            "email": user_dict["email"]
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username})
    if not user:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    token = create_token(user["id"], user["username"])
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user.get("email")
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ==================== FAMILY MEMBER ROUTES ====================

@api_router.post("/family-members", response_model=FamilyMember)
async def create_family_member(
    member: FamilyMemberCreate,
    current_user: User = Depends(get_current_user)
):
    # Check member count (max 6)
    count = await db.family_members.count_documents({"user_id": current_user.id})
    if count >= 6:
        raise HTTPException(status_code=400, detail="Maximal 6 Familienmitglieder erlaubt")
    
    member_obj = FamilyMember(
        user_id=current_user.id,
        name=member.name,
        relationship=member.relationship
    )
    
    await db.family_members.insert_one(member_obj.dict())
    return member_obj

@api_router.get("/family-members", response_model=List[FamilyMember])
async def get_family_members(current_user: User = Depends(get_current_user)):
    members = await db.family_members.find({"user_id": current_user.id}).to_list(100)
    return [FamilyMember(**m) for m in members]

@api_router.delete("/family-members/{member_id}")
async def delete_family_member(
    member_id: str,
    current_user: User = Depends(get_current_user)
):
    result = await db.family_members.delete_one({
        "id": member_id,
        "user_id": current_user.id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Familienmitglied nicht gefunden")
    
    # Also update contracts to remove this family member reference
    await db.contracts.update_many(
        {"family_member_id": member_id},
        {"$set": {"family_member_id": None}}
    )
    
    return {"message": "Familienmitglied gelöscht"}

# ==================== CONTRACT ROUTES ====================

@api_router.post("/contracts", response_model=Contract)
async def create_contract(
    contract: ContractCreate,
    current_user: User = Depends(get_current_user)
):
    # Convert documents and reminders
    documents = [Document(**d.dict()) for d in contract.documents]
    reminders = [Reminder(**r.dict()) for r in contract.reminders]
    
    contract_obj = Contract(
        user_id=current_user.id,
        name=contract.name,
        provider=contract.provider,
        category=contract.category,
        family_member_id=contract.family_member_id,
        cost=contract.cost,
        cost_interval=contract.cost_interval,
        start_date=contract.start_date,
        end_date=contract.end_date,
        cancellation_period=contract.cancellation_period,
        contract_number=contract.contract_number,
        contact_person=contract.contact_person,
        contact_phone=contract.contact_phone,
        contact_email=contract.contact_email,
        notes=contract.notes,
        tags=contract.tags,
        documents=[d.dict() for d in documents],
        reminders=[r.dict() for r in reminders]
    )
    
    await db.contracts.insert_one(contract_obj.dict())
    return contract_obj

@api_router.get("/contracts", response_model=List[Contract])
async def get_contracts(
    category: Optional[str] = None,
    family_member_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {"user_id": current_user.id}
    if category:
        query["category"] = category
    if family_member_id:
        query["family_member_id"] = family_member_id
    
    contracts = await db.contracts.find(query).to_list(1000)
    return [Contract(**c) for c in contracts]

@api_router.get("/contracts/{contract_id}", response_model=Contract)
async def get_contract(
    contract_id: str,
    current_user: User = Depends(get_current_user)
):
    contract = await db.contracts.find_one({
        "id": contract_id,
        "user_id": current_user.id
    })
    if not contract:
        raise HTTPException(status_code=404, detail="Vertrag nicht gefunden")
    return Contract(**contract)

@api_router.put("/contracts/{contract_id}", response_model=Contract)
async def update_contract(
    contract_id: str,
    updates: ContractUpdate,
    current_user: User = Depends(get_current_user)
):
    contract = await db.contracts.find_one({
        "id": contract_id,
        "user_id": current_user.id
    })
    if not contract:
        raise HTTPException(status_code=404, detail="Vertrag nicht gefunden")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    # Handle documents conversion
    if "documents" in update_data:
        update_data["documents"] = [Document(**d).dict() for d in update_data["documents"]]
    
    # Handle reminders conversion
    if "reminders" in update_data:
        update_data["reminders"] = [Reminder(**r).dict() for r in update_data["reminders"]]
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.contracts.update_one(
        {"id": contract_id},
        {"$set": update_data}
    )
    
    updated = await db.contracts.find_one({"id": contract_id})
    return Contract(**updated)

@api_router.delete("/contracts/{contract_id}")
async def delete_contract(
    contract_id: str,
    current_user: User = Depends(get_current_user)
):
    result = await db.contracts.delete_one({
        "id": contract_id,
        "user_id": current_user.id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vertrag nicht gefunden")
    return {"message": "Vertrag gelöscht"}

# ==================== DOCUMENT ROUTES ====================

@api_router.post("/contracts/{contract_id}/documents")
async def add_document(
    contract_id: str,
    document: DocumentCreate,
    current_user: User = Depends(get_current_user)
):
    contract = await db.contracts.find_one({
        "id": contract_id,
        "user_id": current_user.id
    })
    if not contract:
        raise HTTPException(status_code=404, detail="Vertrag nicht gefunden")
    
    doc_obj = Document(**document.dict())
    
    await db.contracts.update_one(
        {"id": contract_id},
        {"$push": {"documents": doc_obj.dict()}}
    )
    
    return doc_obj

@api_router.delete("/contracts/{contract_id}/documents/{document_id}")
async def delete_document(
    contract_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    result = await db.contracts.update_one(
        {"id": contract_id, "user_id": current_user.id},
        {"$pull": {"documents": {"id": document_id}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    return {"message": "Dokument gelöscht"}

# ==================== EXPORT ROUTES ====================

@api_router.get("/export/excel")
async def export_excel(current_user: User = Depends(get_current_user)):
    contracts = await db.contracts.find({"user_id": current_user.id}).to_list(1000)
    family_members = await db.family_members.find({"user_id": current_user.id}).to_list(100)
    
    # Create family member lookup
    member_lookup = {m["id"]: m["name"] for m in family_members}
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Verträge"
    
    # Headers
    headers = [
        "Name", "Anbieter", "Kategorie", "Familienmitglied", "Kosten",
        "Kostenintervall", "Startdatum", "Enddatum", "Kündigungsfrist",
        "Vertragsnummer", "Ansprechpartner", "Telefon", "E-Mail", "Notizen", "Tags"
    ]
    ws.append(headers)
    
    # Style header row
    for cell in ws[1]:
        cell.font = cell.font.copy(bold=True)
    
    # Data rows
    for c in contracts:
        member_name = member_lookup.get(c.get("family_member_id"), "Ich")
        tags = ", ".join(c.get("tags", []))
        ws.append([
            c.get("name", ""),
            c.get("provider", ""),
            c.get("category", ""),
            member_name,
            c.get("cost", 0),
            c.get("cost_interval", ""),
            c.get("start_date", ""),
            c.get("end_date", ""),
            c.get("cancellation_period", ""),
            c.get("contract_number", ""),
            c.get("contact_person", ""),
            c.get("contact_phone", ""),
            c.get("contact_email", ""),
            c.get("notes", ""),
            tags
        ])
    
    # Adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=vertraege.xlsx"}
    )

@api_router.get("/export/pdf")
async def export_pdf(current_user: User = Depends(get_current_user)):
    contracts = await db.contracts.find({"user_id": current_user.id}).to_list(1000)
    family_members = await db.family_members.find({"user_id": current_user.id}).to_list(100)
    
    # Create family member lookup
    member_lookup = {m["id"]: m["name"] for m in family_members}
    
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, topMargin=1*cm, bottomMargin=1*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph("Vertragsübersicht", title_style))
    elements.append(Spacer(1, 20))
    
    # Summary
    total_monthly = sum(
        c.get("cost", 0) if c.get("cost_interval") == "monatlich" else c.get("cost", 0) / 12
        for c in contracts
    )
    summary_text = f"Anzahl Verträge: {len(contracts)} | Geschätzte monatliche Kosten: {total_monthly:.2f} EUR"
    elements.append(Paragraph(summary_text, styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Group by category
    categories = {}
    for c in contracts:
        cat = c.get("category", "Sonstige")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(c)
    
    for category, cat_contracts in categories.items():
        elements.append(Paragraph(f"<b>{category}</b>", styles['Heading2']))
        elements.append(Spacer(1, 10))
        
        # Table data
        table_data = [["Name", "Anbieter", "Kosten", "Familienmitglied"]]
        for c in cat_contracts:
            member_name = member_lookup.get(c.get("family_member_id"), "Ich")
            cost_str = f"{c.get('cost', 0):.2f} EUR/{c.get('cost_interval', 'monatlich')}"
            table_data.append([
                c.get("name", "")[:30],
                c.get("provider", "")[:20],
                cost_str,
                member_name[:15]
            ])
        
        table = Table(table_data, colWidths=[5*cm, 4*cm, 4*cm, 3*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2196F3')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f5f5f5')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')])
        ]))
        
        elements.append(table)
        elements.append(Spacer(1, 20))
    
    doc.build(elements)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=vertraege.pdf"}
    )

# ==================== STATISTICS ROUTES ====================

@api_router.get("/statistics")
async def get_statistics(current_user: User = Depends(get_current_user)):
    contracts = await db.contracts.find({"user_id": current_user.id}).to_list(1000)
    
    # Calculate statistics
    total_contracts = len(contracts)
    
    # Monthly costs calculation
    monthly_costs = 0
    for c in contracts:
        cost = c.get("cost", 0)
        interval = c.get("cost_interval", "monatlich")
        if interval == "monatlich":
            monthly_costs += cost
        elif interval == "jährlich":
            monthly_costs += cost / 12
        elif interval == "quartalsweise":
            monthly_costs += cost / 3
    
    # By category
    by_category = {}
    for c in contracts:
        cat = c.get("category", "Sonstige")
        if cat not in by_category:
            by_category[cat] = {"count": 0, "monthly_cost": 0}
        by_category[cat]["count"] += 1
        
        cost = c.get("cost", 0)
        interval = c.get("cost_interval", "monatlich")
        if interval == "monatlich":
            by_category[cat]["monthly_cost"] += cost
        elif interval == "jährlich":
            by_category[cat]["monthly_cost"] += cost / 12
        elif interval == "quartalsweise":
            by_category[cat]["monthly_cost"] += cost / 3
    
    return {
        "total_contracts": total_contracts,
        "total_monthly_cost": round(monthly_costs, 2),
        "total_yearly_cost": round(monthly_costs * 12, 2),
        "by_category": by_category
    }

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Vertragsmanager API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
