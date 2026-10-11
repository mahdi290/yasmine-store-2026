import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CarouselService, CarouselSlide } from '../../../services/carousel.service';

@Component({
  selector: 'app-admin-carousel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-carousel.component.html',
  styleUrls: ['./admin-carousel.component.scss']
})
export class AdminCarouselComponent implements OnInit {
  private carouselService = inject(CarouselService);

  slides = signal<CarouselSlide[]>([]);
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  uploadingImage = signal<boolean>(false);
  successMessage = signal<string>('');
  errorMessage = signal<string>('');

  // Modal / Form state
  showModal = signal<boolean>(false);
  isEditMode = signal<boolean>(false);

  formData: CarouselSlide = {
    title: '',
    badge: 'NOUVELLE SAISON',
    subtitle: '',
    btnText: 'DÉCOUVRIR LA BOUTIQUE',
    link: '/category',
    imageUrl: '',
    displayOrder: 1,
    active: true
  };

  ngOnInit() {
    this.loadSlides();
  }

  loadSlides() {
    this.loading.set(true);
    this.carouselService.getAdminSlides().subscribe({
      next: (res) => {
        this.slides.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Erreur lors du chargement des bannières.');
        this.loading.set(false);
      }
    });
  }

  openCreateModal() {
    this.isEditMode.set(false);
    this.formData = {
      title: '',
      badge: 'NOUVELLE SAISON',
      subtitle: '',
      btnText: 'DÉCOUVRIR LA BOUTIQUE',
      link: '/category',
      imageUrl: '',
      displayOrder: this.slides().length + 1,
      active: true
    };
    this.clearMessages();
    this.showModal.set(true);
  }

  openEditModal(slide: CarouselSlide) {
    this.isEditMode.set(true);
    this.formData = { ...slide };
    this.clearMessages();
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  clearMessages() {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.uploadingImage.set(true);
    this.clearMessages();

    this.carouselService.uploadImage(file).subscribe({
      next: (res) => {
        this.formData.imageUrl = res.imageUrl;
        this.uploadingImage.set(false);
        this.successMessage.set('Image importée avec succès !');
      },
      error: (err) => {
        this.uploadingImage.set(false);
        this.errorMessage.set(err.error?.error || "Erreur lors de l'upload de l'image.");
      }
    });
  }

  saveSlide() {
    if (!this.formData.title || !this.formData.title.trim()) {
      this.errorMessage.set('Veuillez renseigner le titre du slide.');
      return;
    }
    if (!this.formData.imageUrl || !this.formData.imageUrl.trim()) {
      this.errorMessage.set('Veuillez ajouter une image pour le slide.');
      return;
    }

    this.saving.set(true);
    this.clearMessages();

    if (this.isEditMode() && this.formData.id) {
      this.carouselService.updateSlide(this.formData.id, this.formData).subscribe({
        next: () => {
          this.saving.set(false);
          this.successMessage.set('Slide mis à jour avec succès.');
          this.showModal.set(false);
          this.loadSlides();
        },
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('Erreur lors de la mise à jour du slide.');
        }
      });
    } else {
      this.carouselService.createSlide(this.formData).subscribe({
        next: () => {
          this.saving.set(false);
          this.successMessage.set('Nouveau slide créé avec succès !');
          this.showModal.set(false);
          this.loadSlides();
        },
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('Erreur lors de la création du slide.');
        }
      });
    }
  }

  toggleActive(slide: CarouselSlide) {
    if (!slide.id) return;
    this.carouselService.toggleSlide(slide.id).subscribe({
      next: (updated) => {
        this.slides.update(list => list.map(s => s.id === updated.id ? updated : s));
      }
    });
  }

  deleteSlide(slide: CarouselSlide) {
    if (!slide.id) return;
    if (confirm(`Êtes-vous sûr de vouloir supprimer le slide "${slide.title}" ?`)) {
      this.carouselService.deleteSlide(slide.id).subscribe({
        next: () => {
          this.successMessage.set('Slide supprimé.');
          this.slides.update(list => list.filter(s => s.id !== slide.id));
        },
        error: () => {
          this.errorMessage.set('Erreur lors de la suppression.');
        }
      });
    }
  }
}
