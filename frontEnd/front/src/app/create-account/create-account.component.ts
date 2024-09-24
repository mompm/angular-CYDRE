import { Component } from '@angular/core';
import { AuthService } from '../service/auth.service';
import { Router } from '@angular/router';
import { UsersService } from '../service/users.service';

@Component({
  selector: 'app-create-account',
  templateUrl: './create-account.component.html',
  styleUrls: ['./create-account.component.scss']
})
/**
 * CreateAccountComponent gère la création de nouveaux utilisateurs.
 * Il fournit un formulaire pour saisir les informations nécessaires et gérer les messages d'erreur ou de succès.
 */
export class CreateAccountComponent {
  /** Objet utilisateur contenant les informations du nouvel utilisateur. */
  user = {
    username: '',
    password: '',
    role: ''
  };

  // Message d'erreur s'il y a un problème lors de la création de l'utilisateur. 
  errorMessage: string | null = null; 
  //Message de succès en cas de création réussie. 
  successMessage: string | null = null; 

  /**
   * Constructeur pour injecter les dépendances nécessaires.
   * @param authService Service d'authentification.
   * @param router Routeur Angular pour la navigation.
   * @param usersService Service pour la gestion des utilisateurs.
   */
  constructor(public authService: AuthService, private router: Router, private usersService: UsersService) {}

  /**
   * Méthode appelée lors de la soumission du formulaire.
   * Elle vérifie la validité du formulaire et tente de créer un nouvel utilisateur.
   * @param form Formulaire soumis.
   */
  onSubmit(form: any) {
    if (form.valid) { // Vérification si le formulaire est valide.
    console.log('Form Data:', form.value); // Log des données du formulaire.
    // Appel au service pour créer l'utilisateur avec les données du formulaire.
    this.usersService.createUser(this.user).subscribe({
      next: (response) => {
        console.log('User created:', response); // Log de la réponse de création réussie.
        this.successMessage = 'User created successfully'; // Message de succès.
        this.errorMessage = null; // Réinitialisation du message d'erreur.
      },
      error: (error) => {
        console.error('Error creating user:', error); // Log de l'erreur lors de la création.

        // Utilisation du code de statut HTTP pour déterminer le message d'erreur approprié.
        if (error.status === 409) {
          this.errorMessage = 'Username already exists'; // Message pour conflit de nom d'utilisateur.
        } else if (error.status === 400) {
          this.errorMessage = 'Missing required fields'; // Message pour champs manquants.
        } else {
          this.errorMessage = error.message || 'An unexpected error occurred'; // Message pour autres erreurs.
        }
        this.successMessage = null; // Réinitialisation du message de succès.
      }
    });
    }else {
      console.log('Form is not valid'); // Log si le formulaire n'est pas valide.
      this.errorMessage = 'Form is not valid'; // Message d'erreur pour formulaire invalide.
      this.successMessage = null; // Réinitialisation du message de succès.
    }
    // Redirection potentielle ou action après la soumission.
    // this.router.navigateByUrl("");
    if (this.authService.isLoggedIn) console.log("User logged in"); // Log si l'utilisateur est connecté.
  }

  /**
  * Méthode pour ajouter un nouvel utilisateur.
  * Cela pourrait être utilisé pour une fonctionnalité d'inscription.
  * @param username Nom d'utilisateur du nouvel utilisateur.
  * @param password Mot de passe du nouvel utilisateur.
  */
  addUser(username: string, password: string) {
    const newUser = { username: username, password: password, role: 'scientifique' }; // Création de l'objet utilisateur.
    console.log("adding user:", newUser); // Log pour vérifier les données de l'utilisateur.
    
    // Appel au service pour créer l'utilisateur.
    this.usersService.createUser(newUser).subscribe({
      next: (response) => console.log(response), // Log de la réponse en cas de création réussie.
      error: (error) => console.error(error) // Log de l'erreur en cas d'échec de la création.
    });
  }
}