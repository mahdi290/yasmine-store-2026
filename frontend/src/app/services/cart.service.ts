import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { Product } from './product.service';

export interface CartItem {
  id: number;
  product: Product;
  quantity: number;
  size?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly STORAGE_KEY = 'yasmina_guest_cart';
  private readonly platformId = inject(PLATFORM_ID);

  // State
  cartItems = signal<CartItem[]>([]);

  // Computed states
  cartCount = computed(() => {
    return this.cartItems().reduce((total, item) => total + item.quantity, 0);
  });

  cartSubtotal = computed(() => {
    return Math.round(this.cartItems().reduce((total, item) => total + (item.product.price * item.quantity), 0) * 100) / 100;
  });

  constructor() {
    this.loadCart();
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

  addToCart(productInput: Product | any, quantity: number = 1, size: string = 'M'): Observable<any> {
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

    const sizeVal = size || 'M';
    const existingIndex = current.findIndex(item => item.product.id === product.id && (item.size || 'M') === sizeVal);

    if (existingIndex > -1) {
      current[existingIndex].quantity += quantity;
    } else {
      current.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        product: product,
        quantity: quantity,
        size: sizeVal
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
        current[idx].quantity = quantity;
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

  clearCart(): Observable<any> {
    this.saveCart([]);
    return of({ success: true, items: [] });
  }
}
