#!/usr/bin/env python3
"""Genera HTML estático para GitHub Pages a partir de componentes compartidos."""
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
MARKER = "<!-- TAVIKU:HEADER -->"
HEADER = (ROOT / "components" / "header.html").read_text(encoding="utf-8")
if DIST.exists():
    shutil.rmtree(DIST)
DIST.mkdir()
for item in ROOT.iterdir():
    if item.name in {".git", ".github", "dist", "docs", "scripts", "components", "tests", "node_modules"}:
        continue
    target = DIST / item.name
    if item.is_dir():
        shutil.copytree(item, target)
    elif item.suffix == ".html":
        data = item.read_text(encoding="utf-8")
        if "<header" in data.lower() and MARKER not in data:
            raise SystemExit(f"Encabezado antiguo sin migrar: {item.name}")
        if MARKER in data:
            if data.count(MARKER) != 1:
                raise SystemExit(f"Marcador duplicado: {item.name}")
            data = data.replace(MARKER, HEADER)
        target.write_text(data, encoding="utf-8")
    else:
        shutil.copy2(item, target)
files = list(DIST.glob("*.html"))
for file in files:
    data = file.read_text(encoding="utf-8")
    if MARKER in data:
        raise SystemExit(f"Marcador sin procesar: {file.name}")
if sum("data-taviku-header" in p.read_text(encoding="utf-8") for p in files) < 19:
    raise SystemExit("Menos de 19 paginas con encabezado generado")
print(f"Sitio generado en dist/: {len(files)} paginas HTML")
