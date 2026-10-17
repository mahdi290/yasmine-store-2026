import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { CartService, CartItem } from '../../services/cart.service';
import { ToastService } from '../../services/toast.service';
import { DiscountService, offerProgress, formatPercent, formatPrice } from '../../services/discount.service';

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
  private toast = inject(ToastService);
  private discountService = inject(DiscountService);
  protected readonly formatPercent = formatPercent;
  protected readonly formatPrice = formatPrice;

  // Offres pas encore atteintes pour les articles du panier (ex. "ajoutez encore 1 haut")
  offerHints = computed(() => offerProgress(
    this.cartService.cartItems().map(i => ({ product: i.product, quantity: i.quantity })),
    this.discountService.activeRules()
  ).filter(p => p.current > 0).slice(0, 2));
  protected readonly Math = Math;

  // Summary State
  couponCode = signal<string>('');
  discount = signal<number>(0);

  // Computed totals
  deliveryCost = computed(() => {
    return this.cartService.cartSubtotal() > 0 ? 7 : 0;
  });

  grandTotal = computed(() => {
    const total = this.cartService.cartTotal();
    const delivery = this.deliveryCost();
    const disc = this.discount();

    return Math.max(0, Math.round((total + delivery - disc) * 100) / 100);
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

  // Pas de fenêtre de confirmation bloquante : suppression immédiate + bouton "Annuler"
  removeItem(item: CartItem) {
    const previous = this.cartService.cartItems();
    this.cartService.removeFromCart(item.id).subscribe();
    const color = item.colorName ? ` (${item.colorName})` : '';
    this.toast.info(`${item.product.name}${color} retiré du panier.`, {
      actionLabel: 'Annuler',
      action: () => this.cartService.restoreCart(previous)
    });
  }

  clearCart() {
    const previous = this.cartService.cartItems();
    this.cartService.clearCart().subscribe();
    this.toast.info('Panier vidé.', {
      actionLabel: 'Annuler',
      action: () => this.cartService.restoreCart(previous)
    });
  }

  applyCoupon(code: string) {
    if (code.trim().toUpperCase() === 'BIENVENUE10' || code.trim().toUpperCase() === 'WELCOME20') {
      this.discount.set(10);
      this.toast.success('Code promo validé ! 10 DT de réduction appliqués.');
    } else {
      this.toast.error('Code promo invalide.');
    }
  }

  proceedToCheckout() {
    if (this.cartService.cartItems().length === 0) {
      this.toast.info('Votre panier est vide.');
      return;
    }
    this.router.navigate(['/checkout']);
  }
}
