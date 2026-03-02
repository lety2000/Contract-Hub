from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
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
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

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

# SMTP Settings
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
SMTP_FROM_EMAIL = os.environ.get('SMTP_FROM_EMAIL', '')
SMTP_FROM_NAME = os.environ.get('SMTP_FROM_NAME', 'Vertragsmanager')

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

# Email Settings Model (stored per user)
class SmtpSettings(BaseModel):
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Vertragsmanager"

class SmtpSettingsUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None

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

# ==================== BACKUP ROUTES ====================

class BackupData(BaseModel):
    version: str = "1.0"
    created_at: str
    user: dict
    family_members: List[dict]
    contracts: List[dict]

@api_router.get("/backup/export")
async def export_backup(current_user: User = Depends(get_current_user)):
    """Export all user data as JSON backup"""
    # Get user data (without password)
    user_data = await db.users.find_one({"id": current_user.id})
    if user_data:
        user_data.pop("_id", None)
        user_data.pop("password_hash", None)
    
    # Get family members
    family_members = await db.family_members.find({"user_id": current_user.id}).to_list(100)
    for m in family_members:
        m.pop("_id", None)
    
    # Get contracts
    contracts = await db.contracts.find({"user_id": current_user.id}).to_list(1000)
    for c in contracts:
        c.pop("_id", None)
    
    backup = {
        "version": "1.0",
        "created_at": datetime.utcnow().isoformat(),
        "user": user_data,
        "family_members": family_members,
        "contracts": contracts
    }
    
    import json
    backup_json = json.dumps(backup, indent=2, default=str, ensure_ascii=False)
    
    return StreamingResponse(
        io.BytesIO(backup_json.encode('utf-8')),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=vertragsmanager_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        }
    )

@api_router.post("/backup/restore")
async def restore_backup(
    backup_data: BackupData,
    current_user: User = Depends(get_current_user)
):
    """Restore user data from JSON backup"""
    try:
        # Delete existing data for user
        await db.family_members.delete_many({"user_id": current_user.id})
        await db.contracts.delete_many({"user_id": current_user.id})
        
        restored_family = 0
        restored_contracts = 0
        
        # Restore family members with new user_id
        for member in backup_data.family_members:
            member["user_id"] = current_user.id
            member["_id"] = None  # Let MongoDB generate new _id
            if "_id" in member:
                del member["_id"]
            await db.family_members.insert_one(member)
            restored_family += 1
        
        # Restore contracts with new user_id
        for contract in backup_data.contracts:
            contract["user_id"] = current_user.id
            if "_id" in contract:
                del contract["_id"]
            await db.contracts.insert_one(contract)
            restored_contracts += 1
        
        return {
            "message": "Backup erfolgreich wiederhergestellt",
            "restored_family_members": restored_family,
            "restored_contracts": restored_contracts
        }
    except Exception as e:
        logger.error(f"Backup restore failed: {e}")
        raise HTTPException(status_code=500, detail=f"Wiederherstellung fehlgeschlagen: {str(e)}")

# ==================== EMAIL FUNCTIONS ====================

def parse_date(date_str: str) -> datetime:
    """Parse date from ISO or German format"""
    if not date_str:
        return None
    # Try ISO format first (YYYY-MM-DD)
    if '-' in date_str:
        try:
            return datetime.strptime(date_str.split('T')[0], '%Y-%m-%d')
        except:
            pass
    # Try German format (DD.MM.YYYY)
    if '.' in date_str:
        try:
            return datetime.strptime(date_str, '%d.%m.%Y')
        except:
            pass
    return None

def format_date_german(date_str: str) -> str:
    """Convert date to German format"""
    dt = parse_date(date_str)
    if dt:
        return dt.strftime('%d.%m.%Y')
    return date_str

