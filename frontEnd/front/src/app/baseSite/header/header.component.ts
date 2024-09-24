import { Component, ViewEncapsulation , Input, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

//configuration element
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
/**
 * HeaderComponent gère l'en-tête de l'application, y compris le sous-titre
 * qui change en fonction de la route active.
 */
export class HeaderComponent implements OnInit {
  /** Variable d'entrée pour vérifier si l'utilisateur est connecté. */
  @Input() isLoggedIn!: boolean;
  /** Sous-titre par défaut affiché dans l'en-tête. */
  subtitle: string = 'DefaultTitle';

  /**
   * Constructeur pour injecter le service Router.
   * @param router Le service Router pour écouter les événements de navigation.
   */
  constructor(private router: Router) {}

  /**
   * Méthode appelée lors de l'initialisation du composant.
   * Elle s'abonne aux événements de routage pour mettre à jour le sous-titre
   * en fonction de la route active.
   */
  ngOnInit(): void {
    // S'abonne aux événements de navigation pour détecter les changements de route.
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        // Vérifie la route actuelle à partir de l'URL.
        const currentRoute = this.router.url;

        // Met à jour le sous-titre en fonction de la route active.
        switch (currentRoute) {
          case '/home':
            this.subtitle = 'homeTitle'; // Titre pour la page d'accueil.
            break;
          case '/ficheSite':
            this.subtitle = 'ficheSitesubTitle'; // Titre pour la page fiche site.
            break;
          case '/settings':
            this.subtitle = 'settingsTitle'; // Titre pour la page des paramètres.
            break;
          case '/login':
            this.subtitle = 'loginTitle'; // Titre pour la page de connexion.
            break;
          case '/modeling':
            this.subtitle = 'modelingTitle'; // Titre pour la page de modélisation.
            break;
          case '/simulator':
            this.subtitle = 'simulatorsubTitle'; // Titre pour la page du simulateur.
            break;
          case '/analysis':
            this.subtitle = 'analysisTitle'; // Titre pour la page d'analyse.
            break;
          case '/simulationHistory':
            this.subtitle = 'Mes simulations'; // Titre pour l'historique des simulations.
            break;

          default:
            this.subtitle = 'DefaultTitle'; // Titre par défaut si aucune route ne correspond.
            break;
        }
      }
    });
  }
}