import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ParametersService {

  private apiUrl = 'api/parameters'; // URL de l'API pour accéder aux paramètres.

  /**
   * Constructeur de ParametersService.
   * @param http - Instance de HttpClient pour effectuer des requêtes HTTP.
   */
  constructor(private http: HttpClient) { }

  /**
   * Méthode pour obtenir les paramètres par défaut.
   * @returns Un Observable contenant les paramètres par défaut.
   */
  getDefaultParameters(): Observable<any> {
    return this.http.get<any>(this.apiUrl + '/true'); // Envoie une requête GET à l'API pour récupérer les paramètres par défaut.
  }

  /**
   * Méthode pour obtenir les paramètres actuels.
   * @returns Un Observable contenant les paramètres actuels.
   */
  getParameters(): Observable<any> {
    return this.http.get<any>(this.apiUrl + '/false'); // Envoie une requête GET à l'API pour récupérer les paramètres actuels.
  }

  /**
   * Méthode pour mettre à jour les paramètres.
   * @param parameters - Les paramètres à mettre à jour, sous forme d'objet.
   * @returns Un Observable avec la réponse du serveur après la mise à jour.
   */
  updateParameters(parameters: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, parameters); // Envoie une requête POST à l'API avec les nouveaux paramètres.
  }
}