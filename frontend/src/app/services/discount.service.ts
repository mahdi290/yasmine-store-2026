import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Product } from './product.service';

export type DiscountScope = 'ALL_PRODUCTS' | 'CART' | 'CATEGORY' | 'PRODUCT';

export interface DiscountRule {
  id: number;
  label?: string | null;
  displayLabel: string;
  minQuantity: number;
  percent: number;
  active: boolean;
  scope: DiscountScope;
  categoryId?: number | null;
  productId?: number | null;
  targetName?: string | null;
}

export interface DiscountRuleRequest {
  label?: string | null;
  minQuantity: number;
  percent: number;
  active: boolean;
  scope: DiscountScope;
  categoryId?: number | null;
  productId?: number | null;
}

export interface PricingLine {
  product: Product;
  quantity: number;
  // Prix unitaire imposé (ex. commande existante) ; sinon prix actuel soldé
  unitPrice?: number;
}

export interface LineQuote {
  unitPrice: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  ruleId: number | null;
}

export interface AppliedDiscount {
  ruleId: number;
  label: string;
  percent: number;
  quantity: number;
  amount: number;
}

export interface Quote {
  lines: LineQuote[];
  subtotal: number;
  discountAmount: number;
  total: number;
  discounts: AppliedDiscount[];
}

export const SCOPE_LABELS: Record<DiscountScope, string> = {
  ALL_PRODUCTS: 'Tous les produits (quantités comptées par produit, toutes couleurs confondues)',
  CART: 'Tout le panier (toutes les quantités additionnées)',
  CATEGORY: 'Une catégorie (tous ses produits additionnés)',
  PRODUCT: 'Un produit précis (toutes couleurs confondues)'
};

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Prix unitaire actuel : prix soldé si le produit est en solde (même calcul que Product.getSalePrice côté serveur). */
export function effectivePrice(product: Product): number {
  if (product.onSale && product.discountPercent && product.discountPercent > 0) {
    return round2(product.price * (100 - product.discountPercent) / 100);
  }
  return product.price;
}

/**
 * Calcul identique à PricingService (backend) : quantités additionnées selon la portée,
 * meilleure règle par ligne, pas de cumul. Sert uniquement à l'affichage : le total
 * réellement facturé est recalculé par le serveur au moment de la commande.
 */
export function computeQuote(lines: PricingLine[], rules: DiscountRule[]): Quote {
  const n = lines.length;
  const bestPercent = new Array<number>(n).fill(0);
  const bestRule = new Array<DiscountRule | null>(n).fill(null);

  for (const rule of rules) {
    if (!rule.active || rule.minQuantity < 1 || rule.percent <= 0 || rule.percent >= 100) continue;
    for (const group of groupsFor(rule, lines)) {
      const qty = group.reduce((sum, i) => sum + lines[i].quantity, 0);
      if (qty < rule.minQuantity) continue;
      for (const i of group) {
        if (rule.percent > bestPercent[i]) {
          bestPercent[i] = rule.percent;
          bestRule[i] = rule;
        }
      }
    }
  }

  const result: LineQuote[] = [];
  const applied = new Map<number, AppliedDiscount>();
  let subtotal = 0;
  let discount = 0;

  lines.forEach((line, i) => {
    const unit = round2(line.unitPrice ?? effectivePrice(line.product));
    const lineSubtotal = round2(unit * line.quantity);
    const lineDiscount = round2(lineSubtotal * bestPercent[i] / 100);
    const rule = bestRule[i];
    result.push({
      unitPrice: unit,
      subtotal: lineSubtotal,
      discountPercent: bestPercent[i],
      discountAmount: lineDiscount,
      total: round2(lineSubtotal - lineDiscount),
      ruleId: rule?.id ?? null
    });
    subtotal += lineSubtotal;
    discount += lineDiscount;
    if (rule) {
      const a = applied.get(rule.id) ?? { ruleId: rule.id, label: rule.displayLabel, percent: rule.percent, quantity: 0, amount: 0 };
      a.quantity += line.quantity;
      a.amount = round2(a.amount + lineDiscount);
      applied.set(rule.id, a);
    }
  });

  return {
    lines: result,
    subtotal: round2(subtotal),
    discountAmount: round2(discount),
    total: round2(subtotal - discount),
    discounts: [...applied.values()]
  };
}

function groupsFor(rule: DiscountRule, lines: PricingLine[]): number[][] {
  const idx = lines.map((_, i) => i);
  switch (rule.scope) {
    case 'CART':
      return [idx];
    case 'CATEGORY':
      return [idx.filter(i => lines[i].product.category?.id === rule.categoryId)];
    case 'PRODUCT':
      return [idx.filter(i => lines[i].product.id === rule.productId)];
    default: {
      const byProduct = new Map<number, number[]>();
      idx.forEach(i => {
        const id = lines[i].product.id;
        byProduct.set(id, [...(byProduct.get(id) ?? []), i]);
      });
      return [...byProduct.values()];
    }
  }
}

