import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ProductService, Product, Category } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  // States
  categories = signal<Category[]>([]);
  products = signal<Product[]>([]);
  loading = signal<boolean>(true);

  // Bottom columns lists
  trendingItems = signal<any[]>([]);
  bestSellersItems = signal<any[]>([]);
  featuredItems = signal<any[]>([]);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
    }
  }

  loadData() {
    this.productService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats)
    });

    this.productService.getProducts().subscribe({
      next: (prods) => {
        this.products.set(prods);
        this.setupHighlights(prods);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  setupHighlights(prods: Product[]) {
    if (prods.length > 0) {
      this.trendingItems.set(prods.slice(0, 3));
      this.bestSellersItems.set(prods.slice(Math.min(2, prods.length - 1), Math.min(5, prods.length)));
      this.featuredItems.set(prods.slice(Math.max(0, prods.length - 3), prods.length));
    }
  }

  addToCart(product: Product, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.authService.isLoggedIn()) {
      alert('Veuillez vous connecter pour ajouter des articles à votre panier.');
      this.router.navigate(['/auth']);
      return;
    }

    this.cartService.addToCart(product.id, 1).subscribe({
      next: () => {
        alert(`${product.name} a été ajouté à votre panier !`);
      },
      error: (err) => {
        if (err.status === 401 || err.status === 403) {
          alert('Veuillez vous connecter pour ajouter des articles à votre panier.');
          this.router.navigate(['/auth']);
        } else {
          alert('Impossible d’ajouter l’article au panier. Veuillez réessayer.');
        }
      }
    });
  }

  getBadge(index: number): { text: string; type: string } | null {
    switch (index % 4) {
      case 0: return { text: 'ÉDITION LIMITÉE', type: 'limited' };
      case 1: return { text: '-25%', type: 'discount' };
      case 2: return { text: 'NOUVEAUTÉ', type: 'new' };
      case 3: return { text: 'TENDANCE', type: 'trending' };
      default: return null;
    }
  }

  getOriginalPrice(price: number, index: number): number | null {
    if (index % 4 === 1) {
      return Math.round(price / 0.75 * 100) / 100;
    }
    return null;
  }

  getCategoryIdByName(name: string): number | null {
    const found = this.categories().find(c => c.name.toLowerCase() === name.toLowerCase());
    return found ? found.id : null;
  }
}
