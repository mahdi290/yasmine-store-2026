import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { ProductService, Product } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.scss']
})
export class ProductDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  // States
  product = signal<Product | null>(null);
  loading = signal<boolean>(true);
  quantity = signal<number>(1);
  selectedSize = signal<string>('M');
  availableSizes = ['S', 'M', 'L', 'XL'];

  selectedSizeStock = computed(() => {
    const prod = this.product();
    if (!prod) return 0;
    const size = this.selectedSize();
    if (prod.sizeStocks && prod.sizeStocks[size] !== undefined) {
      return prod.sizeStocks[size];
    }
    return 0;
  });

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.route.paramMap.subscribe(params => {
        const idStr = params.get('id');
        if (idStr) {
          this.loadProduct(Number(idStr));
        } else {
          this.loadDefaultProduct();
        }
      });
    } else {
      this.loading.set(false);
    }
  }

  loadProduct(id: number) {
    this.productService.getProductById(id).subscribe({
      next: (prod) => {
        this.product.set(prod);
        this.loading.set(false);
      },
      error: () => {
        this.loadDefaultProduct();
      }
    });
  }

  loadDefaultProduct() {
    this.productService.getProducts().subscribe({
      next: (prods) => {
        if (prods.length > 0) {
          this.product.set(prods[0]);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  increaseQty() {
    this.quantity.update(q => q + 1);
  }

  decreaseQty() {
    if (this.quantity() > 1) {
      this.quantity.update(q => q - 1);
    }
  }

  changeSize(size: string) {
    this.selectedSize.set(size);
    this.quantity.set(1);
  }

  addToCart() {
    const prod = this.product();
    if (!prod) return;

    if (!this.authService.isLoggedIn()) {
      alert('Veuillez vous connecter pour ajouter des articles à votre panier.');
      this.router.navigate(['/auth']);
      return;
    }

    if (this.selectedSizeStock() <= 0) {
      alert('Cette taille est actuellement en rupture de stock.');
      return;
    }

    if (this.quantity() > this.selectedSizeStock()) {
      alert(`Seulement ${this.selectedSizeStock()} unités de taille ${this.selectedSize()} sont disponibles.`);
      return;
    }

    this.cartService.addToCart(prod.id, this.quantity(), this.selectedSize()).subscribe({
      next: () => {
        alert(`${this.quantity()} x ${prod.name} ajouté à votre panier !`);
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
}
