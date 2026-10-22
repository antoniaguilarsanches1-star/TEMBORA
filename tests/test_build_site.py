"""Pruebas del generador estatico sin tocar Supabase ni produccion."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class SiteBuildTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for dirname in ("scripts", "components", "css", "js"):
            (self.root / dirname).mkdir()
        (self.root / "scripts" / "build_site.py").write_text(
            (ROOT / "scripts" / "build_site.py").read_text(encoding="utf-8"), encoding="utf-8")
        (self.root / "components" / "header.html").write_text(
            '<header data-taviku-header>Menu</header>', encoding="utf-8")
        (self.root / "css" / "styles.css").write_text("body{}", encoding="utf-8")
        (self.root / "js" / "app.js").write_text("", encoding="utf-8")
        (self.root / "js" / "supabase.js").write_text("", encoding="utf-8")
        for i in range(19):
            name = ["index.html", "catalogo.html", "login.html", "registro.html",
                    "panel-comprador.html", "panel-vendedor.html", "admin.html"][i] if i < 7 else f"page-{i}.html"
            (self.root / name).write_text(
                '<!doctype html><link href="css/styles.css" rel="stylesheet">'
                '<script src="js/app.js"></script>'
                '<!-- TAVIKU:HEADER -->', encoding="utf-8")
    def build(self):
        return subprocess.run([sys.executable, str(self.root / "scripts" / "build_site.py")],
                              cwd=self.root, capture_output=True, text=True)
    def test_generates_shared_header_for_19_pages(self):
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(len(list((self.root / "dist").glob("*.html"))), 19)
        self.assertIn('data-taviku-header', (self.root / "dist" / "index.html").read_text())
        self.assertNotIn("TAVIKU:HEADER", (self.root / "dist" / "index.html").read_text())
    def test_rejects_legacy_header(self):
        (self.root / "index.html").write_text("<header>Antiguo</header>", encoding="utf-8")
        self.assertNotEqual(self.build().returncode, 0)
    def test_rejects_double_placeholder(self):
        (self.root / "index.html").write_text("<!-- TAVIKU:HEADER -->" * 2, encoding="utf-8")
        self.assertNotEqual(self.build().returncode, 0)

if __name__ == "__main__":
    unittest.main()
