"""Contratos estáticos para interacciones públicas sin ejecutar operaciones reales."""
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
class FrontendContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=(ROOT/'js/app.js').read_text(encoding='utf-8')
        cls.public=(ROOT/'js/public.js').read_text(encoding='utf-8')
        cls.auth=(ROOT/'js/supabase.js').read_text(encoding='utf-8')
        cls.business=(ROOT/'js/business.js').read_text(encoding='utf-8')
        cls.market=(ROOT/'js/mercado-ui.js').read_text(encoding='utf-8')
    def test_menu_has_single_owner(self):
        self.assertIn("function initNavigation()",self.app)
        self.assertNotIn("menu.addEventListener('click'",self.public)
        self.assertIn("aria-expanded",self.app)
    def test_public_optional_nodes_are_checked(self):
        self.assertIn("if (status && retry)",self.public)
        self.assertIn("if (sellerChoice)",self.public)
        self.assertIn("if (!select ||",self.public)
    def test_business_optional_ui_guards(self):
        self.assertIn("if (!root || !status) return;",self.business)
        self.assertIn("if (retry) retry.hidden = true;",self.business)
        self.assertIn("if (retry) retry.hidden = false;",self.business)
        self.assertIn("?.selectedOptions?.[0]?.textContent",self.business)

    def test_market_optional_controls(self):
        self.assertIn("document.getElementById('market-reload')?.addEventListener",self.market)
        self.assertIn("searchCatalog?.addEventListener",self.market)
        self.assertIn("document.getElementById('apply-filters')?.addEventListener",self.market)

    def test_roles_remain_centralized(self):
        for role in ("comprador: 'panel-comprador.html'","vendedor: 'panel-vendedor.html'","admin: 'admin.html'"):
            self.assertIn(role,self.auth)
if __name__=='__main__':
    unittest.main()
