import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WishlistService } from '../../services/wishlist.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../services/product.service';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './favorites.component.html',
  styleUrls: ['./favorites.component.scss']
})
export class FavoritesComponent implements OnInit {
  wishlistService = inject(WishlistService);
  cartService = inject(CartService);
  private platformId = inject(PLATFORM_ID);

  favoriteProducts = signal<Product[]>([]);
  loading = signal<boolean>(true);
  addedToastProductId = signal<number | null>(null);

  ngOnInit() {
    this.loadFavorites();
  }

  loadFavorites() {
    if (isPlatformBrowser(this.platformId)) {
      this.loading.set(true);
      this.wishlistService.getFavoriteProducts().subscribe({
        next: (products) => {
          this.favoriteProducts.set(products);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        }
      });
    } else {
      this.loading.set(false);
    }
  }

  removeFromWishlist(product: Product, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.wishlistService.removeFavorite(product.id);
    this.favoriteProducts.update(list => list.filter(p => p.id !== product.id));
  }

  addToCart(product: Product, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.cartService.addToCart(product, 1, 'M');
    this.addedToastProductId.set(product.id);
    setTimeout(() => {
      this.addedToastProductId.set(null);
    }, 2000);
  }

  getEffectivePrice(product: Product): number {
    if (product.onSale && product.discountPercent && product.discountPercent > 0) {
      return Number((product.price * (100 - product.discountPercent) / 100).toFixed(2));
    }
    return product.price;
  }
}
