import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepartmentService, Department } from '../../../services/department.service';
import { ProductService, Category } from '../../../services/product.service';

@Component({
  selector: 'app-admin-departments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-departments.component.html',
  styleUrls: ['./admin-departments.component.scss']
})
export class AdminDepartmentsComponent implements OnInit {
  private departmentService = inject(DepartmentService);
  private productService = inject(ProductService);

  departments = signal<Department[]>([]);
  availableCategories = signal<Category[]>([]);
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  successMessage = signal<string>('');
  errorMessage = signal<string>('');

  showModal = signal<boolean>(false);
  isEditMode = signal<boolean>(false);

  formData: Department = {
    name: '',
    code: '',
    description: '',
    subcategories: '',
    displayOrder: 1,
    active: true
  };

  ngOnInit() {
    this.loadDepartments();
    this.loadCategories();
  }

  loadDepartments() {
    this.loading.set(true);
    this.departmentService.getAdminDepartments().subscribe({
      next: (res) => {
        this.departments.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Erreur lors du chargement des rayons.');
        this.loading.set(false);
      }
    });
  }

  loadCategories() {
    this.productService.getCategories().subscribe({
      next: (cats) => this.availableCategories.set(cats),
      error: () => {}
    });
  }

  openCreateModal() {
    this.isEditMode.set(false);
    this.formData = {
      name: '',
      code: '',
      description: '',
      subcategories: '',
      displayOrder: this.departments().length + 1,
      active: true
    };
    this.clearMessages();
    this.loadCategories();
    this.showModal.set(true);
  }

  openEditModal(dept: Department) {
    this.isEditMode.set(true);
    this.formData = { ...dept };
    this.clearMessages();
    this.loadCategories();
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  clearMessages() {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  onNameChange() {
    if (!this.isEditMode()) {
      this.formData.code = this.formData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  }

  getSubcategoriesList(subcategories?: string): string[] {
    if (!subcategories) return [];
    return subcategories.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  // Interactive Category Selection into Subcategories
  isCategorySelected(catName: string): boolean {
    if (!this.formData.subcategories) return false;
    const list = this.getSubcategoriesList(this.formData.subcategories);
    return list.some(item => item.toLowerCase() === catName.toLowerCase());
  }

  toggleCategorySelection(cat: Category) {
    let currentList = this.getSubcategoriesList(this.formData.subcategories);
    const index = currentList.findIndex(item => item.toLowerCase() === cat.name.toLowerCase());

    if (index >= 0) {
      // Remove
      currentList.splice(index, 1);
    } else {
      // Add
      currentList.push(cat.name);
    }

    this.formData.subcategories = currentList.join(', ');
  }

  selectAllForRayon() {
    const targetDept = this.formData.name.trim().toLowerCase();
    const matchingCats = this.availableCategories().filter(c => 
      !targetDept || (c.department && c.department.toLowerCase() === targetDept) || targetDept === 'all'
    );

    let currentList = this.getSubcategoriesList(this.formData.subcategories);
    matchingCats.forEach(c => {
      if (!currentList.some(item => item.toLowerCase() === c.name.toLowerCase())) {
        currentList.push(c.name);
      }
    });

    this.formData.subcategories = currentList.join(', ');
  }

  clearAllSubcategories() {
    this.formData.subcategories = '';
  }

  getCategoriesGrouped(): { matching: Category[]; others: Category[] } {
    const deptName = (this.formData.name || '').trim().toLowerCase();
    const all = this.availableCategories();
    if (!deptName) return { matching: all, others: [] };

    const matching = all.filter(c => c.department && c.department.toLowerCase() === deptName);
    const others = all.filter(c => !c.department || c.department.toLowerCase() !== deptName);
    return { matching, others };
  }

  saveDepartment() {
    if (!this.formData.name || !this.formData.name.trim()) {
      this.errorMessage.set('Le nom du rayon est obligatoire (ex: HOMME, FEMME).');
      return;
    }

    this.saving.set(true);
    this.clearMessages();

    if (this.isEditMode() && this.formData.id) {
      this.departmentService.updateDepartment(this.formData.id, this.formData).subscribe({
        next: () => {
          this.saving.set(false);
          this.successMessage.set('Rayon mis à jour avec succès.');
          this.showModal.set(false);
          this.loadDepartments();
        },
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('Erreur lors de la mise à jour du rayon.');
        }
      });
    } else {
      this.departmentService.createDepartment(this.formData).subscribe({
        next: () => {
          this.saving.set(false);
          this.successMessage.set('Nouveau rayon ajouté avec succès !');
          this.showModal.set(false);
          this.loadDepartments();
        },
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('Erreur lors de la création du rayon.');
        }
      });
    }
  }

  toggleActive(dept: Department) {
    if (!dept.id) return;
    this.departmentService.toggleDepartment(dept.id).subscribe({
      next: (updated) => {
        this.departments.update(list => list.map(d => d.id === updated.id ? updated : d));
      }
    });
  }

  deleteDepartment(dept: Department) {
    if (!dept.id) return;
    if (confirm(`Êtes-vous sûr de vouloir supprimer le rayon "${dept.name}" ?`)) {
      this.departmentService.deleteDepartment(dept.id).subscribe({
        next: () => {
          this.successMessage.set('Rayon supprimé.');
          this.departments.update(list => list.filter(d => d.id !== dept.id));
        },
        error: () => {
          this.errorMessage.set('Erreur lors de la suppression.');
        }
      });
    }
  }
}
