import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authUrl = 'http://localhost:5000'; // URL de base de l'API d'authentification.
  private loggedIn = new BehaviorSubject<boolean>(false); // Sujet comportemental pour suivre l'état de connexion.

  /**
  * Constructeur de AuthService.
  * @param http - Instance de HttpClient pour les requêtes HTTP.
  * @param router - Instance de Router pour la navigation.
  */
  constructor(private http: HttpClient, private router: Router) {
    this.checkLoginStatus();// Vérifie le statut de connexion au démarrage du service.
  }

  /**
   * Méthode pour initier la connexion
   * @param username - Nom d'utilisateur pour la connexion.
   * @param password - Mot de passe pour la connexion.
   * @returns Observable avec la réponse du serveur.
   */
  login(username: string, password: string): Observable<any> {
    // Envoi d'une requête POST pour la connexion.
    return this.http.post<any>(`${this.authUrl}/api/login`, { username, password }, { withCredentials: true }).pipe(
      // Utilisation de tap pour effectuer une action en cas de réponse.
      tap(response => {
        // Si la connexion est réussie.
        if (response.username) {
          this.loggedIn.next(true); // Met à jour l'état de connexion à vrai.
          // Stocke les informations de l'utilisateur dans le stockage de session.
          sessionStorage.setItem('username', response.username);
          sessionStorage.setItem('role', response.role);
          sessionStorage.setItem('UserID', response.UserID)
          sessionStorage.removeItem('lastSimulationId'); // Nettoie l'ID de simulation précédente.
        }
      })
    );
  }

  /**
  * Méthode pour déclencher la déconnexion
  * @returns Observable avec la réponse du serveur.
  */
  logout(): Observable<any> {
    // Envoi d'une requête POST pour la déconnexion.
    return this.http.post<any>(`${this.authUrl}/api/logout`, {}, { withCredentials: true }).pipe(
      // Utilisation de tap pour effectuer une action après la déconnexion.
      tap(() => {
        this.clearClientSession(); // Appelle la méthode pour effacer la session du client.
      })
    );
  }

  /**
  * Efface les informations de session du client.
  */
  private clearClientSession(): void {
    // Suppression des éléments du stockage de session.
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('UserID');
    sessionStorage.removeItem('lastSimulationId');
    this.loggedIn.next(false); // Met à jour l'état de connexion à faux.
    this.router.navigate(['/login']); // Redirige l'utilisateur vers la page de connexion.
  }


  /**
  * Récupère le statut de connexion.
  * @returns Observable de l'état de connexion.
  */
  get isLoggedIn(): Observable<boolean> {
    return this.loggedIn.asObservable();// Renvoie l'état de connexion sous forme d'Observable.
  }

  /**
  * Récupère le nom d'utilisateur.
  * @returns Nom d'utilisateur ou null s'il n'est pas connecté.
  */
  get username(): string | null {
    return sessionStorage.getItem('username');  // Récupère le nom d'utilisateur du stockage de session.
  }

  /**
  * Récupère le rôle de l'utilisateur.
  * @returns Rôle de l'utilisateur ou null s'il n'est pas connecté.
  */
  get role(): string | null {
    return sessionStorage.getItem('role'); // Récupère le role d'utilisateur du stockage de session.
  }

  /**
  * Vérifie si l'utilisateur est un développeur.
  * @returns true si l'utilisateur est un développeur, sinon false.
  */
  get isDev(): boolean {
    return this.role === 'dev';// Vérifie le rôle de l'utilisateur.
  }

  /**
  * Vérifie si l'utilisateur est un scientifique.
  * @returns true si l'utilisateur est un scientifique, sinon false.
  */
  get isScientific(): boolean {
    return this.role === 'scientifique';// Vérifie le rôle de l'utilisateur.
  }

  /**
  * Vérifie si l'utilisateur est un scientifique ou un développeur.
  * @returns true si l'utilisateur est un scientifique ou un développeur, sinon false.
  */
  get isScientificOrDev(): boolean {
    return this.role === 'scientifique' || this.role === 'dev';// Vérifie les rôles de l'utilisateur.
  }

  /**
  * Vérifie le statut de connexion lors de l'initialisation.
  */
  private checkLoginStatus(): void {
    const userID = sessionStorage.getItem('UserID'); // Récupère l'ID de l'utilisateur du stockage de session.
    if (userID) {
      this.loggedIn = new BehaviorSubject<boolean>(true); // Si l'ID existe, l'utilisateur est connecté.
    } else {
      this.loggedIn = new BehaviorSubject<boolean>(false); // Sinon, l'utilisateur n'est pas connecté.
    }
  }
}