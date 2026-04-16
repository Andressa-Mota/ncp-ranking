@echo off
echo Iniciando o Servidor do Ranking NCP...
cd backend
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
pause