async def get_user_smtp_settings(user_id: str) -> dict:
    """Get SMTP settings for a user (from DB or fallback to env)"""
    settings = await db.smtp_settings.find_one({"user_id": user_id})
    if settings and settings.get("smtp_user"):
        return {
            "smtp_host": settings.get("smtp_host", SMTP_HOST),
            "smtp_port": settings.get("smtp_port", SMTP_PORT),
            "smtp_user": settings.get("smtp_user", ""),
            "smtp_password": settings.get("smtp_password", ""),
            "smtp_from_email": settings.get("smtp_from_email", ""),
            "smtp_from_name": settings.get("smtp_from_name", SMTP_FROM_NAME),
        }
    # Fallback to environment variables
    return {
        "smtp_host": SMTP_HOST,
        "smtp_port": SMTP_PORT,
        "smtp_user": SMTP_USER,
        "smtp_password": SMTP_PASSWORD,
        "smtp_from_email": SMTP_FROM_EMAIL,
        "smtp_from_name": SMTP_FROM_NAME,
    }

def send_email_with_settings(smtp_settings: dict, to_email: str, subject: str, html_content: str) -> bool:
    """Send email via SMTP with custom settings"""
    if not smtp_settings.get("smtp_user") or not smtp_settings.get("smtp_password"):
        logger.warning("SMTP credentials not configured")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{smtp_settings.get('smtp_from_name', 'Vertragsmanager')} <{smtp_settings.get('smtp_from_email', smtp_settings.get('smtp_user'))}>"
        msg['To'] = to_email
        
        html_part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(html_part)
        
        with smtplib.SMTP(smtp_settings.get("smtp_host", "smtp.gmail.com"), smtp_settings.get("smtp_port", 587)) as server:
            server.starttls()
            server.login(smtp_settings.get("smtp_user"), smtp_settings.get("smtp_password"))
            server.sendmail(smtp_settings.get("smtp_from_email", smtp_settings.get("smtp_user")), to_email, msg.as_string())
        
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False

def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send email via SMTP (legacy function using env vars)"""
    settings = {
        "smtp_host": SMTP_HOST,
        "smtp_port": SMTP_PORT,
        "smtp_user": SMTP_USER,
        "smtp_password": SMTP_PASSWORD,
        "smtp_from_email": SMTP_FROM_EMAIL,
        "smtp_from_name": SMTP_FROM_NAME,
    }
    return send_email_with_settings(settings, to_email, subject, html_content)

def create_reminder_email_html(reminders: list, username: str) -> str:
    """Create HTML content for reminder email"""
    reminder_rows = ""
    for r in reminders:
        status_color = "#ef4444" if r.get('is_overdue') else "#f59e0b" if r.get('is_today') else "#3b82f6"
        status_text = "Überfällig" if r.get('is_overdue') else "Heute" if r.get('is_today') else "Anstehend"
        
        reminder_rows += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #334155;">
                <span style="background-color: {status_color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">{status_text}</span>
                <br/>
                <strong style="color: #f8fafc;">{r.get('date_formatted', '')}</strong>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #334155;">
                <strong style="color: #f8fafc;">{r.get('title', '')}</strong>
                <br/>
                <span style="color: #94a3b8;">{r.get('contract_name', '')}</span>
            </td>
        </tr>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="background-color: #0f172a; color: #f8fafc; font-family: Arial, sans-serif; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 24px;">
            <h1 style="color: #3b82f6; margin-bottom: 8px;">📋 Vertragsmanager</h1>
            <h2 style="color: #f8fafc; margin-top: 0;">Erinnerungen für {username}</h2>
            
            <p style="color: #94a3b8;">Du hast {len(reminders)} anstehende Erinnerung(en):</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background-color: #334155;">
                        <th style="padding: 12px; text-align: left; color: #94a3b8;">Datum</th>
                        <th style="padding: 12px; text-align: left; color: #94a3b8;">Erinnerung</th>
                    </tr>
                </thead>
                <tbody>
                    {reminder_rows}
                </tbody>
            </table>
            
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">
                Diese E-Mail wurde automatisch vom Vertragsmanager gesendet.
            </p>
        </div>
    </body>
    </html>
    """
    return html

# ==================== EMAIL REMINDER ROUTES ====================

class EmailSettings(BaseModel):
    reminder_email: Optional[str] = None
    send_daily_reminders: bool = True

