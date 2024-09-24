import { Injectable } from '@angular/core'; // Importation de Injectable pour créer un service
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router'; // Importation des modules nécessaires pour la protection des routes
import { Observable } from 'rxjs'; // Importation d'Observable pour gérer les flux de données asynchrones
import { tap, map } from 'rxjs/operators'; // Importation des opérateurs pour transformer les données observables
import { AuthService } from './auth.service'; // Importation du service d'authentification

@Injectable({
  providedIn: 'root' 
})
export class AuthGuard implements CanActivate { 

  // Injection du service d'authentification et du routeur
  constructor(private authService: AuthService, private router: Router) {} 

  /**
  * Méthode pour déterminer si l'activation de la route est autorisée.
  * Cette méthode utilise le service d'authentification pour vérifier 
  * si l'utilisateur est connecté et s'il possède les autorisations 
  * requises en fonction du type de vérification spécifié.
  * 
  * @param route - L'objet ActivatedRouteSnapshot qui contient les informations sur la route actuelle, y compris les données associées à cette route.
  * @returns Observable<boolean> - Un observable qui émet true si l'activation de la route est autorisée, sinon false. La méthode redirige l'utilisateur 
  * vers la page de connexion si l'accès est refusé.
  */
  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> { 
    const checkType = route.data['checkType']; // Récupération du type de vérification depuis les données de la route

    return this.authService.isLoggedIn.pipe( // Accès à l'état de connexion de l'utilisateur via un observable
      map(isLoggedIn => { // Transformation des données de l'observable
        switch (checkType) { // Vérification du type de contrôle d'accès
          case 'dev':
            return isLoggedIn && this.authService.isDev; // L'utilisateur doit être connecté et avoir le rôle 'dev'
          case 'log':
            return isLoggedIn; // L'utilisateur doit être simplement connecté
          case 'sci':
            return isLoggedIn && (this.authService.isScientific || this.authService.isDev); // L'utilisateur doit être connecté et être soit scientifique soit développeur
          default:
            return false; // Si aucun type ne correspond, on refuse l'accès
        }
      }),
      tap(isAllowed => { // Effectue une action après que le résultat ait été déterminé
        if (!isAllowed) { // Si l'accès n'est pas autorisé
          this.router.navigate(['/login']); // Redirection vers la page de connexion
        }
      })
    ); // Retourne un observable qui émettra true ou false selon l'autorisation
  }
}
