import { Component, OnInit, OnDestroy, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ProductService, Product, Category } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';

export interface CarouselSlide {
  id: number;
  badge: string;
  title: string;
  subtitle: string;
  btnText: string;
  link: string;
  imageUrl: string;
}

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
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  // Carousel States
  currentSlide = signal<number>(0);
  private autoSlideTimer: any = null;

  slides: CarouselSlide[] = [
    {
      id: 1,
      badge: 'COLLECTION EXCLUSIVE',
      title: 'SOULEVEZ VOTRE STYLE',
      subtitle: 'Affirmez votre personnalité avec des pièces uniques et raffinées, conçues pour marquer les esprits.',
      btnText: 'ACHETER MAINTENANT',
      link: '/category',
      imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1600&auto=format&fit=crop&q=80'
    },
    {
      id: 2,
      badge: 'NOUVELLE SAISON',
      title: 'SUBLIMEZ VOTRE ÉLÉGANCE',
      subtitle: 'Des pièces raffinées et intemporelles pour enrichir votre garde-robe avec distinction et style au quotidien.',
      btnText: 'DÉCOUVRIR LA BOUTIQUE',
      link: '/category',
      imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600&auto=format&fit=crop&q=80'
    },
    {
      id: 3,
      badge: 'COLLECTION FEMME',
      title: "L'AUDACE DU STYLE TUNISIEN",
      subtitle: 'Robes glamour, manteaux chics et ensembles signatures. Livraison rapide sur toute la Tunisie avec paiement à la livraison.',
      btnText: 'COMMANDER MAINTENANT',
      link: '/category',
      imageUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1600&auto=format&fit=crop&q=80'
    },
    {
      id: 4,
      badge: 'ÉDITION LIMITÉE',
      title: 'TENDANCES & COUPS DE CŒUR',
      subtitle: 'Profitez de notre sélection exclusive de prêt-à-porter féminin et sublimez chaque instant de votre journée.',
      btnText: 'VOIR LES TENDANCES',
      link: '/category',
      imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1600&auto=format&fit=crop&q=80'
    }
  ];

  // Curated Featured Categories (Replaces Capture 1 with high-fashion Bento grid)
  featuredCategories: FeaturedCategory[] = [
    {
      title: 'Robes & Ensembles',
      badge: 'PIÈCES EMBLÉMATIQUES',
      description: 'Des coupes fluides et sophistiquées pour toutes vos occasions.',
      imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=900&auto=format&fit=crop&q=80',
      categoryQueryName: 'Robes',
      colClass: 'col-lg-7 col-md-12'
    },
    {
      title: 'Hauts & Chemisiers',
      badge: 'CHIC QUOTIDIEN',
      description: 'Blouses légères, chemises modernes et coupes fluides.',
      imageUrl: 'https://images.unsplash.com/photo-1551803091-e20673f15770?w=900&auto=format&fit=crop&q=80',
      categoryQueryName: 'Hauts & Blouses',
      colClass: 'col-lg-5 col-md-6'
    },
    {
      title: 'Maille & Sweats',
      badge: 'DOUCEUR DE SAISON',
      description: 'Pulls douillets et cardigans élégants pour les journées fraîches.',
      imageUrl: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=900&auto=format&fit=crop&q=80',
      categoryQueryName: 'Maille',
      colClass: 'col-lg-5 col-md-6'
    },
    {
      title: 'Accessoires & Maroquinerie',
      badge: 'FINITIONS RAFFINÉES',
      description: 'Sacs en cuir, solaires et accessoires pour parfaire votre allure.',
      imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=900&auto=format&fit=crop&q=80',
      categoryQueryName: 'Accessoires',
      colClass: 'col-lg-7 col-md-12'
    }
  ];

  // States
  categories = signal<Category[]>([]);
  products = signal<Product[]>([]);
  loading = signal<boolean>(true);

  // Active Category Filter for Best Sellers
  activeCategoryFilter = signal<string>('all');
  favorites = signal<Set<number>>(new Set<number>());

  // Filtered Products for Best Sellers Grid
  filteredProducts = computed(() => {
    const filter = this.activeCategoryFilter().toLowerCase();
    const list = this.products();
    if (filter === 'all') return list;
    return list.filter(p => {
      const catName = p.category?.name?.toLowerCase() || '';
      return catName.includes(filter);
    });
  });

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
      this.startAutoPlay();
    }
  }

  ngOnDestroy() {
    this.stopAutoPlay();
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
    this.currentSlide.update((curr) => (curr + 1) % this.slides.length);
  }

  prevSlide() {
    this.currentSlide.update((curr) => (curr - 1 + this.slides.length) % this.slides.length);
  }

  goToSlide(index: number) {
    this.currentSlide.set(index);
    this.startAutoPlay();
  }

  loadData() {
    this.productService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats)
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
    this.favorites.update(set => {
      const next = new Set(set);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  isFavorite(productId: number): boolean {
    return this.favorites().has(productId);
  }

  addToCart(product: Product, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    this.cartService.addToCart(product, 1).subscribe({
      next: () => {
        alert(`${product.name} a été ajouté à votre panier !`);
      },
      error: () => {
        alert('Impossible d’ajouter l’article au panier. Veuillez réessayer.');
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
    const found = this.categories().find(c => c.name.toLowerCase().includes(name.toLowerCase()));
    return found ? found.id : null;
  }
}
