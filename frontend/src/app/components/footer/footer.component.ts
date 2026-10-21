import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService, Category } from '../../services/product.service';
import { DepartmentService, Department } from '../../services/department.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {
  private productService = inject(ProductService);
  private departmentService = inject(DepartmentService);
  private platformId = inject(PLATFORM_ID);

  readonly contact = {
    phoneDisplay: '+216 29 430 516',
    phoneHref: 'tel:+21629430516',
    email: 'yasminestoresf@gmail.com',
    address: 'Markez Bouassida, Sfax, Tunisie',
    instagram: 'https://www.instagram.com/yesmina.store',
    facebook: 'https://www.facebook.com/p/Yesmina-store-61594864630099/'
  };

  // Badges VISA / PayPal / Apple Pay : masqués pour le moment (paiement à la livraison uniquement)
  readonly showPaymentBadges = false;

  private categories = signal<Category[]>([]);
  private departments = signal<Department[]>([]);

  // Liens "Boutique" construits depuis la base : ils mènent toujours vers une page existante
  shopCategories = computed(() => this.categories().slice(0, 5));

  // Les rayons ne sont listés que s'il y en a plusieurs (sinon "Toutes les pièces" suffit)
  shopDepartments = computed(() => {
    const active = this.departments().filter(d => d.active !== false);
    return active.length > 1 ? active : [];
  });

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.productService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats || []),
      error: () => {}
    });
    this.departmentService.getActiveDepartments().subscribe({
      next: (depts) => this.departments.set(depts || [])
    });
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
