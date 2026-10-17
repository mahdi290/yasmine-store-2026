import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Category {
  id: number;
  name: string;
  department?: string;
  icon?: string;
}

// Variante couleur d'un produit (ex. pull rayé blanc / rouge / bleu)
export interface ProductVariant {
  id?: number;
  colorName: string;
  colorHex?: string | null;
  images: string[];
  imageUrl?: string | null;
  sizeStocks: { [key: string]: number };
  stock?: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category?: Category;
  brand: string;
  stock: number;
  imageUrl: string;
  createdAt?: string;
  sizeStocks?: { [key: string]: number };
  onSale?: boolean;
  discountPercent?: number;
  salePrice?: number;
  department?: string;
  // Vide ou absent pour les produits sans couleur (anciens produits)
  variants?: ProductVariant[];
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }

  getProducts(categoryId?: number): Observable<Product[]> {
    let params = new HttpParams();
    if (categoryId) {
      params = params.set('categoryId', categoryId.toString());
    }
    return this.http.get<Product[]>(`${this.apiUrl}/products`, { params });
  }

  getProductById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/products/${id}`);
  }
}
