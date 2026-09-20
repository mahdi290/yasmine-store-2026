import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { ProductService, Product, Category } from '../../../services/product.service';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-products.component.html',
  styleUrls: ['./admin-products.component.scss']
})
export class AdminProductsComponent implements OnInit {
  private adminService = inject(AdminService);
  private productService = inject(ProductService);
  private platformId = inject(PLATFORM_ID);

  // States
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  loading = signal<boolean>(true);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  // Modal Control
  modalMode = signal<'add' | 'edit' | 'delete' | 'none'>('none');
  selectedProduct = signal<Product | null>(null);

  uploadingImage = signal<boolean>(false);
  isDragging = signal<boolean>(false);

  // Form Model
  productForm = {
    id: 0,
    name: '',
    description: '',
    price: 0,
    categoryId: 0,
    brand: '',
    stock: 0,
    imageUrl: '',
    sizeStocks: { S: 0, M: 0, L: 0, XL: 0 } as { [key: string]: number }
  };

  searchTerm = signal<string>('');

  onImageFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleImageFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDropImage(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.handleImageFile(event.dataTransfer.files[0]);
    }
  }

  handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).');
      return;
    }

    this.uploadingImage.set(true);
    this.adminService.uploadImage(file).subscribe({
      next: (res) => {
        this.productForm.imageUrl = res.imageUrl;
        this.uploadingImage.set(false);
      },
      error: () => {
        // Fallback to base64 Data URL if needed
        const reader = new FileReader();
        reader.onload = (e) => {
          this.productForm.imageUrl = (e.target?.result as string) || '';
          this.uploadingImage.set(false);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  removeImage() {
    this.productForm.imageUrl = '';
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadProducts();
      this.loadCategories();
    } else {
      this.loading.set(false);
    }
  }

  loadProducts() {
    this.loading.set(true);
    this.adminService.getProducts().subscribe({
      next: (data) => {
        this.products.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Impossible de charger les produits.');
        this.loading.set(false);
      }
    });
  }

  loadCategories() {
    this.productService.getCategories().subscribe({
      next: (data) => this.categories.set(data)
    });
  }

  getFilteredProducts(): Product[] {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.products();
    return this.products().filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.brand.toLowerCase().includes(term) ||
      (p.category && p.category.name.toLowerCase().includes(term))
    );
  }

  openAddModal() {
    this.modalMode.set('add');
    this.selectedProduct.set(null);
    this.productForm = {
      id: 0,
      name: '',
      description: '',
      price: 0,
      categoryId: this.categories().length > 0 ? this.categories()[0].id : 0,
      brand: '',
      stock: 0,
      imageUrl: '',
      sizeStocks: { S: 0, M: 0, L: 0, XL: 0 }
    };
  }

  openEditModal(prod: Product) {
    this.modalMode.set('edit');
    this.selectedProduct.set(prod);
    this.productForm = {
      id: prod.id,
      name: prod.name,
      description: prod.description || '',
      price: prod.price,
      categoryId: prod.category ? prod.category.id : (this.categories().length > 0 ? this.categories()[0].id : 0),
      brand: prod.brand || '',
      stock: prod.stock,
      imageUrl: prod.imageUrl || '',
      sizeStocks: prod.sizeStocks ? { ...prod.sizeStocks } : { S: 0, M: 0, L: 0, XL: 0 }
    };
  }

  openDeleteModal(prod: Product) {
    this.modalMode.set('delete');
    this.selectedProduct.set(prod);
  }

  closeModal() {
    this.modalMode.set('none');
    this.selectedProduct.set(null);
  }

  saveProduct() {
    this.errorMsg.set(null);
    this.successMsg.set(null);

    if (!this.productForm.name || !this.productForm.price || !this.productForm.categoryId) {
      this.errorMsg.set('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    // Calculate total stock from sizeStocks
    const s = this.productForm.sizeStocks;
    this.productForm.stock = (Number(s['S']) || 0) + (Number(s['M']) || 0) + (Number(s['L']) || 0) + (Number(s['XL']) || 0);

    if (this.modalMode() === 'add') {
      this.adminService.createProduct(this.productForm).subscribe({
        next: () => {
          this.successMsg.set('Produit créé avec succès !');
          this.loadProducts();
          this.closeModal();
        },
        error: (err) => {
          this.errorMsg.set(err.error || 'Échec de la création du produit.');
        }
      });
    } else if (this.modalMode() === 'edit') {
      this.adminService.updateProduct(this.productForm.id, this.productForm).subscribe({
        next: () => {
          this.successMsg.set('Produit mis à jour avec succès !');
          this.loadProducts();
          this.closeModal();
        },
        error: (err) => {
          this.errorMsg.set(err.error || 'Échec de la mise à jour du produit.');
        }
      });
    }
  }

  deleteProduct() {
    const prod = this.selectedProduct();
    if (!prod) return;

    this.errorMsg.set(null);
    this.successMsg.set(null);

    this.adminService.deleteProduct(prod.id).subscribe({
      next: () => {
        this.successMsg.set('Produit supprimé avec succès !');
        this.loadProducts();
        this.closeModal();
      },
      error: (err) => {
        this.errorMsg.set(err.error?.error || 'Échec de la suppression du produit.');
        this.closeModal();
      }
    });
  }
}
