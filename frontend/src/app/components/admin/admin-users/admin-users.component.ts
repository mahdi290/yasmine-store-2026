import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminUser } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {
  private adminService = inject(AdminService);
  authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  // States
  users = signal<AdminUser[]>([]);
  loading = signal<boolean>(true);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  searchTerm = signal<string>('');
  roleFilter = signal<string>('ALL');

  // Modal Control
  modalMode = signal<'delete' | 'none'>('none');
  selectedUser = signal<AdminUser | null>(null);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadUsers();
    } else {
      this.loading.set(false);
    }
  }

  loadUsers() {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.adminService.getUsers().subscribe({
      next: (data) => {
        this.users.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Impossible de charger les utilisateurs.');
        this.loading.set(false);
      }
    });
  }

  getFilteredUsers(): AdminUser[] {
    let list = this.users();

    // Filter by role
    const role = this.roleFilter();
    if (role !== 'ALL') {
      list = list.filter(u => u.role === role);
    }

    // Filter by search term
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return list;

    return list.filter(u => 
      u.firstname.toLowerCase().includes(term) ||
      u.lastname.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  }

  toggleRole(user: AdminUser) {
    this.errorMsg.set(null);
    this.successMsg.set(null);

    const currentUser = this.authService.currentUser();
    if (currentUser && currentUser.userId === user.id) {
      this.errorMsg.set('Vous ne pouvez pas modifier votre propre rôle.');
      return;
    }

    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';

    this.adminService.updateUserRole(user.id, newRole).subscribe({
      next: () => {
        this.successMsg.set(`Le rôle de l'utilisateur ${user.email} a été modifié en ${newRole}`);
        this.loadUsers();
      },
      error: (err) => {
        this.errorMsg.set(err.error || 'Échec de la modification du rôle.');
      }
    });
  }

  openDeleteModal(user: AdminUser) {
    const currentUser = this.authService.currentUser();
    if (currentUser && currentUser.userId === user.id) {
      this.errorMsg.set('Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    this.modalMode.set('delete');
    this.selectedUser.set(user);
  }

  closeModal() {
    this.modalMode.set('none');
    this.selectedUser.set(null);
  }

  deleteUser() {
    const user = this.selectedUser();
    if (!user) return;

    this.errorMsg.set(null);
    this.successMsg.set(null);

    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.successMsg.set('Utilisateur supprimé avec succès !');
        this.loadUsers();
        this.closeModal();
      },
      error: (err) => {
        this.errorMsg.set(err.error?.error || 'Échec de la suppression de l’utilisateur.');
        this.closeModal();
      }
    });
  }
}
