import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  // States
  isRegisterMode = signal<boolean>(true);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  loading = signal<boolean>(false);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const mode = params['mode'];
      if (mode === 'register') {
        this.isRegisterMode.set(true);
      } else if (mode === 'login') {
        this.isRegisterMode.set(false);
      }
    });
  }

  // Reactive Forms
  registerForm: FormGroup = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
    country: [''],
    agreeTerms: [false, Validators.requiredTrue],
    newsletter: [false]
  });

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  toggleMode() {
    this.isRegisterMode.update(val => !val);
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.registerForm.reset();
    this.loginForm.reset();
  }

  onRegister() {
    this.errorMsg.set(null);
    this.successMsg.set(null);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();

      if (this.registerForm.get('agreeTerms')?.hasError('required')) {
        this.errorMsg.set('Vous devez accepter les Conditions d’utilisation et la Politique de confidentialité.');
        return;
      }
      this.errorMsg.set('Veuillez remplir correctement tous les champs obligatoires.');
      return;
    }

    const { fullName, email, password, confirmPassword } = this.registerForm.value;

    if (password !== confirmPassword) {
      this.errorMsg.set('Les mots de passe ne correspondent pas.');
      return;
    }

    this.loading.set(true);

    const nameParts = (fullName || '').trim().split(/\s+/);
    const firstname = nameParts[0] || 'Utilisateur';
    const lastname = nameParts.slice(1).join(' ') || 'Utilisateur';

    this.authService.register(firstname, lastname, email, password).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        this.router.navigate([returnUrl]);
      },
      error: (err) => {
        this.loading.set(false);
        const message = typeof err.error === 'string' ? err.error : 'Échec de l’inscription. Cet email est peut-être déjà utilisé.';
        this.errorMsg.set(message);
      }
    });
  }

  onLogin() {
    this.errorMsg.set(null);
    this.successMsg.set(null);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMsg.set('Veuillez entrer votre email et votre mot de passe.');
      return;
    }

    const { email, password } = this.loginForm.value;
    this.loading.set(true);

    this.authService.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        this.router.navigate([returnUrl]);
      },
      error: (err) => {
        this.loading.set(false);
        const message = typeof err.error === 'string' ? err.error : 'Email ou mot de passe incorrect.';
        this.errorMsg.set(message);
      }
    });
  }
}
