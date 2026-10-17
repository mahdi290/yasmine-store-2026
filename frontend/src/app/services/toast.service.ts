import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  actionLabel?: string;
  action?: () => void;
  link?: { label: string; url: string };
}

export interface ToastOptions {
  // Bouton dans le message, ex. "Annuler" après une suppression
  actionLabel?: string;
  action?: () => void;
  // Lien, ex. "Voir le panier"
  link?: { label: string; url: string };
  duration?: number;
}

/**
 * Petits messages non bloquants (remplacent window.alert, qui fige la page).
 * Affichés par ToastContainerComponent dans app.html.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  show(message: string, type: ToastType = 'success', options: ToastOptions = {}): number {
    const id = this.nextId++;
    const toast: Toast = { id, message, type, actionLabel: options.actionLabel, action: options.action, link: options.link };
    // 3 messages maximum à l'écran
    this.toasts.update(list => [...list.slice(-2), toast]);
    const duration = options.duration ?? (type === 'error' ? 5000 : options.action ? 6000 : 3500);
    setTimeout(() => this.dismiss(id), duration);
    return id;
  }

  success(message: string, options?: ToastOptions) {
    return this.show(message, 'success', options);
  }

  error(message: string, options?: ToastOptions) {
    return this.show(message, 'error', options);
  }

  info(message: string, options?: ToastOptions) {
    return this.show(message, 'info', options);
  }

  dismiss(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  runAction(toast: Toast) {
    toast.action?.();
    this.dismiss(toast.id);
  }
}
