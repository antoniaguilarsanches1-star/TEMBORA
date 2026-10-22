"""Contract checks for visual primitives shared by TAVIKU pages."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class DesignSystemTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.css = (ROOT / "css" / "styles.css").read_text(encoding="utf-8")
        cls.pillars = (ROOT / "css" / "pillars.css").read_text(encoding="utf-8")
        cls.header = (ROOT / "components" / "header.html").read_text(encoding="utf-8")

    def test_color_and_layout_tokens(self):
        for token in ("--brand-marketplace: #2563eb", "--brand-negocios: #0d9488",
                      "--font-ui:", "--content-width:", "--header-content-width:"):
            self.assertIn(token, self.css)
        self.assertIn("var(--header-content-width)", self.pillars)

    def test_accessibility_primitives(self):
        self.assertIn(":focus-visible", self.css)
        self.assertIn("prefers-reduced-motion", self.css)
        self.assertIn('aria-label="Navegación principal"', self.header)
        self.assertIn('aria-expanded="false"', self.header)

    def test_one_source_header(self):
        self.assertEqual(self.header.count('data-taviku-header'), 1)

if __name__ == "__main__":
    unittest.main()
