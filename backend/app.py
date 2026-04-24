from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List, Optional
import traceback
import re
import certifi

app = FastAPI(title="Ranking NCP Backend")

# Tratamento global de erros para ajudar no debug da Vercel
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Erro Crítico: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"message": "Erro Interno no Servidor", "details": str(exc), "traceback": traceback.format_exc()}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = "mongodb+srv://dheeandressa_db_user:andressadhee.14@cluster0.sxlou9m.mongodb.net/?appName=Cluster0"
DB_NAME = "ranking_ncp"

_client = None

def get_db():
    global _client
    if _client is None:
        # Inicialização Lasy (tardia) para não bugar o event loop da Vercel
        _client = AsyncIOMotorClient(
            MONGO_URI,
            maxIdleTimeMS=50000,
            serverSelectionTimeoutMS=10000,
            tlsCAFile=certifi.where()
        )
    return _client[DB_NAME]


class LoginRequest(BaseModel):
    username: str
    password: str

class StudentSchema(BaseModel):
    nome: str
    usuario: str
    senha: str
    foto: str = ""
    xp_total: int = 0
    presencas: List[str] = []
    soma_notas: int = 0
    tentativas_teste: int = 0
    comportamento_bom: bool = True
    badges: List[str] = ["", "", "", ""]
    xp_extra: int = 0

class ClassSchema(BaseModel):
    nome_turma: str
    alunos: List[StudentSchema]
    admin: Optional[str] = None

@app.on_event("shutdown")
async def shutdown_db_client():
    global _client
    if _client:
        _client.close()

# ---------- ROTAS ---------- #

@app.get("/")
def read_root():
    return {"status": "O servidor FastAPI do Ranking NCP está online!"}

@app.post("/api/login")
async def login(req: LoginRequest):
    usr = req.username.lower()
    
    if usr == "andressa" and req.password == "dhee.14":
        return {"userType": "admin", "username": "Andressa"}
        
    if usr == "lucas" and req.password == "lucas.001":
        return {"userType": "admin", "username": "Lucas"}
    
    aluno = await get_db()["alunos"].find_one({"usuario": req.username, "senha": req.password})
    if aluno:
        return {"userType": "aluno", "username": aluno["nome"], "classId": aluno.get("class_id")}
    
    raise HTTPException(status_code=401, detail="Credenciais inválidas")

@app.post("/api/turmas")
async def create_class(req: ClassSchema):
    class_slug = re.sub(r'[^a-zA-Z0-9]+', '-', req.nome_turma.lower()).strip('-')

    await get_db()["turmas"].insert_one({
        "nome_turma": req.nome_turma, 
        "slug": class_slug,
        "admin": req.admin
    })
    
    students_to_insert = []
    for aluno in req.alunos:
        student_doc = aluno.dict()
        student_doc["class_id"] = class_slug
        students_to_insert.append(student_doc)
        
    if students_to_insert:
        await get_db()["alunos"].insert_many(students_to_insert)
        
    return {"message": "Turma inserida com sucesso!", "slug": class_slug}

@app.get("/api/turmas")
async def get_classes(admin: Optional[str] = None):
    query = {}
    if admin:
        query["admin"] = {"$regex": f"^{re.escape(admin)}$", "$options": "i"}
        
    cursor = get_db()["turmas"].find(query, {"_id": 0})
    turmas = []
    async for t in cursor:
        turmas.append(t)
    return {"turmas": turmas}

@app.get("/api/turmas/{slug}")
async def get_class_details(slug: str, admin: Optional[str] = None, userType: Optional[str] = None):
    turma = await get_db()["turmas"].find_one({"slug": slug}, {"_id": 0})
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
        
    if userType == "admin" and admin and turma.get("admin") and turma.get("admin").lower() != admin.lower():
        raise HTTPException(status_code=403, detail="Acesso negado. Você não possui permissão para visualizar as métricas desta turma.")
    
    projection = {"_id": 0}
    if userType != "admin":
        projection["usuario"] = 0
        projection["senha"] = 0

    cursor = get_db()["alunos"].find({"class_id": slug}, projection).sort("xp_total", -1)
    alunos = []
    async for a in cursor:
        alunos.append(a)
    
    turma["alunos"] = alunos
    return turma

