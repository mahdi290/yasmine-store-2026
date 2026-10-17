import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { ProductService, Product, Category } from '../../../services/product.service';

// Couleur en cours d'édition dans le formulaire admin
interface VariantForm {
  id?: number;
  colorName: string;
  colorHex: string;
  images: string[];
  newImageUrl: string;
  sizeStocks: { [key: string]: number };
  uploading: boolean;
}

const SIZES = ['S', 'M', 'L', 'XL'];

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
    department: 'Femme',
    variants: [] as VariantForm[]
  };

  readonly sizes = SIZES;

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

  normalizeDept(dept?: string): string {
    if (!dept) return 'Femme';
    const d = dept.toLowerCase().trim();
    if (d === 'homme') return 'Homme';
    if (d === 'enfant') return 'Enfant';
    return 'Femme';
  }

  onCategoryChange() {
    const cat = this.categories().find(c => c.id === Number(this.productForm.categoryId));
    if (cat && cat.department) {
      this.productForm.department = this.normalizeDept(cat.department);
    }
  }

  openAddModal() {
    this.modalMode.set('add');
    this.selectedProduct.set(null);
    const initialCat = this.categories().length > 0 ? this.categories()[0] : null;
    this.productForm = {
      id: 0,
      name: '',
      description: '',
      price: 0,
      categoryId: initialCat ? initialCat.id : 0,
      brand: '',
      stock: 0,
      imageUrl: '',
      sizeStocks: { S: 0, M: 0, L: 0, XL: 0 },
      onSale: false,
      discountPercent: 0,
      department: initialCat ? this.normalizeDept(initialCat.department) : 'Femme',
      variants: []
    };
  }

  openEditModal(prod: Product) {
    this.modalMode.set('edit');
    this.selectedProduct.set(prod);
    const catId = prod.category ? prod.category.id : (this.categories().length > 0 ? this.categories()[0].id : 0);
    const dept = prod.department ? this.normalizeDept(prod.department) : (prod.category?.department ? this.normalizeDept(prod.category.department) : 'Femme');
    this.productForm = {
      id: prod.id,
      name: prod.name,
      description: prod.description || '',
      price: prod.price,
      categoryId: catId,
      brand: prod.brand || '',
      stock: prod.stock,
      imageUrl: prod.imageUrl || '',
      sizeStocks: prod.sizeStocks ? { ...prod.sizeStocks } : { S: 0, M: 0, L: 0, XL: 0 },
      onSale: !!prod.onSale,
      discountPercent: prod.discountPercent || 0,
      department: dept,
      variants: (prod.variants || []).map(v => ({
        id: v.id,
        colorName: v.colorName,
        colorHex: v.colorHex || '#000000',
        images: [...(v.images || [])],
        newImageUrl: '',
        sizeStocks: { S: 0, M: 0, L: 0, XL: 0, ...(v.sizeStocks || {}) },
        uploading: false
      }))
    };
  }

  // ---- Couleurs / variantes ----
  addVariant() {
    this.productForm.variants.push({
      colorName: '',
      colorHex: '#000000',
      images: [],
      newImageUrl: '',
      sizeStocks: { S: 0, M: 0, L: 0, XL: 0 },
      uploading: false
    });
  }

  removeVariant(index: number) {
    const v = this.productForm.variants[index];
    const label = v.colorName ? `la couleur "${v.colorName}"` : 'cette couleur';
    if (confirm(`Supprimer ${label} ?`)) {
      this.productForm.variants.splice(index, 1);
    }
  }

  variantStock(v: VariantForm): number {
    return SIZES.reduce((sum, s) => sum + (Number(v.sizeStocks[s]) || 0), 0);
  }

  variantsTotalStock(): number {
    return this.productForm.variants.reduce((sum, v) => sum + this.variantStock(v), 0);
  }

  onVariantImagesSelected(v: VariantForm, event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      v.uploading = true;
      this.adminService.uploadImage(file).subscribe({
        next: (res) => {
          v.images.push(res.imageUrl);
          v.uploading = false;
        },
        error: () => {
          v.uploading = false;
          this.errorMsg.set(`Échec du téléversement de la photo "${file.name}".`);
        }
      });
    }
  }

  addVariantImageUrl(v: VariantForm) {
    const url = (v.newImageUrl || '').trim();
    if (url) {
      v.images.push(url);
      v.newImageUrl = '';
    }
  }

  removeVariantImage(v: VariantForm, index: number) {
    v.images.splice(index, 1);
  }

  setMainVariantImage(v: VariantForm, index: number) {
    const [img] = v.images.splice(index, 1);
    v.images.unshift(img);
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

    if (this.categories().length === 0) {
      this.errorMsg.set('Veuillez d\'abord créer au moins une catégorie dans "Gestion des Catégories".');
      return;
    }

    if (!this.productForm.name || !this.productForm.price) {
      this.errorMsg.set('Veuillez remplir tous les champs obligatoires (Nom et Prix).');
      return;
    }

    const variants = this.productForm.variants;
    if (variants.some(v => !v.colorName.trim())) {
      this.errorMsg.set('Chaque couleur doit avoir un nom.');
      return;
    }
    const names = variants.map(v => v.colorName.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      this.errorMsg.set('Deux couleurs portent le même nom.');
      return;
    }
    if (variants.some(v => v.uploading)) {
      this.errorMsg.set('Veuillez patienter, des photos sont en cours de téléversement.');
      return;
    }

    if (!this.productForm.imageUrl) {
      const firstVariantImage = variants.find(v => v.images.length > 0)?.images[0];
      this.productForm.imageUrl = firstVariantImage || 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600';
    }

    const extractMsg = (err: any, fallback: string) => {
      if (err.status === 403 || err.status === 401) {
        return 'Session expirée ou non autorisée (403). Veuillez vous connecter avec le compte administrateur.';
      }
      if (typeof err.error === 'string') return err.error;
      if (err.error?.error) return err.error.error;
      if (err.error?.message) return err.error.message;
      return fallback;
    };

    // Calculate total stock from sizeStocks
    const s = this.productForm.sizeStocks;
    this.productForm.stock = (Number(s['S']) || 0) + (Number(s['M']) || 0) + (Number(s['L']) || 0) + (Number(s['XL']) || 0);

    const payload = {
      ...this.productForm,
      stock: variants.length > 0 ? this.variantsTotalStock() : this.productForm.stock,
      variants: variants.map(v => ({
        id: v.id,
        colorName: v.colorName.trim(),
        colorHex: v.colorHex,
        images: v.images,
        sizeStocks: SIZES.reduce((acc, sz) => ({ ...acc, [sz]: Math.max(0, Number(v.sizeStocks[sz]) || 0) }), {} as { [key: string]: number })
      }))
    };

    if (this.modalMode() === 'add') {
      this.adminService.createProduct(payload).subscribe({
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
      this.adminService.updateProduct(this.productForm.id, payload).subscribe({
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
