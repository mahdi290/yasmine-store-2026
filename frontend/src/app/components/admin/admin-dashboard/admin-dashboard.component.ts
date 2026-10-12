import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AdminService, DashboardStats } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  private adminService = inject(AdminService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  // States
  stats = signal<DashboardStats | null>(null);
  loading = signal<boolean>(true);
  errorMsg = signal<string | null>(null);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadStats();
    } else {
      this.loading.set(false);
    }
  }

  loadStats() {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.adminService.getStats().subscribe({
      next: (res) => {
        this.stats.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 403 || err.status === 401) {
          this.errorMsg.set('Accès refusé (403). Veuillez vous connecter avec le compte administrateur.');
        } else {
          this.errorMsg.set('Impossible de charger les statistiques du tableau de bord.');
        }
      }
    });
  }

  // Calculate percentage of category revenue relative to total
  getPercent(revenue: number): number {
    const total = this.stats()?.totalRevenue || 0;
    if (total === 0) return 0;
    return Math.round((revenue / total) * 100);
  }
}
