import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { ProductService, Category } from '../../services/product.service';

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
  private productService = inject(ProductService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  categories = signal<Category[]>([]);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.productService.getCategories().subscribe({
        next: (cats) => this.categories.set(cats),
        error: () => {}
      });
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  search(term: string) {
    if (term.trim()) {
      this.router.navigate(['/category'], { queryParams: { search: term.trim() } });
    } else {
      this.router.navigate(['/category']);
    }
  }
}
