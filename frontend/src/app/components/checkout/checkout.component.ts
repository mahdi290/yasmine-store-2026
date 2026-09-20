import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit {
  cartService = inject(CartService);
  private orderService = inject(OrderService);
  private router = inject(Router);
  protected readonly Math = Math;
  private platformId = inject(PLATFORM_ID);

  // Form Fields for Fast Guest Checkout
  customerName = '';
  phone = '';
  address = '';
  city = '';
  paymentMethod = 'COD';

  loading = signal<boolean>(false);
  success = signal<boolean>(false);
  placedOrder = signal<any | null>(null);

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.cartService.cartItems().length === 0) {
      this.router.navigate(['/cart']);
    }
  }

  onSubmit(event: Event) {
    event.preventDefault();
    if (this.cartService.cartItems().length === 0) {
      if (isPlatformBrowser(this.platformId)) alert('Votre panier est vide.');
      return;
    }

    if (!this.customerName.trim() || !this.phone.trim() || !this.address.trim()) {
      if (isPlatformBrowser(this.platformId)) alert('Veuillez remplir votre nom, téléphone et adresse.');
      return;
    }

    this.loading.set(true);

    const items = this.cartService.cartItems().map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      size: item.size || 'M'
    }));

    const payload = {
      customerName: this.customerName.trim(),
      phone: this.phone.trim(),
      address: this.address.trim(),
      city: this.city.trim() || 'Non spécifié',
      items: items
    };

    this.orderService.placeOrder(payload).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.success.set(true);
        this.placedOrder.set(res.order);
        this.cartService.clearCart();
      },
      error: (err) => {
        this.loading.set(false);
        const msg = typeof err.error === 'string' ? err.error : (err.error?.message || 'Échec de la validation de la commande.');
        if (isPlatformBrowser(this.platformId)) alert(msg);
      }
    });
  }
}
