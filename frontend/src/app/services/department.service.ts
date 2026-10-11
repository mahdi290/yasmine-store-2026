import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Department {
  id?: number;
  name: string;
  code: string;
  description?: string;
  subcategories?: string;
  displayOrder?: number;
  active?: boolean;
}

export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: 1,
    name: 'FEMME',
    code: 'femme',
    description: 'Prêt-à-porter et collections féminines',
    subcategories: 'Robes, Hauts & Blouses, Maille, Manteaux & Vestes, Accessoires, Ensembles, Jupes',
    displayOrder: 1,
    active: true
  },
  {
    id: 2,
    name: 'HOMME',
    code: 'homme',
    description: 'Mode masculine et pièces élégantes',
    subcategories: 'Chemises & Polos, Pantalons, Costumes, Manteaux & Vestes, Chaussures, Accessoires',
    displayOrder: 2,
    active: true
  }
];

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(`${this.apiUrl}/departments`).pipe(
      catchError(() => of(DEFAULT_DEPARTMENTS))
    );
  }

  getAdminDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(`${this.apiUrl}/admin/departments`).pipe(
      catchError(() => of(DEFAULT_DEPARTMENTS))
    );
  }

  createDepartment(dept: Partial<Department>): Observable<Department> {
    return this.http.post<Department>(`${this.apiUrl}/admin/departments`, dept);
  }

  updateDepartment(id: number, dept: Partial<Department>): Observable<Department> {
    return this.http.put<Department>(`${this.apiUrl}/admin/departments/${id}`, dept);
  }

  deleteDepartment(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/departments/${id}`);
  }

  toggleDepartment(id: number): Observable<Department> {
    return this.http.patch<Department>(`${this.apiUrl}/admin/departments/${id}/toggle`, {});
  }
}
