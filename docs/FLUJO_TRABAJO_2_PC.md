# Trabajar desde 2 computadoras

## Requisito: Git instalado en ambas PCs
https://git-scm.com/download/win

---

## Flujo diario

### Al empezar a trabajar (en cualquier PC)

1. **Actualizar** – Bajá los cambios de la otra PC:
   - Doble clic en `actualizar-desde-git.ps1`
   - O en la terminal: `git pull origin master`

2. **Trabajar** – Editá el código normalmente.

3. **Subir** – Cuando termines:
   - Doble clic en `subir-cambios.ps1`
   - O en la terminal: `git add .` → `git commit -m "mensaje"` → `git push origin master`

---

## Primera vez en esta PC (configuración única)

Si todavía no conectaste esta carpeta al repo:

1. Abrí PowerShell en esta carpeta
2. Ejecutá:
   ```
   git init
   git remote add origin https://github.com/adminbacarsa/omninexus-pro.git
   git pull origin master --allow-unrelated-histories
   ```

---

## Resumen

| Momento | Acción | Script |
|---------|--------|--------|
| Empezar el día | Bajar cambios de la otra PC | `actualizar-desde-git.ps1` |
| Terminar de trabajar | Subir tus cambios | `subir-cambios.ps1` |

**Importante:** Hacé siempre **Actualizar** antes de empezar, así evitás conflictos.
