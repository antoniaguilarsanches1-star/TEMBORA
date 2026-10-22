"""Contratos responsive para el encabezado de TAVIKU."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class ResponsiveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pillars = (ROOT / 'css' / 'pillars.css').read_text(encoding='utf-8')
        cls.app = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')
        cls.header = (ROOT / 'components' / 'header.html').read_text(encoding='utf-8')

    def test_menu_uses_actual_computed_visibility_on_resize(self):
        self.assertIn("getComputedStyle(hamburger).display", self.app)

    def test_shared_mobile_breakpoint(self):
        self.assertIn('@media (max-width: 1360px)', self.pillars)
        self.assertIn('@media (min-width: 1361px)', self.pillars)
        self.assertIn('.header .nav-menu:not(.active)', self.pillars)

    def test_menu_is_keyboard_operable(self):
        self.assertIn('<button class="hamburger"', self.header)
        self.assertIn('aria-expanded="false"', self.header)
        self.assertIn("event.key === 'Escape'", self.app)

if __name__ == '__main__':
    unittest.main()
