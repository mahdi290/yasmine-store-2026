import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { CartService, CartItem } from '../../services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent {
  cartService = inject(CartService);
  private router = inject(Router);
  protected readonly Math = Math;

  // Summary State
  couponCode = signal<string>('');
  discount = signal<number>(0);

  // Computed totals
  deliveryCost = computed(() => {
    return this.cartService.cartSubtotal() > 0 ? 7 : 0;
  });

  grandTotal = computed(() => {
    const subtotal = this.cartService.cartSubtotal();
    const delivery = this.deliveryCost();
    const disc = this.discount();
    
    return Math.max(0, Math.round((subtotal + delivery - disc) * 100) / 100);
  });

  increaseQty(item: CartItem) {
    const currentItems = this.cartService.cartItems();
    this.cartService.cartItems.set(
      currentItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
    );
    this.cartService.updateQuantity(item.id, item.quantity + 1).subscribe({
      error: () => {
        this.cartService.cartItems.set(currentItems);
      }
    });
  }

  decreaseQty(item: CartItem) {
    if (item.quantity > 1) {
      const currentItems = this.cartService.cartItems();
      this.cartService.cartItems.set(
        currentItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i)
      );
      this.cartService.updateQuantity(item.id, item.quantity - 1).subscribe({
        error: () => {
          this.cartService.cartItems.set(currentItems);
        }
      });
    } else {
      this.removeItem(item);
    }
  }

  removeItem(item: CartItem) {
    if (confirm(`Voulez-vous retirer ${item.product.name} de votre panier ?`)) {
      const currentItems = this.cartService.cartItems();
      this.cartService.cartItems.set(currentItems.filter(i => i.id !== item.id));

      this.cartService.removeFromCart(item.id).subscribe({
        error: () => {
          this.cartService.cartItems.set(currentItems);
          alert('Impossible de retirer cet article du panier.');
        }
      });
    }
  }

  clearCart() {
    if (confirm('Êtes-vous sûr de vouloir vider votre panier ?')) {
      const currentItems = this.cartService.cartItems();
      this.cartService.cartItems.set([]);
      this.cartService.clearCart().subscribe({
        error: () => {
          this.cartService.cartItems.set(currentItems);
          alert('Impossible de vider le panier.');
        }
      });
    }
  }

  applyCoupon(code: string) {
    if (code.trim().toUpperCase() === 'BIENVENUE10' || code.trim().toUpperCase() === 'WELCOME20') {
      this.discount.set(10);
      alert('Code promo validé ! 10 DT de réduction appliqués.');
    } else {
      alert('Code promo invalide.');
    }
  }

  proceedToCheckout() {
    if (this.cartService.cartItems().length === 0) {
      alert('Votre panier est vide.');
      return;
    }
    this.router.navigate(['/checkout']);
  }
}
