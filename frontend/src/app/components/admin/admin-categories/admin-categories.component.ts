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

  // Department Filter
  selectedDepartmentFilter = signal<string>('ALL');

  // Modal Control
  modalMode = signal<'add' | 'edit' | 'delete' | 'none'>('none');
  selectedCategory = signal<Category | null>(null);

  // Form Model
  categoryForm = {
    id: 0,
    name: '',
    department: 'Femme',
    icon: ''
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
    const deptFilter = this.selectedDepartmentFilter();
    let list = this.categories();

    if (deptFilter !== 'ALL') {
      list = list.filter(c => (c.department || 'Femme').toLowerCase() === deptFilter.toLowerCase());
    }

    if (!term) return list;
    return list.filter(c => 
      c.name.toLowerCase().includes(term) ||
      (c.department && c.department.toLowerCase().includes(term))
    );
  }

  openAddModal() {
    this.modalMode.set('add');
    this.selectedCategory.set(null);
    this.categoryForm = {
      id: 0,
      name: '',
      department: this.selectedDepartmentFilter() !== 'ALL' ? this.selectedDepartmentFilter() : 'Femme',
      icon: ''
    };
  }

  openEditModal(cat: Category) {
    this.modalMode.set('edit');
    this.selectedCategory.set(cat);
    this.categoryForm = {
      id: cat.id,
      name: cat.name,
      department: cat.department || 'Femme',
      icon: cat.icon || ''
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
      const payload = {
        name: this.categoryForm.name.trim(),
        department: this.categoryForm.department || 'Femme',
        icon: this.categoryForm.icon || ''
      };
      this.adminService.createCategory(payload).subscribe({
        next: () => {
          this.successMsg.set('Catégorie créée avec succès.');
          this.closeModal();
          this.loadCategories();
        },
        error: (err) => {
          this.errorMsg.set(err.error?.error || 'Erreur lors de la création de la catégorie.');
        }
      });
    } else if (this.modalMode() === 'edit') {
      this.adminService.updateCategory(this.categoryForm.id, this.categoryForm).subscribe({
        next: () => {
          this.successMsg.set('Catégorie mise à jour avec succès.');
          this.closeModal();
          this.loadCategories();
        },
        error: (err) => {
          this.errorMsg.set(err.error?.error || 'Erreur lors de la mise à jour.');
        }
      });
    }
  }

  confirmDelete() {
    const cat = this.selectedCategory();
    if (!cat) return;

    this.adminService.deleteCategory(cat.id).subscribe({
      next: () => {
        this.successMsg.set('Catégorie supprimée.');
        this.closeModal();
        this.loadCategories();
      },
      error: (err) => {
        this.errorMsg.set(err.error?.error || 'Impossible de supprimer cette catégorie car elle contient des produits.');
        this.closeModal();
      }
    });
  }
}
