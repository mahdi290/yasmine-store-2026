import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminOrder } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.scss']
})
export class AdminOrdersComponent implements OnInit {
  private adminService = inject(AdminService);
  private platformId = inject(PLATFORM_ID);

  // States
  orders = signal<AdminOrder[]>([]);
  loading = signal<boolean>(true);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  searchTerm = signal<string>('');
  statusFilter = signal<string>('ALL');

  statuses = ['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadOrders();
    } else {
      this.loading.set(false);
    }
  }

  loadOrders() {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.adminService.getOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Impossible de charger les commandes.');
        this.loading.set(false);
      }
    });
  }

  getFilteredOrders(): AdminOrder[] {
    let list = this.orders();

    // Filter by status
    const stat = this.statusFilter();
    if (stat !== 'ALL') {
      list = list.filter(o => o.status === stat);
    }

    // Filter by search term
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return list;

    return list.filter(o => 
      o.id.toString().includes(term) ||
      o.customerName.toLowerCase().includes(term) ||
      o.customerEmail.toLowerCase().includes(term)
    );
  }

  updateStatus(order: AdminOrder, newStatus: string) {
    this.errorMsg.set(null);
    this.successMsg.set(null);

    this.adminService.updateOrderStatus(order.id, newStatus).subscribe({
      next: () => {
        this.successMsg.set(`Le statut de la commande #${order.id} a été mis à jour.`);
        this.loadOrders();
      },
      error: (err) => {
        this.errorMsg.set(err.error || 'Échec de la mise à jour du statut.');
      }
    });
  }
}
