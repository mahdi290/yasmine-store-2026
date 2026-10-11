import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ProductService, Product } from './product.service';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WishlistService {
  private productService = inject(ProductService);
  private platformId = inject(PLATFORM_ID);
  private storageKey = 'yasmina_wishlist_ids';

  private favoriteIdsSignal = signal<number[]>([]);
  public favoriteIds = this.favoriteIdsSignal.asReadonly();
  public favoritesCount = computed(() => this.favoriteIdsSignal().length);

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.favoriteIdsSignal.set(parsed);
          }
        }
      } catch (e) {
        console.error('Error loading wishlist from storage', e);
      }
    }
  }

  private saveToStorage(ids: number[]) {
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(ids));
      } catch (e) {
        console.error('Error saving wishlist to storage', e);
      }
    }
  }

  isFavorite(productId: number): boolean {
    return this.favoriteIdsSignal().includes(productId);
  }

  toggleFavorite(productId: number): boolean {
    const current = [...this.favoriteIdsSignal()];
    const index = current.indexOf(productId);
    let isNowFav = false;

    if (index > -1) {
      current.splice(index, 1);
      isNowFav = false;
    } else {
      current.push(productId);
      isNowFav = true;
    }

    this.favoriteIdsSignal.set(current);
    this.saveToStorage(current);
    return isNowFav;
  }

  removeFavorite(productId: number) {
    const current = this.favoriteIdsSignal().filter(id => id !== productId);
    this.favoriteIdsSignal.set(current);
    this.saveToStorage(current);
  }

  clearFavorites() {
    this.favoriteIdsSignal.set([]);
    this.saveToStorage([]);
  }

  getFavoriteProducts(): Observable<Product[]> {
    return this.productService.getProducts().pipe(
      map(products => {
        const favIds = this.favoriteIdsSignal();
        return products.filter(p => favIds.includes(p.id));
      })
    );
  }
}
