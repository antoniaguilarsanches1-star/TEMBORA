#!/usr/bin/env python3
"""Comprobación inicial del sitio estático TAVIKU (no sustituye pruebas E2E)."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys

root = Path(__file__).resolve().parents[1] / "dist"
required = ["index.html", "catalogo.html", "login.html", "registro.html",
            "panel-comprador.html", "panel-vendedor.html", "admin.html",
            "css/styles.css", "js/app.js", "js/supabase.js"]
missing = [p for p in required if not (root / p).is_file()]
for p in missing:
    print("ERROR: archivo fundamental ausente:", p)

warnings = []
total = 0
pattern = re.compile(r'<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["\']([^"\']+)["\']', re.I)
pages = list(root.glob("*.html"))
if len(pages) < 19:
    print("ERROR: hay menos de 19 paginas construidas")
    missing.append("paginas construidas")
for page in pages:
    for ref in pattern.findall(page.read_text(encoding="utf-8")):
        target = urlsplit(ref)
        if target.scheme or target.netloc or not target.path or target.path.startswith(("data:", "#", "//")):
            continue
        dest = (root / unquote(target.path).lstrip("/")) if target.path.startswith("/") else page.parent / unquote(target.path)
        total += 1
        if not dest.is_file():
            warnings.append(f"{page.name}: referencia no encontrada: {ref}")
for item in warnings:
    print("AVISO:", item)
print(f"Revisadas {total} referencias locales; {len(warnings)} avisos; {len(missing)} archivos fundamentales faltantes.")
print("La validación de permisos, pagos, UX y responsive requiere pruebas adicionales.")
sys.exit(1 if missing or warnings else 0)
