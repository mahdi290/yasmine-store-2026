import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { ProductService, Product, Category } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { WishlistService } from '../../services/wishlist.service';

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './category.component.html',
  styleUrls: ['./category.component.scss']
})
export class CategoryComponent implements OnInit {
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  wishlistService = inject(WishlistService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);

  // Raw DB States
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  loading = signal<boolean>(true);

  // Active filter states (Signals)
  searchTerm = signal<string>('');
  selectedDepartment = signal<string>('all');
  selectedCategoryId = signal<number | null>(null);
  onlyPromotions = signal<boolean>(false);
  minPrice = signal<number>(0);
  maxPrice = signal<number>(300);
  appliedMinPrice = signal<number>(0);
  appliedMaxPrice = signal<number>(300);
  selectedBrands = signal<string[]>([]);
  selectedColors = signal<string[]>([]);
  sortBy = signal<string>('featured');
  viewMode = signal<'grid' | 'list'>('grid');
  pageSize = signal<number>(12);
  currentPage = signal<number>(1);

  // Accordion UI State
  categoriesOpen = signal<boolean>(true);
  brandsOpen = signal<boolean>(true);
  colorsOpen = signal<boolean>(true);

  // Derived filter list computed dynamically
  filteredProducts = computed(() => {
    let prods = this.products();

    // 1. Department filter
    const dept = this.selectedDepartment().trim().toLowerCase();
    if (dept && dept !== 'all') {
      prods = prods.filter(p => {
        const pDept = ((p as any).department || 'Femme').toLowerCase();
        return pDept === dept;
      });
    }

    // 2. Category filter by ID
    const catId = this.selectedCategoryId();
    if (catId !== null) {
      prods = prods.filter(p => p.category && p.category.id === catId);
    }

    // 3. Search / Subcategory filter
    const rawSearch = this.searchTerm().trim().toLowerCase();
    if (rawSearch && rawSearch !== 'all' && rawSearch !== 'tout voir') {
      // Handle plural/singular in French: "robes" -> "robe", "manteaux" -> "manteau"
      let stem = rawSearch;
      if (rawSearch.endsWith('aux')) {
        stem = rawSearch.slice(0, -1);
      } else if (rawSearch.endsWith('s')) {
        stem = rawSearch.slice(0, -1);
      }

      prods = prods.filter(p => {
        const name = (p.name || '').toLowerCase();
        const brand = (p.brand || '').toLowerCase();
        const catName = (p.category?.name || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();

        return (
          name.includes(rawSearch) ||
          brand.includes(rawSearch) ||
          catName.includes(rawSearch) ||
          desc.includes(rawSearch) ||
          (stem && (name.includes(stem) || catName.includes(stem) || desc.includes(stem)))
        );
      });
    }

    // 4. Promotions filter
    if (this.onlyPromotions()) {
      prods = prods.filter(p => p.onSale && (p.discountPercent || 0) > 0);
    }

    // 3. Price filter (applied)
    prods = prods.filter(p => p.price >= this.appliedMinPrice() && p.price <= this.appliedMaxPrice());

    // 4. Brand filter
    const brands = this.selectedBrands();
    if (brands.length > 0) {
      prods = prods.filter(p => p.brand && brands.includes(p.brand));
    }

    // 5. Sort
    const sort = this.sortBy();
    if (sort === 'lowToHigh') {
      prods = [...prods].sort((a, b) => a.price - b.price);
    } else if (sort === 'highToLow') {
      prods = [...prods].sort((a, b) => b.price - a.price);
    } else if (sort === 'newest') {
      prods = [...prods].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    return prods;
  });

  // Paginated products computed dynamically
  paginatedProducts = computed(() => {
    const list = this.filteredProducts();
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    return list.slice(startIndex, startIndex + this.pageSize());
  });

  // Total pages
  totalPages = computed(() => {
    return Math.ceil(this.filteredProducts().length / this.pageSize()) || 1;
  });

  // Available brands derived from all loaded products
  availableBrands = computed(() => {
    const brandsSet = new Set<string>();
    this.products().forEach(p => {
      if (p.brand) brandsSet.add(p.brand);
    });
    return Array.from(brandsSet);
  });

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
      
      this.route.queryParams.subscribe(params => {
        if (params['category']) {
          this.selectedCategoryId.set(Number(params['category']));
        } else {
          this.selectedCategoryId.set(null);
        }
        if (params['search']) {
          this.searchTerm.set(params['search']);
        } else {
          this.searchTerm.set('');
        }
        if (params['department']) {
          this.selectedDepartment.set(params['department']);
        } else {
          this.selectedDepartment.set('all');
        }
        if (params['promo'] === 'true' || params['solde'] === 'true') {
          this.onlyPromotions.set(true);
        } else {
          this.onlyPromotions.set(false);
        }
        this.currentPage.set(1);
      });
    } else {
      this.loading.set(false);
    }
  }

