import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (t of toastService.toasts(); track t.id) {
        <div class="toast-item" [class.is-error]="t.type === 'error'" [class.is-info]="t.type === 'info'" role="status">
          <i class="bi toast-icon"
             [class.bi-check-circle-fill]="t.type === 'success'"
             [class.bi-exclamation-circle-fill]="t.type === 'error'"
             [class.bi-info-circle-fill]="t.type === 'info'"></i>
          <span class="toast-text">{{ t.message }}</span>
          @if (t.link) {
            <a class="toast-btn" [routerLink]="t.link.url" (click)="toastService.dismiss(t.id)">{{ t.link.label }}</a>
          }
          @if (t.actionLabel) {
            <button type="button" class="toast-btn" (click)="toastService.runAction(t)">{{ t.actionLabel }}</button>
          }
          <button type="button" class="toast-close" (click)="toastService.dismiss(t.id)" aria-label="Fermer le message">
            <i class="bi bi-x"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      right: 20px;
      bottom: 84px;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: min(420px, calc(100vw - 32px));
      pointer-events: none;
    }
    .toast-item {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      background: #314021;
      color: #ffffff;
      border-radius: 12px;
      padding: 10px 10px 10px 14px;
      font-size: 13.5px;
      line-height: 1.35;
      box-shadow: 0 8px 24px rgba(12, 13, 7, 0.22);
      animation: toast-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .toast-item.is-error { background: #8f2430; }
    .toast-item.is-info { background: #0C0D07; }
    .toast-icon { font-size: 16px; color: #C09BAC; flex-shrink: 0; }
    .toast-item.is-error .toast-icon { color: #ffd6da; }
    .toast-text { flex: 1; min-width: 0; }
    .toast-btn {
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.14);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 5px 10px;
      font-size: 12.5px;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
    }
    .toast-btn:hover { background: rgba(255, 255, 255, 0.26); color: #ffffff; }
    .toast-close {
      flex-shrink: 0;
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.75);
      font-size: 18px;
      line-height: 1;
      padding: 2px 4px;
    }
    @media (max-width: 575.98px) {
      .toast-stack { left: 16px; right: 16px; bottom: 76px; max-width: none; }
    }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
}
