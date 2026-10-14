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
  maxPrice = signal<number>(5000);
  appliedMinPrice = signal<number>(0);
  appliedMaxPrice = signal<number>(5000);
  isPriceFilterActive = signal<boolean>(false);
  selectedBrands = signal<string[]>([]);
  selectedColors = signal<string[]>([]);
  sortBy = signal<string>('featured');
  viewMode = signal<'grid' | 'list'>('grid');
  pageSize = signal<number>(12);
  currentPage = signal<number>(1);

  // Accordion & Drawer UI State
  filterDrawerOpen = signal<boolean>(false);
  sortDropdownOpen = signal<boolean>(false);
  categoriesOpen = signal<boolean>(true);
  brandsOpen = signal<boolean>(true);
  colorsOpen = signal<boolean>(true);

  // Active filters count
  activeFiltersCount = computed(() => {
    let count = 0;
    if (this.selectedDepartment() && this.selectedDepartment().toLowerCase() !== 'all') count++;
    if (this.selectedCategoryId() !== null) count++;
    if (this.searchTerm().trim()) count++;
    if (this.onlyPromotions()) count++;
    if (this.isPriceFilterActive()) count++;
    count += this.selectedBrands().length;
    return count;
  });

  // Current title computation for luxury hero header
  currentCategoryTitle = computed(() => {
    if (this.onlyPromotions()) return 'Soldes & Promotions';
    if (this.searchTerm().trim()) return `Recherche : "${this.searchTerm().trim()}"`;
    const catId = this.selectedCategoryId();
    if (catId !== null) {
      const cat = this.categories().find(c => c.id === catId);
      if (cat) return cat.name;
    }
    const dept = this.selectedDepartment();
    if (dept && dept.toLowerCase() !== 'all') {
      const capDept = dept.charAt(0).toUpperCase() + dept.slice(1).toLowerCase();
      return `Collection ${capDept}`;
    }
    return 'Toutes les Créations';
  });

  // Derived filter list computed dynamically
  filteredProducts = computed(() => {
    let prods = this.products();

    // 1. Department filter
    const dept = this.selectedDepartment().trim().toLowerCase();
    if (dept && dept !== 'all') {
      prods = prods.filter(p => {
        const pDept = (p.department || 'Femme').toLowerCase();
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

    // 3. Price filter (applied only if user explicitly activated it)
    if (this.isPriceFilterActive()) {
      prods = prods.filter(p => p.price >= this.appliedMinPrice() && p.price <= this.appliedMaxPrice());
    }

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

  // Pages array for clean template rendering
  pages = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  get displayedCount(): number {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredProducts().length);
  }

  get startItemIndex(): number {
    if (this.filteredProducts().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.currentPage.set(page);
    if (isPlatformBrowser(this.platformId)) {
      const el = document.getElementById('catalog-top');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 350, behavior: 'smooth' });
      }
    }
  }

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
        this.resolveParams(params);
        this.currentPage.set(1);
      });
    } else {
      this.loading.set(false);
    }
  }

  loadData() {
    this.loading.set(true);
    this.productService.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.resolveParams(this.route.snapshot.queryParams);
      }
    });

    this.productService.getProducts().subscribe({
      next: (prods) => {
        this.products.set(prods);
        this.loading.set(false);
        this.resolveParams(this.route.snapshot.queryParams);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  resolveParams(params: any) {
    if (!params) return;

    if (params['category']) {
      const catId = Number(params['category']);
      this.selectedCategoryId.set(isNaN(catId) ? null : catId);
      this.searchTerm.set('');
    } else if (params['search']) {
      const rawSearch = (params['search'] || '').trim().toLowerCase();
      // Check if search keyword directly corresponds to an existing category!
      const matchedCat = this.categories().find(c => {
        const cName = c.name.toLowerCase();
        return cName === rawSearch ||
               cName.startsWith(rawSearch) ||
               rawSearch.startsWith(cName.slice(0, 4));
      });

      if (matchedCat) {
        this.selectedCategoryId.set(matchedCat.id);
        this.searchTerm.set('');
      } else {
        this.selectedCategoryId.set(null);
        this.searchTerm.set(params['search']);
      }
    } else {
      this.selectedCategoryId.set(null);
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
  }

  // Filter actions
  selectCategory(catId: number | null) {
    this.selectedCategoryId.set(catId);
    this.searchTerm.set(''); // Clear any search so user isn't stuck
    this.onlyPromotions.set(false);
    this.currentPage.set(1);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: catId || null, search: null, promo: null, solde: null },
      queryParamsHandling: 'merge'
    });
  }

  togglePromotions() {
    const next = !this.onlyPromotions();
    this.onlyPromotions.set(next);
    if (next) {
      this.selectedCategoryId.set(null);
      this.searchTerm.set('');
    }
    this.currentPage.set(1);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { promo: next ? 'true' : null, search: null, category: next ? null : this.selectedCategoryId() },
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
    this.isPriceFilterActive.set(true);
    this.currentPage.set(1);
  }

  clearAllFilters() {
    this.searchTerm.set('');
    this.selectedDepartment.set('all');
    this.selectedCategoryId.set(null);
    this.onlyPromotions.set(false);
    this.minPrice.set(0);
    this.maxPrice.set(5000);
    this.appliedMinPrice.set(0);
    this.appliedMaxPrice.set(5000);
    this.isPriceFilterActive.set(false);
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

    if (this.isPriceFilterActive()) {
      list.push({ 
        type: 'price', 
        label: `Prix: ${this.appliedMinPrice()} DT - ${this.appliedMaxPrice()} DT`, 
        action: () => {
          this.minPrice.set(0);
          this.maxPrice.set(5000);
          this.appliedMinPrice.set(0);
          this.appliedMaxPrice.set(5000);
          this.isPriceFilterActive.set(false);
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

  // Filter Drawer methods
  toggleFilterDrawer() {
    this.filterDrawerOpen.update(v => !v);
  }

  closeFilterDrawer() {
    this.filterDrawerOpen.set(false);
  }

  // Custom Sort Dropdown methods
  toggleSortDropdown(event?: Event) {
    if (event) event.stopPropagation();
    this.sortDropdownOpen.update(v => !v);
  }

  closeSortDropdown() {
    this.sortDropdownOpen.set(false);
  }

  selectSort(option: string) {
    this.sortBy.set(option);
    this.sortDropdownOpen.set(false);
    this.currentPage.set(1);
  }

  getSortLabel(): string {
    switch (this.sortBy()) {
      case 'lowToHigh': return 'Prix : Croissant';
      case 'highToLow': return 'Prix : Décroissant';
      case 'newest': return 'Nouveautés';
      default: return 'En Vedette';
    }
  }

  // Accurate category count based on current department & promotions
  getCategoryCount(catId: number | null): number {
    let list = this.products();
    
    // Filter by department if one is selected
    const dept = this.selectedDepartment().trim().toLowerCase();
    if (dept && dept !== 'all') {
      list = list.filter(p => {
        const pDept = (p.department || 'Femme').toLowerCase();
        return pDept === dept;
      });
    }

    // Filter by promo if onlyPromotions is active
    if (this.onlyPromotions()) {
      list = list.filter(p => p.onSale && (p.discountPercent || 0) > 0);
    }

    if (catId === null) return list.length;
    return list.filter(p => p.category?.id === catId).length;
  }
}
