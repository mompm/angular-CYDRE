import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class XmlService { // Service utilisé pour effectuer des requêtes HTTP liées aux fichiers XML.

	constructor(private http: HttpClient) {} // Constructeur du service, initialisant l'instance de HttpClient.
  
	/**
	 * Méthode pour récupérer la liste des noms de fichiers XML disponibles.
	 * @returns Une promesse contenant un tableau de chaînes de caractères représentant les noms des fichiers XML.
	 */
	getXmlNames(): Promise<Array<string>> { // Demande la liste des XML disponibles.
	  return lastValueFrom(this.http.get<Array<string>>("osur/getxmlnames")); // Convertit l'Observable en promesse et récupère les noms.
	}
  
	/**
	 * Méthode pour récupérer le contenu d'un fichier XML spécifique.
	 * @param xmlName - Le nom du fichier XML à récupérer.
	 * @returns Une promesse contenant le contenu du fichier XML sous forme de chaîne de caractères.
	 */
	getXml(xmlName: string): Promise<string> { // Demande le XML avec xmlName.
	  return lastValueFrom(this.http.get(`osur/getxml/${xmlName}`, { responseType: 'text' })); // Récupère le XML en tant que texte.
	}
  
	/**
	 * Méthode pour envoyer le contenu d'un fichier XML à l'API en backend.
	 * @param xml - Le contenu du fichier XML à envoyer.
	 * @returns Une promesse avec la réponse de l'API après l'envoi.
	 */
	runCydre(xml: string): Promise<any> { // Envoie le XML à l'API.
	  return lastValueFrom(this.http.post("osur/run_cydre", xml, { responseType: 'text' })); // Envoie une requête POST avec le XML.
	}
  
	/**
	 * Méthode pour exécuter l'application Cydre avec le projet local.
	 * @returns Un Observable contenant la réponse de l'API.
	 */
	runCydre2(): Observable<any> { // Exécute l'application Cydre.
	  return this.http.get("osur/run_cydre"); // Envoie une requête GET à l'API pour exécuter Cydre.
	}
  }