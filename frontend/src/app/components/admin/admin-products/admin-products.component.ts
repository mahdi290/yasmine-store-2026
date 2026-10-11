import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { ProductService, Product, Category } from '../../../services/product.service';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
    sizeStocks: { S: 0, M: 0, L: 0, XL: 0 } as { [key: string]: number },
    onSale: false,
    discountPercent: 0,
    department: 'Femme'
  };

  searchTerm = signal<string>('');
  filterMode = signal<'all' | 'solde' | 'out_of_stock'>('all');

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
    let list = this.products();
    const mode = this.filterMode();
    if (mode === 'solde') {
      list = list.filter(p => p.onSale && (p.discountPercent || 0) > 0);
    } else if (mode === 'out_of_stock') {
      list = list.filter(p => p.stock <= 0);
    }

    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return list;
    return list.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.brand.toLowerCase().includes(term) ||
      (p.category && p.category.name.toLowerCase().includes(term))
    );
  }

  getEffectivePrice(price: number, discountPercent: number): number {
    if (discountPercent > 0) {
      return Number((price * (100 - discountPercent) / 100).toFixed(2));
    }
    return price;
  }

  quickToggleSolde(prod: Product, onSale: boolean, percent?: number) {
    const disc = percent !== undefined ? percent : (prod.discountPercent || 20);
    this.adminService.updateProduct(prod.id, {
      name: prod.name,
      description: prod.description,
      price: prod.price,
      categoryId: prod.category ? prod.category.id : 0,
      brand: prod.brand,
      stock: prod.stock,
      imageUrl: prod.imageUrl,
      sizeStocks: prod.sizeStocks || {},
      onSale: onSale,
      discountPercent: disc
    }).subscribe({
      next: () => {
        prod.onSale = onSale;
        prod.discountPercent = disc;
        this.loadProducts();
      }
    });
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
      sizeStocks: { S: 0, M: 0, L: 0, XL: 0 },
      onSale: false,
      discountPercent: 0,
      department: 'Femme'
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
      sizeStocks: prod.sizeStocks ? { ...prod.sizeStocks } : { S: 0, M: 0, L: 0, XL: 0 },
      onSale: !!prod.onSale,
      discountPercent: prod.discountPercent || 0,
      department: prod.department || 'Femme'
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

    // Auto-resolve categoryId if unselected or string
    let catId = Number(this.productForm.categoryId);
    if ((!catId || isNaN(catId) || catId === 0) && this.categories().length > 0) {
      catId = this.categories()[0].id;
      this.productForm.categoryId = catId;
    }

    if (!this.productForm.name || !this.productForm.price) {
      this.errorMsg.set('Veuillez remplir tous les champs obligatoires (Nom, Prix, Photo).');
      return;
    }

    const extractMsg = (err: any, fallback: string) => {
      if (err.status === 403 || err.status === 401) {
        return 'Session expirée ou non autorisée (403). Veuillez vous connecter avec le compte administrateur (admin@shop.com / adminpassword).';
      }
      if (typeof err.error === 'string') return err.error;
      if (err.error?.error) return err.error.error;
      if (err.error?.message) return err.error.message;
      return fallback;
    };

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
          this.errorMsg.set(extractMsg(err, 'Échec de la création du produit.'));
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
          this.errorMsg.set(extractMsg(err, 'Échec de la mise à jour du produit.'));
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
