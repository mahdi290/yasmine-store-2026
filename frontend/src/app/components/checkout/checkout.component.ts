import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
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
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private router = inject(Router);
  protected readonly Math = Math;
  private platformId = inject(PLATFORM_ID);

  // Form Fields
  address = '';
  city = '';
  zipCode = '';
  country = '';
  paymentMethod = 'COD';

  loading = signal<boolean>(false);
  success = signal<boolean>(false);
  placedOrder = signal<any | null>(null);

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/auth'], { queryParams: { returnUrl: '/checkout', mode: 'login' } });
      return;
    }

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

    this.loading.set(true);

    this.orderService.placeOrder().subscribe({
      next: (res) => {
        this.loading.set(false);
        this.success.set(true);
        this.placedOrder.set(res.order);
        this.cartService.loadCart();
      },
      error: (err) => {
        this.loading.set(false);
        if (isPlatformBrowser(this.platformId)) alert(err.error || 'Échec de la validation de la commande. Veuillez réessayer.');
      }
    });
  }
}
