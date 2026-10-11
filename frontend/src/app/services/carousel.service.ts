import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface CarouselSlide {
  id?: number;
  badge?: string;
  title: string;
  subtitle?: string;
  btnText?: string;
  link?: string;
  imageUrl: string;
  displayOrder?: number;
  active?: boolean;
}

export const DEFAULT_CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    id: 1,
    badge: 'NOUVELLE SAISON',
    title: 'SUBLIMEZ VOTRE ÉLÉGANCE',
    subtitle: 'Des pièces raffinées et intemporelles pour enrichir votre garde-robe avec distinction et style au quotidien.',
    btnText: 'DÉCOUVRIR LA BOUTIQUE',
    link: '/category',
    imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600&auto=format&fit=crop&q=80',
    displayOrder: 1,
    active: true
  },
  {
    id: 2,
    badge: 'COLLECTION FEMME',
    title: "L'AUDACE DU STYLE TUNISIEN",
    subtitle: 'Robes glamour, manteaux chics et ensembles signatures. Livraison rapide sur toute la Tunisie avec paiement à la livraison.',
    btnText: 'COMMANDER MAINTENANT',
    link: '/category',
    imageUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1600&auto=format&fit=crop&q=80',
    displayOrder: 2,
    active: true
  },
  {
    id: 3,
    badge: 'ÉDITION LIMITÉE',
    title: 'TENDANCES & COUPS DE CŒUR',
    subtitle: 'Profitez de notre sélection exclusive de prêt-à-porter féminin et sublimez chaque instant de votre journée.',
    btnText: 'VOIR LES TENDANCES',
    link: '/category',
    imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1600&auto=format&fit=crop&q=80',
    displayOrder: 3,
    active: true
  }
];

@Injectable({
  providedIn: 'root'
})
export class CarouselService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8081/api';

  getSlides(): Observable<CarouselSlide[]> {
    return this.http.get<CarouselSlide[]>(`${this.apiUrl}/carousel`).pipe(
      catchError(() => of(DEFAULT_CAROUSEL_SLIDES))
    );
  }

  getAdminSlides(): Observable<CarouselSlide[]> {
    return this.http.get<CarouselSlide[]>(`${this.apiUrl}/admin/carousel`).pipe(
      catchError(() => of(DEFAULT_CAROUSEL_SLIDES))
    );
  }

  createSlide(slide: Partial<CarouselSlide>): Observable<CarouselSlide> {
    return this.http.post<CarouselSlide>(`${this.apiUrl}/admin/carousel`, slide);
  }

  updateSlide(id: number, slide: Partial<CarouselSlide>): Observable<CarouselSlide> {
    return this.http.put<CarouselSlide>(`${this.apiUrl}/admin/carousel/${id}`, slide);
  }

  deleteSlide(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/carousel/${id}`);
  }

  toggleSlide(id: number): Observable<CarouselSlide> {
    return this.http.patch<CarouselSlide>(`${this.apiUrl}/admin/carousel/${id}/toggle`, {});
  }

  uploadImage(file: File): Observable<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ imageUrl: string }>(`${this.apiUrl}/admin/carousel/upload-image`, formData);
  }
}