  loadData() {
    this.loading.set(true);
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

  // Filter actions
  selectCategory(catId: number | null) {
    this.selectedCategoryId.set(catId);
    this.currentPage.set(1);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: catId || null },
      queryParamsHandling: 'merge'
    });
  }

  toggleBrand(brand: string) {
    const brands = [...this.selectedBrands()];
    const index = brands.indexOf(brand);
    if (index > -1) {
      brands.splice(index, 1);
    } else {
      brands.push(brand);
    }
    this.selectedBrands.set(brands);
    this.currentPage.set(1);
  }

  applyPriceFilter() {
    this.appliedMinPrice.set(this.minPrice());
    this.appliedMaxPrice.set(this.maxPrice());
    this.currentPage.set(1);
  }

  clearAllFilters() {
    this.searchTerm.set('');
    this.selectedDepartment.set('all');
    this.selectedCategoryId.set(null);
    this.onlyPromotions.set(false);
    this.minPrice.set(0);
    this.maxPrice.set(300);
    this.appliedMinPrice.set(0);
    this.appliedMaxPrice.set(300);
    this.selectedBrands.set([]);
    this.selectedColors.set([]);
    this.sortBy.set('featured');
    this.currentPage.set(1);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: null, department: null, search: null, promo: null, solde: null }
    });
  }

  // Active filters helper
  getActiveFiltersList() {
    const list: { type: string; label: string; action: () => void }[] = [];

    if (this.selectedDepartment() && this.selectedDepartment().toLowerCase() !== 'all') {
      const deptName = this.selectedDepartment();
      list.push({
        type: 'department',
        label: `Rayon: ${deptName}`,
        action: () => {
          this.selectedDepartment.set('all');
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { department: null },
            queryParamsHandling: 'merge'
          });
        }
      });
    }

    const catId = this.selectedCategoryId();
    if (catId !== null) {
      const cat = this.categories().find(c => c.id === catId);
      if (cat) {
        list.push({ type: 'category', label: `Catégorie: ${cat.name}`, action: () => this.selectCategory(null) });
      }
    }

    if (this.searchTerm().trim()) {
      const s = this.searchTerm().trim();
      list.push({
        type: 'search',
        label: `Recherche: ${s}`,
        action: () => {
          this.searchTerm.set('');
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { search: null },
            queryParamsHandling: 'merge'
          });
        }
      });
    }

    if (this.onlyPromotions()) {
      list.push({
        type: 'promo',
        label: 'Promotions & Soldes',
        action: () => {
          this.onlyPromotions.set(false);
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { promo: null, solde: null },
            queryParamsHandling: 'merge'
          });
        }
      });
    }

    if (this.appliedMinPrice() > 0 || this.appliedMaxPrice() < 300) {
      list.push({ 
        type: 'price', 
        label: `Prix: ${this.appliedMinPrice()} DT - ${this.appliedMaxPrice()} DT`, 
        action: () => {
          this.minPrice.set(0);
          this.maxPrice.set(300);
          this.applyPriceFilter();
        } 
      });
    }

    this.selectedBrands().forEach(b => {
      list.push({ type: 'brand', label: `Marque: ${b}`, action: () => this.toggleBrand(b) });
    });

    return list;
  }

  // Favorites
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

  // Cart action
  addToCart(product: Product, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    this.cartService.addToCart(product, 1);
    alert(`${product.name} a été ajouté au panier !`);
  }
}
