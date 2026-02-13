# Guía: Instalar Git y conectar esta PC al repositorio

## Paso 1: Instalar Git

### Opción A – Con winget (rápido, si tenés Windows 10/11)

Abrí **PowerShell** como administrador y ejecutá:

```
winget install --id Git.Git -e --source winget
```

### Opción B – Descarga manual

1. Entrá a: https://git-scm.com/download/win
2. Descargá **Git for Windows** (64-bit)
3. Ejecutá el instalador
4. En las opciones, dejá **"Git from the command line and also from 3rd-party software"**
5. Terminá la instalación

---

## Paso 2: Reiniciar la terminal

Cerrá y volvé a abrir **PowerShell** o **Cursor** para que reconozca Git.

---

## Paso 3: Conectar esta carpeta al repositorio de GitHub

Abrí **PowerShell** en la carpeta del proyecto:

```
cd c:\APP\Ominexus-pro\omninexus-pro
```

Ejecutá estos comandos **uno por uno**:

```powershell
# 1. Inicializar Git
git init

# 2. Conectar con tu repo
git remote add origin https://github.com/adminbacarsa/omninexus-pro.git

# 3. Traer la rama principal (si ya existe)
git fetch origin

# 4. Usar la rama master y hacer el primer pull
git branch -M master
git pull origin master --allow-unrelated-histories
```

Si te pide usuario y contraseña: usá tu **usuario de GitHub** y un **Personal Access Token** (no tu contraseña). Crealo en: https://github.com/settings/tokens

---

## Paso 4: Probar que funciona

```powershell
# Ver el estado
git status

# Debería mostrar tu carpeta conectada al repo
```

---

## Listo

A partir de ahora usá:

- **actualizar-desde-git.ps1** – Antes de trabajar
- **subir-cambios.ps1** – Cuando termines
