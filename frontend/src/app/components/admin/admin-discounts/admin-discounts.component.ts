import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { ProductService, Product, Category } from '../../../services/product.service';
import { DiscountService, DiscountRule, DiscountRuleRequest, DiscountScope, SCOPE_LABELS, effectivePrice, percentForBundle, round2, parseDecimal, formatPercent } from '../../../services/discount.service';

@Component({
  selector: 'app-admin-discounts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-discounts.component.html',
  styleUrls: ['./admin-discounts.component.scss']
})
export class AdminDiscountsComponent implements OnInit {
  private discountService = inject(DiscountService);
  private adminService = inject(AdminService);
  private productService = inject(ProductService);
  private platformId = inject(PLATFORM_ID);

  rules = signal<DiscountRule[]>([]);
  categories = signal<Category[]>([]);
  products = signal<Product[]>([]);
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  modalMode = signal<'add' | 'edit' | 'delete' | 'none'>('none');
  selectedRule = signal<DiscountRule | null>(null);

  readonly scopes: { value: DiscountScope; label: string }[] =
    (Object.keys(SCOPE_LABELS) as DiscountScope[]).map(value => ({ value, label: SCOPE_LABELS[value] }));

  form: DiscountRuleRequest = this.emptyForm();

  // Champs texte : acceptent la virgule ("16,67") comme le point
  percentText = '';

  // Aide "prix du lot" : 2 hauts à 30 DT vendus 50 DT -> 16,67 %
  bundleUnitText = '';
  bundlePriceText = '';

