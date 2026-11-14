@echo off
rem Garde la fenetre ouverte quoi qu'il arrive
if not "%~1"=="ok" (
  cmd /k ""%~f0" ok"
  exit /b
)
chcp 65001 >nul
cd /d "%~dp0"
echo Dossier : %CD%

if not exist "serveur_traduction.py" goto PAS_DECOMPRESSE

set PY=
py -3 --version >nul 2>nul && set PY=py -3
if not defined PY python --version >nul 2>nul && set PY=python
if not defined PY goto PAS_PYTHON
echo Python trouve :
%PY% --version

%PY% -c "import ctranslate2, sentencepiece" >nul 2>nul
if not errorlevel 1 goto VERIF_ONNX
echo.
echo Installation de ctranslate2 et sentencepiece - une seule fois, internet requis...
%PY% -m pip install ctranslate2 sentencepiece
%PY% -c "import ctranslate2, sentencepiece" >nul 2>nul
if errorlevel 1 goto ECHEC_PIP

:VERIF_ONNX
set OX=
for /d %%D in (modeles_ct2\*) do if exist "%%D\onnx\encoder_model_quantized.onnx" set OX=1
for /d %%D in (modeles_ct2\*) do if exist "%%D\encoder_model_quantized.onnx" set OX=1
if not defined OX goto VERIF_HF
%PY% -c "import onnxruntime, tokenizers" >nul 2>nul
if not errorlevel 1 goto VERIF_HF
echo.
echo Modele ONNX present : installation de onnxruntime et tokenizers - une seule fois, environ 20 Mo...
%PY% -m pip install onnxruntime tokenizers

:VERIF_HF
set HF=
for /d %%D in (modeles_ct2\*) do if exist "%%D\model.safetensors" set HF=1
if not defined HF goto LANCER
%PY% -c "import torch, transformers" >nul 2>nul
if not errorlevel 1 goto LANCER
echo.
echo Un modele model.safetensors est present : installation de torch CPU et transformers - une seule fois, environ 250 Mo...
%PY% -m pip install torch --index-url https://download.pytorch.org/whl/cpu
%PY% -m pip install transformers tokenizers sacremoses protobuf
%PY% -c "import torch, transformers" >nul 2>nul
if errorlevel 1 echo ATTENTION : torch ne s'est pas installe. Les langues en model.safetensors seront ignorees, les autres marchent.

:LANCER
echo.
%PY% serveur_traduction.py
echo.
echo Le serveur s'est arrete. Lisez le message ci-dessus.
goto FIN

:PAS_DECOMPRESSE
echo.
echo ERREUR : serveur_traduction.py introuvable a cote de ce fichier.
echo Faites clic droit sur le zip, puis "Extraire tout", puis lancez LANCER_SERVEUR.bat depuis le dossier extrait.
goto FIN

:PAS_PYTHON
echo.
echo ERREUR : Python n'est pas installe.
echo Installez-le depuis https://www.python.org/downloads/  en cochant "Add python.exe to PATH",
echo puis relancez LANCER_SERVEUR.bat.
goto FIN

:ECHEC_PIP
echo.
echo ERREUR : installation de ctranslate2 impossible. Faites une capture de cette fenetre.
goto FIN

:FIN
echo.
