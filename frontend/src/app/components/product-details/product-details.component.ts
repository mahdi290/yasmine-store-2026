import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { ProductService, Product, ProductVariant } from '../../services/product.service';
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
  selectedVariantId = signal<number | null>(null);
  selectedImage = signal<string | null>(null);
  availableSizes = ['S', 'M', 'L', 'XL'];

  variants = computed<ProductVariant[]>(() => this.product()?.variants ?? []);

  selectedVariant = computed<ProductVariant | null>(() => {
    const id = this.selectedVariantId();
    return this.variants().find(v => v.id === id) ?? null;
  });

  // Photos de la couleur choisie (ou photo du produit pour les produits sans couleur)
  galleryImages = computed<string[]>(() => {
    const prod = this.product();
    if (!prod) return [];
    const variant = this.selectedVariant();
    if (variant && variant.images?.length) return variant.images;
    return prod.imageUrl ? [prod.imageUrl] : [];
  });

  displayedImage = computed(() => this.selectedImage() || this.galleryImages()[0] || this.product()?.imageUrl || '');

  // Stock par taille de la couleur choisie (ou du produit)
  private currentSizeStocks = computed<{ [key: string]: number }>(() => {
    const variant = this.selectedVariant();
    if (variant) return variant.sizeStocks || {};
    return this.product()?.sizeStocks || {};
  });

  selectedSizeStock = computed(() => {
    if (!this.product()) return 0;
    return this.currentSizeStocks()[this.selectedSize()] ?? 0;
  });

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.route.paramMap.subscribe(params => {
        const idStr = params.get('id');
        if (idStr) {
          this.loadProduct(Number(idStr));
        } else {
          this.route.queryParamMap.subscribe(qParams => {
            const qId = qParams.get('id');
            if (qId) {
              this.loadProduct(Number(qId));
            } else {
              this.loadDefaultProduct();
            }
          });
        }
      });
    } else {
      this.loading.set(false);
    }
  }

  loadProduct(id: number) {
    this.loading.set(true);
    this.productService.getProductById(id).subscribe({
      next: (prod) => {
        this.applyProduct(prod);
        this.loading.set(false);
      },
      error: () => {
        this.loadDefaultProduct();
      }
    });
  }

  loadDefaultProduct() {
    this.loading.set(true);
    this.productService.getProducts().subscribe({
      next: (prods) => {
        if (prods.length > 0) {
          this.applyProduct(prods[0]);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  private applyProduct(prod: Product) {
    this.product.set(prod);
    this.quantity.set(1);
    this.selectedImage.set(null);

    // Couleur par défaut : la première qui a du stock
    const variants = prod.variants ?? [];
    const firstInStock = variants.find(v => (v.stock ?? 0) > 0) ?? variants[0];
    this.selectedVariantId.set(firstInStock?.id ?? null);
    this.selectFirstSizeInStock();
  }

  private selectFirstSizeInStock() {
    const stocks = this.currentSizeStocks();
    const inStockSize = this.availableSizes.find(s => (stocks[s] ?? 0) > 0);
    if (inStockSize) {
      this.selectedSize.set(inStockSize);
    }
  }

  selectVariant(variant: ProductVariant) {
    this.selectedVariantId.set(variant.id ?? null);
    this.selectedImage.set(null);
    this.quantity.set(1);
    // Garde la taille si elle est disponible dans cette couleur, sinon prend la première en stock
    if ((variant.sizeStocks?.[this.selectedSize()] ?? 0) <= 0) {
      this.selectFirstSizeInStock();
    }
  }

  sizeStock(size: string): number {
    return this.currentSizeStocks()[size] ?? 0;
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

    const variant = this.selectedVariant();
    if (this.variants().length > 0 && !variant) {
      alert('Veuillez choisir une couleur.');
      return;
    }

    if (this.selectedSizeStock() <= 0) {
      alert('Cette taille est actuellement en rupture de stock.');
      return;
    }

    // Quantité déjà dans le panier pour cette couleur / taille
    const inCart = this.cartService.cartItems()
      .filter(i => i.product.id === prod.id && (i.size || 'M') === this.selectedSize() && (i.variantId ?? null) === (variant?.id ?? null))
      .reduce((sum, i) => sum + i.quantity, 0);

    if (this.quantity() + inCart > this.selectedSizeStock()) {
      const colorTxt = variant ? ` en ${variant.colorName}` : '';
      alert(`Seulement ${this.selectedSizeStock()} unités de taille ${this.selectedSize()}${colorTxt} sont disponibles.`);
      return;
    }

    this.cartService.addToCart(prod, this.quantity(), this.selectedSize(), variant).subscribe({
      next: () => {
        const colorTxt = variant ? ` (${variant.colorName}, ${this.selectedSize()})` : '';
        alert(`${this.quantity()} x ${prod.name}${colorTxt} ajouté à votre panier !`);
      },
      error: () => {
        alert('Impossible d’ajouter l’article au panier. Veuillez réessayer.');
      }
    });
  }
}
