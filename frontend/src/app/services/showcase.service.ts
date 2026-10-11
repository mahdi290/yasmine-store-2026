import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ShowcaseCard {
  id?: number;
  cardKey: string;
  title: string;
  badge: string;
  description: string;
  imageUrl: string;
  categoryQueryName: string;
  colClass: string;
  displayOrder?: number;
}

export const DEFAULT_SHOWCASE_CARDS: ShowcaseCard[] = [
  {
    cardKey: 'card1',
    title: 'Robes & Ensembles',
    badge: 'PIÈCES EMBLÉMATIQUES',
    description: 'Des coupes fluides et sophistiquées pour toutes vos occasions.',
    imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=900&auto=format&fit=crop&q=80',
    categoryQueryName: 'Robes',
    colClass: 'col-lg-7 col-md-12',
    displayOrder: 1
  },
  {
    cardKey: 'card2',
    title: 'Hauts & Chemisiers',
    badge: 'CHIC QUOTIDIEN',
    description: 'Blouses légères, chemises modernes et coupes fluides.',
    imageUrl: 'https://images.unsplash.com/photo-1551803091-e20673f15770?w=900&auto=format&fit=crop&q=80',
    categoryQueryName: 'Hauts & Blouses',
    colClass: 'col-lg-5 col-md-6',
    displayOrder: 2
  },
  {
    cardKey: 'card3',
    title: 'Maille & Sweats',
    badge: 'DOUCEUR DE SAISON',
    description: 'Pulls douillets et cardigans élégants pour les journées fraîches.',
    imageUrl: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=900&auto=format&fit=crop&q=80',
    categoryQueryName: 'Maille',
    colClass: 'col-lg-5 col-md-6',
    displayOrder: 3
  },
  {
    cardKey: 'card4',
    title: 'Accessoires & Maroquinerie',
    badge: 'FINITIONS RAFFINÉES',
    description: 'Sacs en cuir, solaires et accessoires pour parfaire votre allure.',
    imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=900&auto=format&fit=crop&q=80',
    categoryQueryName: 'Accessoires',
    colClass: 'col-lg-7 col-md-12',
    displayOrder: 4
  }
];

@Injectable({
  providedIn: 'root'
})
export class ShowcaseService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getShowcaseCards(): Observable<ShowcaseCard[]> {
    return this.http.get<ShowcaseCard[]>(`${this.apiUrl}/showcase`).pipe(
      catchError(() => of(DEFAULT_SHOWCASE_CARDS))
    );
  }

  getAdminShowcase(): Observable<ShowcaseCard[]> {
    return this.http.get<ShowcaseCard[]>(`${this.apiUrl}/admin/showcase`).pipe(
      catchError(() => of(DEFAULT_SHOWCASE_CARDS))
    );
  }

  updateShowcase(cards: ShowcaseCard[]): Observable<ShowcaseCard[]> {
    return this.http.put<ShowcaseCard[]>(`${this.apiUrl}/admin/showcase`, cards);
  }

  updateSingleCard(cardKey: string, card: ShowcaseCard): Observable<ShowcaseCard> {
    return this.http.put<ShowcaseCard>(`${this.apiUrl}/admin/showcase/${cardKey}`, card);
  }
}
