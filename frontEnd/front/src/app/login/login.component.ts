import {Component, OnInit} from '@angular/core';
import { AuthService } from '../service/auth.service';
import { Router } from '@angular/router';
import { UsersService } from '../service/users.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit{

  username: string = ''; //Nom d'utilisateur saisi par l'utilisateur.
  password: string = ''; //Mot de passe saisi par l'utilisateur.

  errorMessage: string | null = null; // Message d'erreur s'il y a une tentative de connexion infructueuse.
  successMessage: string | null = null; // Message de succès en cas de connexion réussie.

  /**
   * Constructeur pour injecter les dépendances nécessaires.
   * @param authService Service d'authentification.
   * @param router Routeur Angular pour la navigation.
   * @param usersService Service pour la gestion des utilisateurs.
   */
  constructor(public authService : AuthService, private router : Router, private usersService: UsersService){}
  ngOnInit() {
    // this.authService.isLogging = true;
  }

  /**
   * Méthode appelée lors de la soumission du formulaire de connexion.
   * Tente de connecter l'utilisateur avec les identifiants fournis.
   */
  onSubmit() {
    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        console.log('User logged in:', response); // Log pour afficher la réponse de connexion réussie.
        this.successMessage='Successfully logged in as \''+ this.username+"\'"  // Message de succès.
        this.router.navigateByUrl("home");  // Redirection vers la page d'accueil après connexion réussie.
      },
      error: (error) => {
        console.error('Error logging in:', error); // Log de l'erreur lors de la connexion.
        this.errorMessage = 'Invalid credentials'; // Message d'erreur pour l'utilisateur.
      }
    });
  }


  /**
  * Méthode pour ajouter un nouvel utilisateur.
  * Cela pourrait être utilisé pour une fonctionnalité d'inscription.
  * @param username Nom d'utilisateur du nouvel utilisateur.
  * @param password Mot de passe du nouvel utilisateur.
  */
  addUser( username : string , password:string) {
    const newUser = { username: username, password: password, role: 'scientifique' }; // Création de l'objet utilisateur.
    console.log("adding user :", newUser) // Log pour vérifier les données de l'utilisateur.
    this.usersService.createUser(newUser).subscribe({
      next: (response) => console.log(response), // Log de la réponse en cas de création réussie.
      error: (error) => console.error(error) // Log de l'erreur en cas d'échec de la création.
    });
  }
}