@api_router.get("/reminders/check")
async def check_reminders(current_user: User = Depends(get_current_user)):
    """Check for due reminders and return them"""
    contracts = await db.contracts.find({"user_id": current_user.id}).to_list(1000)
    
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    next_week = today + timedelta(days=7)
    
    due_reminders = []
    
    for contract in contracts:
        if not contract.get("reminders"):
            continue
            
        for reminder in contract.get("reminders", []):
            reminder_date = parse_date(reminder.get("date", ""))
            if not reminder_date:
                continue
            
            reminder_date = reminder_date.replace(hour=0, minute=0, second=0, microsecond=0)
            
            if reminder_date <= next_week:
                due_reminders.append({
                    "id": reminder.get("id"),
                    "title": reminder.get("title"),
                    "date": reminder.get("date"),
                    "date_formatted": format_date_german(reminder.get("date")),
                    "description": reminder.get("description"),
                    "contract_id": contract.get("id"),
                    "contract_name": contract.get("name"),
                    "is_overdue": reminder_date < today,
                    "is_today": reminder_date == today
                })
    
    # Sort by date
    due_reminders.sort(key=lambda x: parse_date(x["date"]) or datetime.max)
    
    return {
        "reminders": due_reminders,
        "count": len(due_reminders)
    }

@api_router.post("/reminders/send-email")
async def send_reminder_email(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Send reminder email to user"""
    # Get user's email
    user_data = await db.users.find_one({"id": current_user.id})
    user_email = user_data.get("email") if user_data else None
    
    if not user_email:
        raise HTTPException(status_code=400, detail="Keine E-Mail-Adresse hinterlegt. Bitte in den Einstellungen hinzufügen.")
    
    # Get SMTP settings for user
    smtp_settings = await get_user_smtp_settings(current_user.id)
    
    # Get due reminders
    contracts = await db.contracts.find({"user_id": current_user.id}).to_list(1000)
    
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    next_week = today + timedelta(days=7)
    
    due_reminders = []
    
    for contract in contracts:
        for reminder in contract.get("reminders", []):
            reminder_date = parse_date(reminder.get("date", ""))
            if not reminder_date:
                continue
            
            reminder_date = reminder_date.replace(hour=0, minute=0, second=0, microsecond=0)
            
            if reminder_date <= next_week:
                due_reminders.append({
                    "title": reminder.get("title"),
                    "date_formatted": format_date_german(reminder.get("date")),
                    "contract_name": contract.get("name"),
                    "is_overdue": reminder_date < today,
                    "is_today": reminder_date == today
                })
    
    if not due_reminders:
        return {"message": "Keine anstehenden Erinnerungen", "sent": False}
    
    # Sort by date
    due_reminders.sort(key=lambda x: x.get("is_overdue", False), reverse=True)
    
    # Create and send email
    html_content = create_reminder_email_html(due_reminders, current_user.username)
    subject = f"🔔 {len(due_reminders)} Vertragserinnerung(en) - Vertragsmanager"
    
    success = send_email_with_settings(smtp_settings, user_email, subject, html_content)
    
    if success:
        return {
            "message": f"E-Mail mit {len(due_reminders)} Erinnerung(en) an {user_email} gesendet",
            "sent": True,
            "reminder_count": len(due_reminders)
        }
    else:
        raise HTTPException(status_code=500, detail="E-Mail konnte nicht gesendet werden. Bitte SMTP-Einstellungen prüfen.")

@api_router.post("/reminders/test-email")
async def test_email(current_user: User = Depends(get_current_user)):
    """Send a test email to verify configuration"""
    user_data = await db.users.find_one({"id": current_user.id})
    user_email = user_data.get("email") if user_data else None
    
    if not user_email:
        raise HTTPException(status_code=400, detail="Keine E-Mail-Adresse hinterlegt")
    
    # Get SMTP settings for user
    smtp_settings = await get_user_smtp_settings(current_user.id)
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="background-color: #0f172a; color: #f8fafc; font-family: Arial, sans-serif; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 24px;">
            <h1 style="color: #3b82f6;">✅ Test erfolgreich!</h1>
            <p style="color: #f8fafc;">Hallo {current_user.username},</p>
            <p style="color: #94a3b8;">
                Diese Test-E-Mail bestätigt, dass deine E-Mail-Einstellungen korrekt konfiguriert sind.
                Du wirst ab jetzt Erinnerungen per E-Mail erhalten.
            </p>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">
                Vertragsmanager - Alle Verträge im Überblick
            </p>
        </div>
    </body>
    </html>
    """
    
    success = send_email_with_settings(smtp_settings, user_email, "✅ Vertragsmanager - Test-E-Mail", html_content)
    
    if success:
        return {"message": f"Test-E-Mail an {user_email} gesendet", "success": True}
    else:
        raise HTTPException(status_code=500, detail="E-Mail konnte nicht gesendet werden. Bitte SMTP-Einstellungen prüfen.")

# ==================== SMTP SETTINGS ROUTES ====================

@api_router.get("/settings/smtp")
async def get_smtp_settings(current_user: User = Depends(get_current_user)):
    """Get SMTP settings for current user"""
    settings = await db.smtp_settings.find_one({"user_id": current_user.id})
    if settings:
        # Don't return the password in full
        return {
            "smtp_host": settings.get("smtp_host", "smtp.gmail.com"),
            "smtp_port": settings.get("smtp_port", 587),
            "smtp_user": settings.get("smtp_user", ""),
            "smtp_password_set": bool(settings.get("smtp_password")),
            "smtp_from_email": settings.get("smtp_from_email", ""),
            "smtp_from_name": settings.get("smtp_from_name", "Vertragsmanager"),
        }
    # Return defaults (check if env vars are set)
    return {
        "smtp_host": SMTP_HOST,
        "smtp_port": SMTP_PORT,
        "smtp_user": SMTP_USER,
        "smtp_password_set": bool(SMTP_PASSWORD),
        "smtp_from_email": SMTP_FROM_EMAIL,
        "smtp_from_name": SMTP_FROM_NAME,
    }

@api_router.put("/settings/smtp")
async def update_smtp_settings(
    settings: SmtpSettingsUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update SMTP settings for current user"""
    existing = await db.smtp_settings.find_one({"user_id": current_user.id})
    
    update_data = {k: v for k, v in settings.dict().items() if v is not None}
    update_data["user_id"] = current_user.id
    update_data["updated_at"] = datetime.utcnow()
    
    if existing:
        # If password not provided, keep the old one
        if "smtp_password" not in update_data or not update_data.get("smtp_password"):
            update_data["smtp_password"] = existing.get("smtp_password", "")
        
        await db.smtp_settings.update_one(
            {"user_id": current_user.id},
            {"$set": update_data}
        )
    else:
        await db.smtp_settings.insert_one(update_data)
    
    return {"message": "SMTP-Einstellungen gespeichert", "success": True}

@api_router.delete("/settings/smtp")
async def delete_smtp_settings(current_user: User = Depends(get_current_user)):
    """Delete custom SMTP settings (will use env defaults)"""
    await db.smtp_settings.delete_one({"user_id": current_user.id})
    return {"message": "SMTP-Einstellungen zurückgesetzt", "success": True}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== SCHEDULER FOR AUTOMATIC REMINDERS ====================

scheduler = AsyncIOScheduler()

async def send_daily_reminders():
    """Send reminder emails only for reminders due TODAY"""
    logger.info("Checking for reminders due today...")
    
    try:
        # Get all users with email
        users = await db.users.find({"email": {"$exists": True, "$ne": None, "$ne": ""}}).to_list(1000)
        
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        for user_data in users:
            user_id = user_data.get("id")
            user_email = user_data.get("email")
            username = user_data.get("username", "Benutzer")
            
            if not user_email:
                continue
            
            # Check if user has auto-reminders enabled (default: True)
            settings = await db.user_settings.find_one({"user_id": user_id})
            if settings and settings.get("auto_reminders") == False:
                continue
            
            # Get SMTP settings for user
            smtp_settings = await db.smtp_settings.find_one({"user_id": user_id})
            if smtp_settings and smtp_settings.get("smtp_user"):
                email_settings = {
                    "smtp_host": smtp_settings.get("smtp_host", SMTP_HOST),
                    "smtp_port": smtp_settings.get("smtp_port", SMTP_PORT),
                    "smtp_user": smtp_settings.get("smtp_user", ""),
                    "smtp_password": smtp_settings.get("smtp_password", ""),
                    "smtp_from_email": smtp_settings.get("smtp_from_email", ""),
                    "smtp_from_name": smtp_settings.get("smtp_from_name", SMTP_FROM_NAME),
                }
            else:
                # Use default settings
                email_settings = {
                    "smtp_host": SMTP_HOST,
                    "smtp_port": SMTP_PORT,
                    "smtp_user": SMTP_USER,
                    "smtp_password": SMTP_PASSWORD,
                    "smtp_from_email": SMTP_FROM_EMAIL,
                    "smtp_from_name": SMTP_FROM_NAME,
                }
            
            if not email_settings.get("smtp_user") or not email_settings.get("smtp_password"):
                continue
            
            # Get contracts for user
            contracts = await db.contracts.find({"user_id": user_id}).to_list(1000)
            
            # Find reminders due TODAY only
            todays_reminders = []
            
            for contract in contracts:
                for reminder in contract.get("reminders", []):
                    reminder_date = parse_date(reminder.get("date", ""))
                    if not reminder_date:
                        continue
                    
                    reminder_date = reminder_date.replace(hour=0, minute=0, second=0, microsecond=0)
                    
                    # Only include reminders for TODAY
                    if reminder_date == today:
                        todays_reminders.append({
                            "title": reminder.get("title"),
                            "date_formatted": format_date_german(reminder.get("date")),
                            "description": reminder.get("description", ""),
                            "contract_name": contract.get("name"),
                            "contract_provider": contract.get("provider", ""),
                            "is_overdue": False,
                            "is_today": True
                        })
            
            if not todays_reminders:
                continue
            
            # Create email for today's reminders
            html_content = create_today_reminder_email_html(todays_reminders, username)
            subject = f"🔔 Erinnerung heute: {todays_reminders[0]['title']}" if len(todays_reminders) == 1 else f"🔔 {len(todays_reminders)} Erinnerungen für heute"
            
            success = send_email_with_settings(email_settings, user_email, subject, html_content)
            if success:
                logger.info(f"Reminder email sent to {user_email} for {len(todays_reminders)} reminder(s) due today")
            else:
                logger.warning(f"Failed to send reminder email to {user_email}")
                
    except Exception as e:
        logger.error(f"Daily reminder job failed: {e}")

def create_today_reminder_email_html(reminders: list, username: str) -> str:
    """Create HTML content for today's reminder email"""
    reminder_rows = ""
    for r in reminders:
        description = f"<p style='color: #94a3b8; margin: 8px 0 0 0;'>{r.get('description', '')}</p>" if r.get('description') else ""
        
        reminder_rows += f"""
        <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #f59e0b;">
            <h3 style="color: #f8fafc; margin: 0 0 8px 0;">{r.get('title', 'Erinnerung')}</h3>
            <p style="color: #3b82f6; margin: 0; font-weight: 500;">📋 {r.get('contract_name', '')} {(' - ' + r.get('contract_provider', '')) if r.get('contract_provider') else ''}</p>
            {description}
        </div>
        """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="background-color: #0f172a; color: #f8fafc; font-family: Arial, sans-serif; padding: 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 24px;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #f59e0b; margin: 0;">🔔 Erinnerung</h1>
                <p style="color: #94a3b8; margin: 8px 0 0 0;">Hallo {username}, heute ist Stichtag!</p>
            </div>
            
            <p style="color: #f8fafc; font-size: 16px;">
                Du hast {len(reminders)} Erinnerung{"en" if len(reminders) > 1 else ""} für heute ({datetime.now().strftime('%d.%m.%Y')}):
            </p>
            
            {reminder_rows}
            
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155;">
                <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
                    Diese E-Mail wurde automatisch vom Vertragsmanager gesendet.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    return html

@app.on_event("startup")
async def startup_event():
    # Schedule daily reminder check at 8:00 AM
    scheduler.add_job(
        send_daily_reminders,
        CronTrigger(hour=8, minute=0),
        id="daily_reminders",
        replace_existing=True
    )
    scheduler.start()
    logger.info("Scheduler started - Daily reminder check scheduled for 8:00 AM")

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown()
    client.close()
