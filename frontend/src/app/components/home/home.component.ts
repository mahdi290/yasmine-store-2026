import { Component, OnInit, OnDestroy, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ProductService, Product, Category } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { WishlistService } from '../../services/wishlist.service';
import { ShowcaseService, ShowcaseCard, DEFAULT_SHOWCASE_CARDS } from '../../services/showcase.service';
import { CarouselService, CarouselSlide, DEFAULT_CAROUSEL_SLIDES } from '../../services/carousel.service';

export interface FeaturedCategory {
  title: string;
  badge: string;
  description: string;
  imageUrl: string;
  categoryQueryName: string;
  colClass: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private wishlistService = inject(WishlistService);
  private showcaseService = inject(ShowcaseService);
  private carouselService = inject(CarouselService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  // Carousel States
  currentSlide = signal<number>(0);
  private autoSlideTimer: any = null;

  // Dynamic Carousel Slides loaded from DB (NO 'I TAKE THE RISK' slide!)
  slides = signal<CarouselSlide[]>(DEFAULT_CAROUSEL_SLIDES);

  // Dynamic Featured Categories Bento Grid (Managed from Admin)
  showcaseCards = signal<ShowcaseCard[]>(DEFAULT_SHOWCASE_CARDS);

  // States
  categories = signal<Category[]>([]);
  products = signal<Product[]>([]);
  loading = signal<boolean>(true);

  // Active Category Filter for Best Sellers
  activeCategoryFilter = signal<string>('all');

  // Filtered Products for Best Sellers Grid (dynamic from DB categories)
  filteredProducts = computed(() => {
    const filter = this.activeCategoryFilter();
    const list = this.products();
    if (filter === 'all') return list;
    if (filter === 'solde' || filter === 'promo' || filter === 'promotions') {
      return list.filter(p => p.onSale && (p.discountPercent || 0) > 0);
    }
    // Dynamic category filter: 'cat-{id}'
    if (filter.startsWith('cat-')) {
      const catId = parseInt(filter.replace('cat-', ''), 10);
      if (!isNaN(catId)) {
        return list.filter(p => p.category?.id === catId);
      }
    }
    // Fallback: match by category name (for legacy compatibility)
    return list.filter(p => {
      const catName = p.category?.name?.toLowerCase() || '';
      return catName.includes(filter.toLowerCase());
    });
  });

  private onResize = () => {
    this.updateHeaderHeight();
  };

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
      this.startAutoPlay();
      this.updateHeaderHeight();
      window.addEventListener('resize', this.onResize);
    }
  }

  ngOnDestroy() {
    this.stopAutoPlay();
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.onResize);
    }
  }

  updateHeaderHeight() {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => {
      const headerEl = document.querySelector('.luxury-header') as HTMLElement;
      const topBarEl = document.querySelector('.top-announcement-bar') as HTMLElement;
      let total = 0;
      if (topBarEl) total += topBarEl.offsetHeight;
      if (headerEl) total += headerEl.offsetHeight;
      if (total > 0) {
        document.documentElement.style.setProperty('--app-header-height', `${total}px`);
      }
    }, 60);
  }

  scrollToExplore() {
    if (!isPlatformBrowser(this.platformId)) return;
    const nextSection = document.querySelector('.trust-bar') as HTMLElement;
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  startAutoPlay() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.stopAutoPlay();
    this.autoSlideTimer = setInterval(() => {
      this.nextSlide();
    }, 5000);
  }

  stopAutoPlay() {
    if (this.autoSlideTimer) {
      clearInterval(this.autoSlideTimer);
      this.autoSlideTimer = null;
    }
  }

  nextSlide() {
    const total = this.slides().length;
    if (total === 0) return;
    this.currentSlide.update((curr) => (curr + 1) % total);
  }

  prevSlide() {
    const total = this.slides().length;
    if (total === 0) return;
    this.currentSlide.update((curr) => (curr - 1 + total) % total);
  }

  goToSlide(index: number) {
    this.currentSlide.set(index);
    this.startAutoPlay();
  }

  loadData() {
    this.productService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats)
    });

    this.carouselService.getSlides().subscribe({
      next: (loadedSlides) => {
        if (loadedSlides && loadedSlides.length > 0) {
          this.slides.set(loadedSlides);
        }
      }
    });

    this.showcaseService.getShowcaseCards().subscribe({
      next: (cards) => {
        if (cards && cards.length > 0) {
          this.showcaseCards.set(cards);
        }
      }
    });

    this.productService.getProducts().subscribe({
      next: (prods) => {
        this.products.set(prods);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  setFilter(filter: string) {
    this.activeCategoryFilter.set(filter);
  }

  toggleFavorite(productId: number, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.wishlistService.toggleFavorite(productId);
  }

  isFavorite(productId: number): boolean {
    return this.wishlistService.isFavorite(productId);
  }

  getEffectivePrice(product: Product): number {
    if (product.onSale && product.discountPercent && product.discountPercent > 0) {
      return Number((product.price * (100 - product.discountPercent) / 100).toFixed(2));
    }
    return product.price;
  }

  addToCart(product: Product, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if (this.cartService.needsColorChoice(product)) {
      this.router.navigate(['/product-details', product.id]);
      return;
    }

    this.cartService.addToCart(product, 1);
    alert(`${product.name} a été ajouté à votre panier !`);
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
    const found = this.categories().find(c => c.name.toLowerCase().includes(name.toLowerCase()));
    return found ? found.id : null;
  }
}
