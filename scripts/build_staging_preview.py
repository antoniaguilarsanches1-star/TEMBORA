#!/usr/bin/env python3
"""Genera una copia LOCAL aislada para probar TAVIKU Staging; nunca publica."""
from pathlib import Path
import re
import runpy
import shutil

ROOT = Path(__file__).resolve().parents[1]
PROD_REF = "fhowcuxyokkrbttgyrwy"
STAGE_REF = "fetoxbjzbteeuzppvxik"
PROD_KEY = "sb_publishable_Yl0EkyykwZ_S4N52w3RaIA_RgBYXUI4"
STAGE_KEY = "sb_publishable_HhNsYkiSNnJ1b0O9s2atIw_HBe-6TID"
DEST = ROOT / "dist-staging"

runpy.run_path(str(ROOT / "scripts" / "build_site.py"))
if DEST.exists():
    shutil.rmtree(DEST)
shutil.copytree(ROOT / "dist", DEST)
changed = 0
for f in DEST.rglob("*"):
    if not f.is_file() or f.suffix not in {".html", ".js", ".css", ".json", ".xml", ".txt"}:
        continue
    data = f.read_text(encoding="utf-8")
    updated = data.replace(PROD_REF, STAGE_REF).replace(PROD_KEY, STAGE_KEY)
    if updated != data:
        f.write_text(updated, encoding="utf-8")
        changed += 1
for f in DEST.rglob("*"):
    if f.is_file() and f.suffix in {".html", ".js", ".css", ".json", ".xml", ".txt"}:
        data = f.read_text(encoding="utf-8")
        if PROD_REF in data or PROD_KEY in data:
            raise SystemExit(f"ERROR: referencia a producción sin reemplazar: {f.relative_to(DEST)}")
client = (DEST / "js" / "supabase.js").read_text(encoding="utf-8")
if STAGE_REF not in client or STAGE_KEY not in client:
    raise SystemExit("ERROR: cliente Supabase Staging no configurado")
banner = '<div role="status" style="padding:10px;text-align:center;background:#ffedd5;color:#7c2d12;font:600 14px Arial,sans-serif">PRUEBAS LOCALES — TAVIKU STAGING — No usar cuentas ni pagos reales</div>'
for f in DEST.glob("*.html"):
    data = f.read_text(encoding="utf-8")
    updated, n = re.subn(r"(<body\\b[^>]*>)", lambda m: m.group(1) + "\\n" + banner, data, count=1, flags=re.I)
    if n:
        f.write_text(updated, encoding="utf-8")
print(f"Vista de prueba creada: dist-staging/ ({changed} archivos ajustados)")
print("Ejecuta: py -m http.server 8001 --directory dist-staging")
