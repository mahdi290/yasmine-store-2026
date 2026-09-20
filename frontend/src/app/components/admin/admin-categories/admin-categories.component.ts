import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { ProductService, Category } from '../../../services/product.service';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-categories.component.html',
  styleUrls: ['./admin-categories.component.scss']
})
export class AdminCategoriesComponent implements OnInit {
  private adminService = inject(AdminService);
  private productService = inject(ProductService);
  private platformId = inject(PLATFORM_ID);

  // States
  categories = signal<Category[]>([]);
  loading = signal<boolean>(true);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  // Modal Control
  modalMode = signal<'add' | 'edit' | 'delete' | 'none'>('none');
  selectedCategory = signal<Category | null>(null);

  // Form Model
  categoryForm = {
    id: 0,
    name: ''
  };

  searchTerm = signal<string>('');

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadCategories();
    } else {
      this.loading.set(false);
    }
  }

  loadCategories() {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.productService.getCategories().subscribe({
      next: (data) => {
        this.categories.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Impossible de charger les catégories.');
        this.loading.set(false);
      }
    });
  }

  getFilteredCategories(): Category[] {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.categories();
    return this.categories().filter(c => 
      c.name.toLowerCase().includes(term)
    );
  }

  openAddModal() {
    this.modalMode.set('add');
    this.selectedCategory.set(null);
    this.categoryForm = {
      id: 0,
      name: ''
    };
  }

  openEditModal(cat: Category) {
    this.modalMode.set('edit');
    this.selectedCategory.set(cat);
    this.categoryForm = {
      id: cat.id,
      name: cat.name
    };
  }

  openDeleteModal(cat: Category) {
    this.modalMode.set('delete');
    this.selectedCategory.set(cat);
  }

  closeModal() {
    this.modalMode.set('none');
    this.selectedCategory.set(null);
  }

  saveCategory() {
    this.errorMsg.set(null);
    this.successMsg.set(null);

    if (!this.categoryForm.name.trim()) {
      this.errorMsg.set('Le nom de la catégorie est obligatoire.');
      return;
    }

    if (this.modalMode() === 'add') {
      this.adminService.createCategory({ name: this.categoryForm.name }).subscribe({
        next: () => {
          this.successMsg.set('Catégorie créée avec succès !');
          this.loadCategories();
          this.closeModal();
        },
        error: (err) => {
          this.errorMsg.set(err.error || 'Échec de la création de la catégorie.');
        }
      });
    } else if (this.modalMode() === 'edit') {
      this.adminService.updateCategory(this.categoryForm.id, { name: this.categoryForm.name }).subscribe({
        next: () => {
          this.successMsg.set('Catégorie mise à jour avec succès !');
          this.loadCategories();
          this.closeModal();
        },
        error: (err) => {
          this.errorMsg.set(err.error || 'Échec de la mise à jour de la catégorie.');
        }
      });
    }
  }

  deleteCategory() {
    const cat = this.selectedCategory();
    if (!cat) return;

    this.errorMsg.set(null);
    this.successMsg.set(null);

    this.adminService.deleteCategory(cat.id).subscribe({
      next: () => {
        this.successMsg.set('Catégorie supprimée avec succès !');
        this.loadCategories();
        this.closeModal();
      },
      error: (err) => {
        this.errorMsg.set(err.error?.error || 'Échec de la suppression de la catégorie.');
        this.closeModal();
      }
    });
  }
}
