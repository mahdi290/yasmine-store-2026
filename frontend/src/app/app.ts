import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  protected readonly title = signal('Yasmina Store');
  isAdminRoute = signal<boolean>(false);

  ngOnInit() {
    this.checkRoute();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkRoute();
    });
  }

  private checkRoute() {
    if (isPlatformBrowser(this.platformId)) {
      this.isAdminRoute.set(window.location.pathname.startsWith('/admin'));
    } else {
      this.isAdminRoute.set(this.router.url.startsWith('/admin'));
    }
  }
}