@app.delete("/api/turmas/{slug}")
async def delete_class_details(slug: str, admin: Optional[str] = None):
    turma = await get_db()["turmas"].find_one({"slug": slug})
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada para exclusão")
        
    if admin and turma.get("admin") and turma.get("admin").lower() != admin.lower():
        raise HTTPException(status_code=403, detail="Acesso negado. Você não pode excluir uma turma que não criou.")
        
    await get_db()["turmas"].delete_one({"slug": slug})
    await get_db()["alunos"].delete_many({"class_id": slug})
    return {"message": "Turma e alunos excluídos com sucesso"}

class StudentUpdate(BaseModel):
    nome: str
    usuario: str
    senha: str
    foto: str = ""
    notas: List[int] = []
    presencas: List[str] = []
    comportamentos: List[str] = []
    testes_tentativas: List[int] = []
    badges: List[str] = ["", "", "", ""]
    xp_extra: int = 0

class ClassUpdateSchema(BaseModel):
    nome_turma: str
    alunos: List[StudentUpdate]

@app.put("/api/turmas/{slug}")
async def update_class(slug: str, req: ClassUpdateSchema, admin: Optional[str] = None):
    turma = await get_db()["turmas"].find_one({"slug": slug})
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
        
    if admin and turma.get("admin") and turma.get("admin").lower() != admin.lower():
        raise HTTPException(status_code=403, detail="Acesso negado. Você não pode atualizar uma turma que não criou.")

    await get_db()["turmas"].update_one({"slug": slug}, {"$set": {"nome_turma": req.nome_turma}})
    
    await get_db()["alunos"].delete_many({"class_id": slug})
    
    students_to_insert = []
    for aluno in req.alunos:
        doc = aluno.dict()
        doc["class_id"] = slug
        
        xp = 0
        notas_list = doc.get("notas", [])
        tentativas_list = doc.get("testes_tentativas", [])
        for i, n in enumerate(notas_list):
            t = tentativas_list[i] if i < len(tentativas_list) else 0
            if t <= 3 and n >= 70:
                xp += n
        
        presencas_list = doc.get("presencas", [])
        if not isinstance(presencas_list, list):
            presencas_list = []
        presencas_list = presencas_list[:5]
        doc["presencas"] = presencas_list
        xp += (len(presencas_list) * 50)
        
        for comp in doc.get("comportamentos", []):
            if comp == "bom":
                xp += 10
            elif comp == "mal":
                xp -= 10
                
        for t in doc.get("testes_tentativas", []):
            if t > 0:
                xp += max(0, 100 - ((t - 1) * 50))
                
        xp_extra = doc.get("xp_extra", 0)
        xp_extra = min(10, max(0, xp_extra))
        xp += xp_extra
        doc["xp_extra"] = xp_extra
            
        doc["xp_total"] = xp
        
        doc["badges"] = aluno.badges
        students_to_insert.append(doc)
        
    if students_to_insert:
        await get_db()["alunos"].insert_many(students_to_insert)
        
    return {"message": "Turma e estatísticas iterativas atualizadas com sucesso!"}

class BadgeUpdateSchema(BaseModel):
    badges: List[str]

@app.put("/api/turmas/{slug}/aluno/{nome}/badges")
async def update_student_badges(slug: str, nome: str, req: BadgeUpdateSchema, admin: Optional[str] = None):
    turma = await get_db()["turmas"].find_one({"slug": slug})
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    if admin and turma.get("admin") and turma.get("admin").lower() != admin.lower():
        raise HTTPException(status_code=403, detail="Acesso negado ao editar badges")
        
    res = await get_db()["alunos"].update_one(
        {"class_id": slug, "nome": nome},
        {"$set": {"badges": req.badges}}
    )
    
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Aluno não encontrado na turma especificada")
        
    return {"message": "Badges do aluno atualizados com sucesso", "badges": req.badges}

@app.put("/api/turmas/{slug}/reset")
async def reset_class_data(slug: str, admin: Optional[str] = None):
    turma = await get_db()["turmas"].find_one({"slug": slug})
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
        
    if admin and turma.get("admin") and turma.get("admin").lower() != admin.lower():
        raise HTTPException(status_code=403, detail="Acesso negado ao zerar dados da turma")

    res = await get_db()["alunos"].update_many(
        {"class_id": slug},
        {"$set": {
            "notas": [],
            "presencas": [],
            "comportamentos": [],
            "testes_tentativas": [],
            "badges": ["", "", "", ""],
            "xp_total": 0
        }}
    )
    
    return {"message": "Dados dos alunos zerados com sucesso"}
