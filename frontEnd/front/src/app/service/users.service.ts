import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  private apiURL = 'http://localhost:5000/api/users'; // URL de l'API pour accéder aux utilisateurs.

  /**
   * Constructeur de UsersService.
   * @param http - Instance de HttpClient pour effectuer des requêtes HTTP.
   */
  constructor(private http: HttpClient) { }

  /**
   * Méthode pour récupérer la liste des utilisateurs.
   * @returns Un Observable contenant la liste des utilisateurs.
   */
  getUsers(): Observable<any> {
    return this.http.get(this.apiURL); // Envoie une requête GET à l'API pour récupérer les utilisateurs.
  }

  /**
   * Méthode pour créer un nouvel utilisateur.
   * @param userData - Objet contenant les données de l'utilisateur à créer (username, password, role).
   * @returns Un Observable avec la réponse du serveur après la création de l'utilisateur.
   */
  createUser(userData: { username: string; password: string; role: string }): Observable<any> {
    return this.http.post(this.apiURL, userData); // Envoie une requête POST à l'API avec les données de l'utilisateur.
  }
}