  readonly formatPercent = formatPercent;

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadRules();
      this.productService.getCategories().subscribe({ next: (c) => this.categories.set(c) });
      this.adminService.getProducts().subscribe({ next: (p) => this.products.set(p) });
    } else {
      this.loading.set(false);
    }
  }

  private emptyForm(): DiscountRuleRequest {
    return { label: '', minQuantity: 2, percent: 10, active: true, scope: 'ALL_PRODUCTS', categoryId: null, productId: null };
  }

  private errorText(err: any, fallback: string): string {
    if (err?.status === 401 || err?.status === 403) return 'Session expirée : veuillez vous reconnecter en tant qu\'administrateur.';
    return err?.error?.error || (typeof err?.error === 'string' ? err.error : fallback);
  }

  loadRules() {
    this.loading.set(true);
    this.discountService.getAllRules().subscribe({
      next: (rules) => {
        this.rules.set(rules);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMsg.set(this.errorText(err, 'Impossible de charger les remises.'));
        this.loading.set(false);
      }
    });
  }

  scopeText(rule: DiscountRule): string {
    switch (rule.scope) {
      case 'CART': return 'Tout le panier';
      case 'CATEGORY': return `Catégorie : ${rule.targetName || '?'}`;
      case 'PRODUCT': return `Produit : ${rule.targetName || '?'}`;
      default: return 'Tous les produits (par produit)';
    }
  }

  openAdd() {
    this.form = this.emptyForm();
    if (this.categories().length > 0) this.form.categoryId = this.categories()[0].id;
    this.selectedRule.set(null);
    this.errorMsg.set(null);
    this.percentText = formatPercent(this.form.percent);
    this.resetBundleHelper();
    this.modalMode.set('add');
  }

  openEdit(rule: DiscountRule) {
    this.form = {
      label: rule.label || '',
      minQuantity: rule.minQuantity,
      percent: rule.percent,
      active: rule.active,
      scope: rule.scope,
      categoryId: rule.categoryId ?? (this.categories()[0]?.id ?? null),
      productId: rule.productId ?? null
    };
    this.selectedRule.set(rule);
    this.errorMsg.set(null);
    this.percentText = formatPercent(rule.percent);
    this.resetBundleHelper();
    this.modalMode.set('edit');
  }

  openDelete(rule: DiscountRule) {
    this.selectedRule.set(rule);
    this.modalMode.set('delete');
  }

  closeModal() {
    this.modalMode.set('none');
    this.selectedRule.set(null);
  }

  // Aperçu du message affiché aux clients
  previewLabel(): string {
    if (this.form.label?.trim()) return this.form.label.trim();
    let target = '';
    if (this.form.scope === 'CATEGORY') {
      const cat = this.categories().find(c => c.id === Number(this.form.categoryId));
      target = cat ? ` (${cat.name})` : '';
    } else if (this.form.scope === 'PRODUCT') {
      const prod = this.products().find(p => p.id === Number(this.form.productId));
      target = prod ? ` (${prod.name})` : '';
    }
    const pct = parseDecimal(this.percentText);
    return `Achetez ${this.form.minQuantity || '?'}, économisez ${pct != null ? formatPercent(pct) : '?'}%${target}`;
  }

  private resetBundleHelper() {
    this.bundlePriceText = '';
    this.bundleUnitText = '';
    this.syncBundleUnitPrice();
  }

  /** Prix unitaire de référence : celui du produit choisi (portée "un produit"). */
  syncBundleUnitPrice() {
    if (this.form.scope === 'PRODUCT') {
      const prod = this.products().find(p => p.id === Number(this.form.productId));
      if (prod) this.bundleUnitText = String(effectivePrice(prod));
    }
  }

  bundlePercent(): number | null {
    const unit = parseDecimal(this.bundleUnitText);
    const lot = parseDecimal(this.bundlePriceText);
    if (unit == null || lot == null) return null;
    return percentForBundle(unit, Number(this.form.minQuantity), lot);
  }

  applyBundlePrice() {
    const pct = this.bundlePercent();
    if (pct != null) this.percentText = formatPercent(pct);
  }

  // Vérification affichée : prix normal du lot et prix après remise (même calcul que le panier)
  bundleCheck(): { regular: number; total: number } | null {
    const unit = parseDecimal(this.bundleUnitText) ?? 0;
    const qty = Number(this.form.minQuantity);
    const pct = parseDecimal(this.percentText) ?? 0;
    if (!(unit > 0) || !(qty > 0) || !(pct > 0)) return null;
    const regular = round2(unit * qty);
    return { regular, total: round2(regular - round2(regular * pct / 100)) };
  }

  save() {
    this.errorMsg.set(null);
    this.successMsg.set(null);
    const min = Number(this.form.minQuantity);
    // "16,67", "16.67" ou "16.667" (arrondi automatiquement à 16,67)
    const pct = parseDecimal(this.percentText);
    if (!Number.isInteger(min) || min < 1) {
      this.errorMsg.set('La quantité minimale doit être un nombre entier supérieur ou égal à 1.');
      return;
    }
    if (pct == null || pct < 0.01 || pct > 90) {
      this.errorMsg.set('Le pourcentage doit être un nombre entre 0,01 et 90 (ex. 16,67).');
      return;
    }
    this.form.percent = pct;
    this.percentText = formatPercent(pct);
    if (this.form.scope === 'CATEGORY' && !this.form.categoryId) {
      this.errorMsg.set('Veuillez choisir une catégorie.');
      return;
    }
    if (this.form.scope === 'PRODUCT' && !this.form.productId) {
      this.errorMsg.set('Veuillez choisir un produit.');
      return;
    }

    const payload: DiscountRuleRequest = {
      ...this.form,
      minQuantity: min,
      percent: pct,
      categoryId: this.form.scope === 'CATEGORY' ? Number(this.form.categoryId) : null,
      productId: this.form.scope === 'PRODUCT' ? Number(this.form.productId) : null
    };

    this.saving.set(true);
    const editing = this.selectedRule();
    const request = editing ? this.discountService.updateRule(editing.id, payload) : this.discountService.createRule(payload);
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.rules.update(list => editing ? list.map(r => r.id === saved.id ? saved : r) : [...list, saved]);
        this.successMsg.set(editing ? 'Remise mise à jour avec succès.' : 'Remise créée avec succès.');
        this.discountService.refreshActiveRules();
        this.closeModal();
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(this.errorText(err, 'Échec de l\'enregistrement de la remise.'));
      }
    });
  }

  toggle(rule: DiscountRule) {
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.discountService.toggleRule(rule.id).subscribe({
      next: (saved) => {
        this.rules.update(list => list.map(r => r.id === saved.id ? saved : r));
        this.successMsg.set(saved.active ? 'Remise activée.' : 'Remise désactivée.');
        this.discountService.refreshActiveRules();
      },
      error: (err) => this.errorMsg.set(this.errorText(err, 'Impossible de modifier la remise.'))
    });
  }

  confirmDelete() {
    const rule = this.selectedRule();
    if (!rule) return;
    this.discountService.deleteRule(rule.id).subscribe({
      next: () => {
        this.rules.update(list => list.filter(r => r.id !== rule.id));
        this.successMsg.set('Remise supprimée.');
        this.discountService.refreshActiveRules();
        this.closeModal();
      },
      error: (err) => {
        this.errorMsg.set(this.errorText(err, 'Impossible de supprimer la remise.'));
        this.closeModal();
      }
    });
  }
}
