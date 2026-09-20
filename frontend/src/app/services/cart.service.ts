import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Product } from './product.service';
import { AuthService } from './auth.service';

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
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = 'http://localhost:8081/api/cart';

  // State
  cartItems = signal<CartItem[]>([]);

  // Computed states
  cartCount = computed(() => {
    return this.cartItems().reduce((total, item) => total + item.quantity, 0);
  });

  cartSubtotal = computed(() => {
    return this.cartItems().reduce((total, item) => total + (item.product.price * item.quantity), 0);
  });

  constructor() {
    // Automatically load or clear cart based on user session state
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.loadCart();
      } else {
        this.cartItems.set([]);
      }
    });
  }

  loadCart() {
    this.http.get<CartItem[]>(this.apiUrl).subscribe({
      next: (items) => this.cartItems.set(items),
      error: () => this.cartItems.set([])
    });
  }

  addToCart(productId: number, quantity: number = 1, size: string = 'M'): Observable<any> {
    return this.http.post(this.apiUrl, { productId, quantity, size }).pipe(
      tap(() => this.loadCart())
    );
  }

  updateQuantity(cartItemId: number, quantity: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${cartItemId}`, null, {
      params: { quantity: quantity.toString() }
    }).pipe(
      tap(() => this.loadCart())
    );
  }

  removeFromCart(cartItemId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${cartItemId}`, { responseType: 'text' }).pipe(
      tap(() => this.loadCart())
    );
  }

  clearCart(): Observable<any> {
    return this.http.delete(this.apiUrl, { responseType: 'text' }).pipe(
      tap(() => this.loadCart())
    );
  }
}
