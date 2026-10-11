import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShowcaseService, ShowcaseCard, DEFAULT_SHOWCASE_CARDS } from '../../../services/showcase.service';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-showcase',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-showcase.component.html',
  styleUrls: ['./admin-showcase.component.scss']
})
export class AdminShowcaseComponent implements OnInit {
  private showcaseService = inject(ShowcaseService);
  private adminService = inject(AdminService);
  private platformId = inject(PLATFORM_ID);

  cards = signal<ShowcaseCard[]>([]);
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  successMsg = signal<string | null>(null);
  errorMsg = signal<string | null>(null);
  uploadingCardKey = signal<string | null>(null);

  ngOnInit() {
    this.loadCards();
  }

  loadCards() {
    if (isPlatformBrowser(this.platformId)) {
      this.loading.set(true);
      this.showcaseService.getAdminShowcase().subscribe({
        next: (data) => {
          if (data && data.length > 0) {
            this.cards.set(JSON.parse(JSON.stringify(data)));
          } else {
            this.cards.set(JSON.parse(JSON.stringify(DEFAULT_SHOWCASE_CARDS)));
          }
          this.loading.set(false);
        },
        error: () => {
          this.cards.set(JSON.parse(JSON.stringify(DEFAULT_SHOWCASE_CARDS)));
          this.loading.set(false);
        }
      });
    } else {
      this.cards.set(JSON.parse(JSON.stringify(DEFAULT_SHOWCASE_CARDS)));
      this.loading.set(false);
    }
  }

  onImageSelected(event: Event, card: ShowcaseCard) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner un fichier image valide.');
        return;
      }
      this.uploadingCardKey.set(card.cardKey);
      this.adminService.uploadImage(file).subscribe({
        next: (res) => {
          card.imageUrl = res.imageUrl;
          this.uploadingCardKey.set(null);
        },
        error: () => {
          // Fallback to data URL
          const reader = new FileReader();
          reader.onload = (e) => {
            card.imageUrl = (e.target?.result as string) || '';
            this.uploadingCardKey.set(null);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  saveAll() {
    this.saving.set(true);
    this.successMsg.set(null);
    this.errorMsg.set(null);

    this.showcaseService.updateShowcase(this.cards()).subscribe({
      next: (updated) => {
        this.cards.set(JSON.parse(JSON.stringify(updated)));
        this.saving.set(false);
        this.successMsg.set('Les 4 bannières de la vitrine ont été enregistrées avec succès !');
        setTimeout(() => this.successMsg.set(null), 4000);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set('Erreur lors de la mise à jour : ' + (err.error?.message || err.message));
        setTimeout(() => this.errorMsg.set(null), 5000);
      }
    });
  }

  resetToDefault() {
    if (confirm('Voulez-vous réinitialiser les 4 bannières aux valeurs par défaut ?')) {
      this.cards.set(JSON.parse(JSON.stringify(DEFAULT_SHOWCASE_CARDS)));
      this.saveAll();
    }
  }
}
