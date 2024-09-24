import { Component,EventEmitter, OnInit, ViewEncapsulation, Output, Input } from '@angular/core';
import { AuthService } from 'src/app/service/auth.service';
import {MatTabsModule} from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { Documentation } from 'src/app/baseSite/documentation/documentation';


@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
/**
 * NavbarComponent gère la barre de navigation de l'application, 
 * incluant les fonctionnalités de connexion, déconnexion et changement de langue.
 */
export class NavbarComponent implements OnInit {
  /** Émetteur d'événements pour changer le titre. */
  @Output() titleChange = new EventEmitter<string>();

  /** Titre affiché dans la barre de navigation. */
  title: string = "modelingTitle";

  /** Indicateur de connexion de l'utilisateur. */
  isLoggedIn!: boolean;

  /** Langue sélectionnée pour la traduction. */
  selectLang: string = "";

  /** Liste des langues disponibles. */
  transLang: string[] = [];

  /**
   * Constructeur pour injecter les services nécessaires.
   * @param translate Service de traduction pour gérer les langues.
   * @param authService Service d'authentification pour gérer l'état de connexion.
   * @param dialog Service pour ouvrir des dialogues Material.
   */
  constructor(public translate: TranslateService, public authService: AuthService, public dialog: MatDialog) {
    // Définir la langue par défaut et ajouter des langues disponibles.
    translate.setDefaultLang('FR');
    translate.addLangs(['EN', 'FR']);
    translate.use('FR'); // Utilisation de la langue française par défaut.
    this.selectLang = translate.currentLang; // Initialisation de la langue sélectionnée.
  }

  /**
   * Change la langue de traduction en fonction de la sélection de l'utilisateur.
   */
  setTransLanguage() {
    this.translate.use(this.selectLang); // Changement de la langue utilisée.
  }

  /**
   * Récupère les langues disponibles pour la traduction.
   */
  getTransLanguage() {
    this.transLang = [...this.translate.getLangs()]; // Récupération de la liste des langues.
  }

  /**
   * Méthode appelée lors de l'initialisation du composant.
   * Elle s'abonne à l'état de connexion de l'utilisateur.
   */
  ngOnInit() {
    this.getTransLanguage(); // Récupération des langues disponibles à l'initialisation.
    // S'abonne au changement d'état de connexion de l'utilisateur.
    this.authService.isLoggedIn.subscribe((status) => {
      this.isLoggedIn = status; // Mise à jour de l'état de connexion.
    });
  }

  /**
   * Méthode de changement d'état de connexion (à développer si nécessaire).
   */
  change() {
    // this.authService.isLogging = false; // Commenté pour l'instant.
  }

  /**
   * Déconnexion de l'utilisateur et gestion de la réponse.
   */
  logout() {
    this.authService.logout().subscribe({
      next: response => {
        console.log("Déconnexion réussie", response); // Message de réussite.
      },
      error: err => {
        console.error("Erreur lors de la déconnexion", err); // Gestion des erreurs.
      }
    });
  }

  /**
   * Méthode appelée lors du clic sur le bouton de connexion.
   */
  login() {
    console.log("User clicked on login page"); // Journalisation pour le débogage.
  }

  /**
   * Méthode appelée lors du clic sur le bouton d'accueil.
   */
  home() {
    console.log("User clicked on home page"); // Journalisation pour le débogage.
  }

  /**
   * Méthode appelée lors du clic sur le bouton des paramètres.
   */
  settings() {
    console.log("User clicked on settings page"); // Journalisation pour le débogage.
  }

  /**
   * Méthode appelée lors du clic sur le bouton du simulateur.
   */
  simulator() {
    console.log("User clicked on simulator page"); // Journalisation pour le débogage.
  }

  /**
   * Méthode appelée lors du clic sur le bouton de l'historique.
   */
  history() {
    console.log("User clicked on history page"); // Journalisation pour le débogage.
  }

  /**
   * Méthode appelée lors du clic sur le bouton fiche de site.
   */
  ficheSite() {
    console.log("User clicked on fiche de site page"); // Journalisation pour le débogage.
  }

  /**
   * Méthode appelée lors du clic sur le bouton de création de compte.
   */
  createAccount() {
    console.log("User clicked on create account page"); // Journalisation pour le débogage.
  }

  /**
   * Ouvre un dialogue de documentation pour afficher les informations nécessaires.
   */
  openDialog() {
    this.dialog.open(Documentation, {}); // Ouverture du dialogue de documentation.
  }
}