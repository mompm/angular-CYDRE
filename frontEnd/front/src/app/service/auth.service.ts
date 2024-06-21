import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authUrl = 'http://localhost:5000';
  private loggedIn = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient, private router: Router) {}

  // Méthode pour initier la connexion
  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.authUrl}/api/login`, { username, password }, { withCredentials: true }).pipe(
      tap(response => {
        if (response.username) {
          this.loggedIn.next(true);
          localStorage.setItem('username', response.username);
          localStorage.setItem('role', response.role);
          localStorage.setItem('UserID', response.UserID)
          localStorage.removeItem('lastSimulationId');
        }
      })
    );
  }

  // Méthode pour déclencher la déconnexion
  logout(): Observable<any> {
    return this.http.post<any>(`${this.authUrl}/api/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.clearClientSession();
      })
    );
  }

  // Effacer la session client
  private clearClientSession(): void {
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('UserID');
    localStorage.removeItem('lastSimulationId');
    this.loggedIn.next(false);
    this.router.navigate(['/login']);
  }

  // Récupérer le statut de connexion
  get isLoggedIn(): Observable<boolean> {
    return this.loggedIn.asObservable();
  }

  // Récupérer le nom d'utilisateur
  get username(): string | null {
    return localStorage.getItem('username');
  }

  // Récupérer le rôle de l'utilisateur
  get role(): string | null {
    return localStorage.getItem('role');
  }

  // Vérifier si l'utilisateur est un développeur
  get isDev(): boolean {
    return this.role === 'dev';
  }

  // Vérifier si l'utilisateur est un scientifique
  get isScientific(): boolean {
    return this.role === 'scientifique';
  }

  // Vérifier si l'utilisateur est un scientifique ou un développeur
  get isScientificOrDev(): boolean {
    return this.role === 'scientifique' || this.role === 'dev';
  }
}
