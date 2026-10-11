import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserSession {
  token: string;
  userId: number;
  email: string;
  firstname: string;
  lastname: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  
  // Track current user session using Angular Signals
  currentUser = signal<UserSession | null>(null);

  constructor() {
    this.loadSession();
  }

  private loadSession() {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('user_session');
      const savedToken = localStorage.getItem('token');
      if (savedUser && savedToken) {
        try {
          this.currentUser.set(JSON.parse(savedUser));
        } catch (e) {
          this.logout();
        }
      }
    }
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  register(firstname: string, lastname: string, email: string, password: string): Observable<UserSession> {
    return this.http.post<UserSession>(`${this.apiUrl}/register`, { firstname, lastname, email, password }).pipe(
      tap(session => this.setSession(session))
    );
  }

  login(email: string, password: string): Observable<UserSession> {
    return this.http.post<UserSession>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(session => this.setSession(session))
    );
  }

  private setSession(session: UserSession) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', session.token);
      localStorage.setItem('user_session', JSON.stringify(session));
    }
    this.currentUser.set(session);
  }

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user_session');
    }
    this.currentUser.set(null);
  }
}
