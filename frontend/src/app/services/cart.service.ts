import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { Product, ProductVariant } from './product.service';
import { DiscountService, computeQuote, effectivePrice, LineQuote } from './discount.service';

export interface CartItem {
  id: number;
  product: Product;
  quantity: number;
  size?: string;
  // Couleur choisie (absente pour un produit sans couleur)
  variantId?: number;
  colorName?: string;
  colorHex?: string | null;
  imageUrl?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly STORAGE_KEY = 'yasmina_guest_cart';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly discountService = inject(DiscountService);

  // State
  cartItems = signal<CartItem[]>([]);

  // Computed states
  cartCount = computed(() => {
    return this.cartItems().reduce((total, item) => total + item.quantity, 0);
  });

  // Prix soldés + remise par quantité (affichage ; le serveur recalcule tout à la commande)
  quote = computed(() => computeQuote(
    this.cartItems().map(item => ({ product: item.product, quantity: item.quantity })),
    this.discountService.activeRules()
  ));

  // Sous-total des articles au prix soldé, avant remise par quantité
  cartSubtotal = computed(() => this.quote().subtotal);
  cartDiscount = computed(() => this.quote().discountAmount);
  cartTotal = computed(() => this.quote().total);

  /** Détail de prix d'une ligne du panier. */
  lineQuote(item: CartItem): LineQuote {
    const idx = this.cartItems().findIndex(i => i.id === item.id);
    return this.quote().lines[idx] ?? {
      unitPrice: effectivePrice(item.product), subtotal: 0, discountPercent: 0, discountAmount: 0, total: 0, ruleId: null
    };
  }

  /** Prix unitaire actuel (soldé si le produit est en solde). */
  unitPrice(product: Product): number {
    return effectivePrice(product);
  }

  constructor() {
    this.loadCart();
  }

  /** Un produit multicolore doit passer par la fiche produit pour choisir sa couleur. */
  needsColorChoice(product: Product): boolean {
    return (product.variants?.length ?? 0) > 1;
  }

  /** Image à afficher pour une ligne de panier (photo de la couleur si disponible). */
  itemImage(item: CartItem): string {
    return item.imageUrl || item.product.imageUrl || item.product.variants?.find(v => v.images?.length)?.images[0] || '';
  }

  loadCart() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) {
          this.cartItems.set(JSON.parse(data));
        } else {
          this.cartItems.set([]);
        }
      } catch (e) {
        this.cartItems.set([]);
      }
    }
  }

  private saveCart(items: CartItem[]) {
    this.cartItems.set(items);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.error('Error saving cart to localStorage', e);
      }
    }
  }

  addToCart(productInput: Product | any, quantity: number = 1, size: string = 'M', variant?: ProductVariant | null): Observable<any> {
    const current = [...this.cartItems()];
    let product: Product;

    if (typeof productInput === 'object' && productInput !== null && productInput.name) {
      product = productInput;
    } else {
      product = {
        id: typeof productInput === 'number' ? productInput : productInput.id,
        name: productInput.name || 'Produit',
        price: productInput.price || 0,
        imageUrl: productInput.imageUrl || '',
        category: productInput.category || { id: 1, name: 'Vêtements' }
      } as Product;
    }

    // Produit avec une seule couleur : elle est choisie d'office
    if (!variant && product.variants?.length === 1) {
      variant = product.variants[0];
    }

    const sizeVal = size || 'M';
    const variantId = variant?.id;
    // Même produit + même couleur + même taille = même ligne ; une autre couleur crée une nouvelle ligne
    const existingIndex = current.findIndex(item =>
      item.product.id === product.id &&
      (item.size || 'M') === sizeVal &&
      (item.variantId ?? null) === (variantId ?? null)
    );

    if (existingIndex > -1) {
      current[existingIndex] = { ...current[existingIndex], quantity: current[existingIndex].quantity + quantity };
    } else {
      current.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        product: product,
        quantity: quantity,
        size: sizeVal,
        variantId: variantId,
        colorName: variant?.colorName,
        colorHex: variant?.colorHex ?? null,
        imageUrl: variant ? (variant.images?.[0] || variant.imageUrl || null) : null
      });
    }

    this.saveCart(current);
    return of({ success: true, items: current });
  }

  updateQuantity(cartItemId: number, quantity: number): Observable<any> {
    let current = [...this.cartItems()];
    if (quantity <= 0) {
      current = current.filter(item => item.id !== cartItemId);
    } else {
      const idx = current.findIndex(item => item.id === cartItemId);
      if (idx > -1) {
        current[idx] = { ...current[idx], quantity };
      }
    }
    this.saveCart(current);
    return of({ success: true, items: current });
  }

  removeFromCart(cartItemId: number): Observable<any> {
    const current = this.cartItems().filter(item => item.id !== cartItemId);
    this.saveCart(current);
    return of({ success: true, items: current });
  }

  /** Remet le panier dans un état précédent (bouton "Annuler" après une suppression). */
  restoreCart(items: CartItem[]) {
    this.saveCart([...items]);
  }

  clearCart(): Observable<any> {
    this.saveCart([]);
    return of({ success: true, items: [] });
  }
}
