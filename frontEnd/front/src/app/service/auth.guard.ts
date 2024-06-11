import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    const checkType = route.data['checkType'];

    return this.authService.isLoggedIn.pipe(
      map(isLoggedIn => {
        switch (checkType) {
          case 'dev':
            return isLoggedIn && this.authService.isDev; // L'utilisateur est connecté et développeur
          case 'log':
            return isLoggedIn; // L'utilisateur est connecté 
          case 'sci':
            return isLoggedIn && (this.authService.isScientific ||this.authService.isDev); // L'utilisateur est connecté et scientifique (ou dev)
          default:
            return false;
        }
      }),
      tap(isAllowed => {
        if (!isAllowed) {
          this.router.navigate(['/login']); // Redirection seulement si non autorisé
        }
      })
    );
  }
}