/** 10 -> "10", 16.67 -> "16,67" (affichage français). */
export function formatPercent(value: number | null | undefined): string {
  const v = round2(Number(value) || 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '').replace('.', ',');
}

/** 50 -> "50", 50.4 -> "50.40" (même notation que les autres prix du site). */
export function formatPrice(value: number | null | undefined): string {
  const v = round2(Number(value) || 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/** Lit "16,67", "16.67", "30" ou "16,667" (arrondi à 2 décimales) ; null si invalide. */
export function parseDecimal(raw: unknown): number | null {
  const text = String(raw ?? '').trim().replace(/\s|%/g, '').replace(',', '.');
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? round2(value) : null;
}

export interface OfferProgress {
  rule: DiscountRule;
  // Articles déjà comptés pour cette offre / articles manquants
  current: number;
  missing: number;
}

/**
 * Offres presque atteintes : "ajoutez encore 1 article pour profiter de -16,67 %".
 * Si `product` est fourni, ne regarde que les offres qui concernent ce produit.
 */
export function offerProgress(lines: PricingLine[], rules: DiscountRule[], product?: Product): OfferProgress[] {
  const result: OfferProgress[] = [];
  const candidates = product ? rulesForProduct(product, rules) : rules.filter(r => r.active);
  for (const rule of candidates) {
    let groups = groupsFor(rule, lines).filter(g => g.length > 0);
    if (product && rule.scope === 'ALL_PRODUCTS') {
      groups = groups.filter(g => lines[g[0]].product.id === product.id);
    }
    if (groups.length === 0 && product) {
      result.push({ rule, current: 0, missing: rule.minQuantity });
      continue;
    }
    for (const g of groups) {
      const current = g.reduce((sum, i) => sum + lines[i].quantity, 0);
      if (current < rule.minQuantity) {
        result.push({ rule, current, missing: rule.minQuantity - current });
      }
    }
  }
  return result.sort((a, b) => a.missing - b.missing);
}

/** Exemple chiffré d'une offre pour un produit : "2 pour 50 DT au lieu de 60 DT". */
export function offerExample(product: Product, rule: DiscountRule): { quantity: number; total: number; regular: number } {
  const q = computeQuote([{ product, quantity: rule.minQuantity }], [rule]);
  return { quantity: rule.minQuantity, total: q.total, regular: q.subtotal };
}

/**
 * Pourcentage à saisir pour obtenir un prix de lot (ex. 2 hauts à 30 DT vendus 50 DT -> 16.67 %).
 * Arrondi à 2 décimales : la remise est calculée au centime, donc 2 x 30 DT donnent bien 50,00 DT.
 */
export function percentForBundle(unitPrice: number, quantity: number, bundlePrice: number): number | null {
  const regular = unitPrice * quantity;
  if (!(regular > 0) || !(bundlePrice > 0) || bundlePrice >= regular) return null;
  return round2((1 - bundlePrice / regular) * 100);
}

/** Règles qui peuvent s'appliquer à ce produit (pour le message "Achetez 2, économisez 10%"). */
export function rulesForProduct(product: Product, rules: DiscountRule[]): DiscountRule[] {
  return rules
    .filter(r => r.active)
    .filter(r => r.scope === 'ALL_PRODUCTS' || r.scope === 'CART'
      || (r.scope === 'CATEGORY' && product.category?.id === r.categoryId)
      || (r.scope === 'PRODUCT' && product.id === r.productId))
    .sort((a, b) => a.minQuantity - b.minQuantity || b.percent - a.percent);
}

@Injectable({
  providedIn: 'root'
})
export class DiscountService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = environment.apiUrl;

  // Règles actives (chargées une fois au démarrage, rechargeables après une modification admin)
  activeRules = signal<DiscountRule[]>([]);

  constructor() {
    this.refreshActiveRules();
  }

  refreshActiveRules() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.http.get<DiscountRule[]>(`${this.apiUrl}/discount-rules`).subscribe({
      next: (rules) => this.activeRules.set(rules || []),
      error: () => this.activeRules.set([])
    });
  }

  // ---- Admin ----
  getAllRules(): Observable<DiscountRule[]> {
    return this.http.get<DiscountRule[]>(`${this.apiUrl}/admin/discount-rules`);
  }

  createRule(rule: DiscountRuleRequest): Observable<DiscountRule> {
    return this.http.post<DiscountRule>(`${this.apiUrl}/admin/discount-rules`, rule);
  }

  updateRule(id: number, rule: DiscountRuleRequest): Observable<DiscountRule> {
    return this.http.put<DiscountRule>(`${this.apiUrl}/admin/discount-rules/${id}`, rule);
  }

  toggleRule(id: number): Observable<DiscountRule> {
    return this.http.patch<DiscountRule>(`${this.apiUrl}/admin/discount-rules/${id}/toggle`, {});
  }

  deleteRule(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/discount-rules/${id}`);
  }
}
