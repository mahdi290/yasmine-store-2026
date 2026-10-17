import { computeQuote, DiscountRule, effectivePrice, offerExample, percentForBundle, rulesForProduct } from './discount.service';
import { Product } from './product.service';

const pull = { id: 1, name: 'Pull rayé', price: 80, category: { id: 10, name: 'Pulls' } } as Product;
const pullSolde = { ...pull, id: 2, onSale: true, discountPercent: 10 } as Product;
const robe = { id: 3, name: 'Robe', price: 100, category: { id: 20, name: 'Robes' } } as Product;

const rule = (r: Partial<DiscountRule>): DiscountRule => ({
  id: 1, displayLabel: 'Achetez 2, économisez 10%', minQuantity: 2, percent: 10, active: true, scope: 'ALL_PRODUCTS', ...r
});

describe('computeQuote (remise par quantité)', () => {
  it('additionne les couleurs d\'un même produit : 1 pull blanc + 1 pull rouge = 2 pulls -> -10%', () => {
    const q = computeQuote([{ product: pull, quantity: 1 }, { product: pull, quantity: 1 }], [rule({})]);
    expect(q.subtotal).toBe(160);
    expect(q.discountAmount).toBe(16);
    expect(q.total).toBe(144);
    expect(q.lines.every(l => l.discountPercent === 10)).toBe(true);
    expect(q.discounts[0].quantity).toBe(2);
  });

  it('pas de remise sous la quantité minimale', () => {
    const q = computeQuote([{ product: pull, quantity: 1 }], [rule({})]);
    expect(q.discountAmount).toBe(0);
    expect(q.discounts.length).toBe(0);
  });

  it('portée catégorie : seuls les produits de la catégorie comptent', () => {
    const r = rule({ scope: 'CATEGORY', categoryId: 10 });
    expect(computeQuote([{ product: pull, quantity: 1 }, { product: robe, quantity: 1 }], [r]).discountAmount).toBe(0);
    const q = computeQuote([{ product: pull, quantity: 1 }, { product: pullSolde, quantity: 1 }, { product: robe, quantity: 1 }], [r]);
    expect(q.lines.map(l => l.discountPercent)).toEqual([10, 10, 0]);
  });

  it('applique la remise sur le prix soldé et garde la meilleure règle sans cumul', () => {
    expect(effectivePrice(pullSolde)).toBe(72);
    const q = computeQuote([{ product: pullSolde, quantity: 3 }], [rule({}), rule({ id: 2, minQuantity: 3, percent: 15, scope: 'CART' })]);
    expect(q.subtotal).toBe(216);
    expect(q.discountAmount).toBe(32.4);
    expect(q.discounts.map(d => d.ruleId)).toEqual([2]);
  });

  it('ignore les règles désactivées', () => {
    expect(computeQuote([{ product: pull, quantity: 5 }], [rule({ active: false })]).discountAmount).toBe(0);
  });

  it('offre duo : 1 haut 30 DT, 2 hauts (bleu + bordeaux) 50 DT au lieu de 60 DT', () => {
    const haut = { id: 7, name: 'Haut rayé', price: 30, category: { id: 10, name: 'Hauts' } } as Product;
    const percent = percentForBundle(30, 2, 50);
    expect(percent).toBe(16.67);
    const duo = rule({ scope: 'PRODUCT', productId: 7, percent: percent! });
    expect(computeQuote([{ product: haut, quantity: 1 }], [duo]).total).toBe(30);
    const q = computeQuote([{ product: haut, quantity: 1 }, { product: haut, quantity: 1 }], [duo]);
    expect(q.subtotal).toBe(60);
    expect(q.discountAmount).toBe(10);
    expect(q.total).toBe(50);
    expect(offerExample(haut, duo)).toEqual({ quantity: 2, total: 50, regular: 60 });
  });

  it('liste les offres visibles sur la fiche produit', () => {
    const rules = [rule({ scope: 'CATEGORY', categoryId: 20 }), rule({ id: 2, scope: 'PRODUCT', productId: 1 })];
    expect(rulesForProduct(pull, rules).map(r => r.id)).toEqual([2]);
  });
});
