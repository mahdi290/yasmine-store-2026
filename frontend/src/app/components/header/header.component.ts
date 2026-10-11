import { Component, inject, signal, computed, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { ProductService, Category } from '../../services/product.service';
import { DepartmentService, Department, DEFAULT_DEPARTMENTS } from '../../services/department.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  authService = inject(AuthService);
  cartService = inject(CartService);
  wishlistService = inject(WishlistService);
  private productService = inject(ProductService);
  private departmentService = inject(DepartmentService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  categories = signal<Category[]>([]);
  departments = signal<Department[]>(DEFAULT_DEPARTMENTS);

  // Current active department tracking (empty by default so neither is pre-selected)
  currentDepartment = signal<string>('');

  // Dynamic secondary navigation links matching active department
  navLinks = computed(() => {
    const isHomme = this.currentDepartment().toLowerCase() === 'homme';
    const isFemme = this.currentDepartment().toLowerCase() === 'femme';
    if (isHomme) {
      return [
        { label: 'Accueil', path: '/', queryParams: {}, exact: true, isPromo: false },
        { label: 'Tout le vestiaire', path: '/category', queryParams: { department: 'homme' }, exact: false, isPromo: false },
        { label: 'Chemises', path: '/category', queryParams: { department: 'homme', search: 'Chemise' }, exact: false, isPromo: false },
        { label: 'Pulls & Maille', path: '/category', queryParams: { department: 'homme', search: 'Pull' }, exact: false, isPromo: false },
        { label: 'Vestes & Blazers', path: '/category', queryParams: { department: 'homme', search: 'Blazer' }, exact: false, isPromo: false },
        { label: 'Accessoires', path: '/category', queryParams: { department: 'homme', search: 'Montre' }, exact: false, isPromo: false },
        { label: 'Soldes', path: '/category', queryParams: { department: 'homme', promo: 'true' }, exact: false, isPromo: true }
      ];
    }
    if (isFemme) {
      return [
        { label: 'Accueil', path: '/', queryParams: {}, exact: true, isPromo: false },
        { label: 'Toutes les créations', path: '/category', queryParams: { department: 'femme' }, exact: false, isPromo: false },
        { label: 'Robes', path: '/category', queryParams: { department: 'femme', search: 'Robe' }, exact: false, isPromo: false },
        { label: 'Hauts & Blouses', path: '/category', queryParams: { department: 'femme', search: 'Blouse' }, exact: false, isPromo: false },
        { label: 'Maille & Pulls', path: '/category', queryParams: { department: 'femme', search: 'Maille' }, exact: false, isPromo: false },
        { label: 'Accessoires', path: '/category', queryParams: { department: 'femme', search: 'Accessoires' }, exact: false, isPromo: false },
        { label: 'Soldes', path: '/category', queryParams: { department: 'femme', promo: 'true' }, exact: false, isPromo: true }
      ];
    }
    return [
      { label: 'Accueil', path: '/', queryParams: {}, exact: true, isPromo: false },
      { label: 'Nouveautés', path: '/category', queryParams: {}, exact: false, isPromo: false },
      { label: 'Robes', path: '/category', queryParams: { search: 'Robe' }, exact: false, isPromo: false },
      { label: 'Hauts & Blouses', path: '/category', queryParams: { search: 'Blouse' }, exact: false, isPromo: false },
      { label: 'Maille & Pulls', path: '/category', queryParams: { search: 'Maille' }, exact: false, isPromo: false },
      { label: 'Accessoires', path: '/category', queryParams: { search: 'Accessoires' }, exact: false, isPromo: false },
      { label: 'Soldes', path: '/category', queryParams: { promo: 'true' }, exact: false, isPromo: true }
    ];
  });

  mobileMenuOpen = signal<boolean>(false);
  searchOpen = signal<boolean>(false);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.productService.getCategories().subscribe({
        next: (cats) => this.categories.set(cats),
        error: () => {}
      });

      this.departmentService.getDepartments().subscribe({
        next: (depts) => {
          if (depts && depts.length > 0) {
            this.departments.set(depts);
          }
        },
        error: () => {}
      });

      // Track current URL department query param
      this.updateActiveDeptFromUrl();
      this.router.events.subscribe(() => {
        this.updateActiveDeptFromUrl();
      });
    }
  }

  private updateActiveDeptFromUrl() {
    const urlTree = this.router.parseUrl(this.router.url);
    const dept = urlTree.queryParams['department'];
    if (dept) {
      this.currentDepartment.set(dept.toLowerCase());
    } else {
      this.currentDepartment.set('');
    }
  }

  selectDepartment(code: string) {
    const cleanCode = (code || '').toLowerCase();
    if (this.currentDepartment() === cleanCode) {
      // Toggle off if already active
      this.currentDepartment.set('');
      this.closeMobileMenu();
      this.router.navigate(['/category'], {
        queryParams: { department: null }
      });
    } else {
      this.currentDepartment.set(cleanCode);
      this.closeMobileMenu();
      this.router.navigate(['/category'], {
        queryParams: { department: cleanCode }
      });
    }
  }

  isDepartmentActive(code: string): boolean {
    const cur = this.currentDepartment();
    if (!cur) return false;
    return cur.toLowerCase() === (code || '').toLowerCase();
  }

  getSubcategories(sub?: string): string[] {
    if (!sub) return [];
    return sub.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  getCategoryIcon(sub: string): string {
    const s = sub.toLowerCase();
    if (s.includes('tout') || s.includes('voir')) return 'bi bi-grid text-primary';
    if (s.includes('nouveaut')) return 'bi bi-sparkles text-warning';
    if (s.includes('manteau') || s.includes('veste')) return 'bi bi-shield-check text-dark';
    if (s.includes('jean') || s.includes('pantalon')) return 'bi bi-scissors text-secondary';
    if (s.includes('robe') || s.includes('ensemble')) return 'bi bi-bag-heart text-danger';
    if (s.includes('haut') || s.includes('chemise') || s.includes('blouse') || s.includes('polo')) return 'bi bi-suit-club text-dark';
    if (s.includes('maille') || s.includes('pull')) return 'bi bi-layers text-secondary';
    if (s.includes('accessoire')) return 'bi bi-watch text-dark';
    if (s.includes('chaussure')) return 'bi bi-shop text-dark';
    if (s.includes('b\u00e9b\u00e9') || s.includes('bebe')) return 'bi bi-emoji-smile text-info';
    if (s.includes('fille')) return 'bi bi-heart-fill text-danger';
    if (s.includes('gar\u00e7on') || s.includes('garcon')) return 'bi bi-trophy text-primary';
    if (s.includes('p\u00e9pite') || s.includes('pepite') || s.includes('prix') || s.includes('solde') || s.includes('promo')) return 'bi bi-tag-fill text-danger';
    return 'bi bi-chevron-right text-muted';
  }

  isPromoSub(sub: string): boolean {
    const s = sub.toLowerCase();
    return s.includes('p\u00e9pite') || s.includes('pepite') || s.includes('prix') || s.includes('solde') || s.includes('promo');
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }

  toggleSearch() {
    this.searchOpen.update(v => !v);
  }

  search(term: string) {
    if (term.trim()) {
      this.router.navigate(['/category'], { queryParams: { search: term.trim() } });
    } else {
      this.router.navigate(['/category']);
    }
    this.closeMobileMenu();
    this.searchOpen.set(false);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth']);
  }
}
