import { Injectable } from '@angular/core';
import { Parameter, ParametersGroup } from '../model/parameters-group';
import { Parser,Builder} from 'xml2js';
import { XmlService } from './xml.service';
import { JsonService } from './json.service';



@Injectable({
  providedIn: 'root'
})
export class DataService { 
  // Service utilisé pour charger l'XML reçu et le convertir en JSON et vice versa.

  private xmlData: string = ""; // Variable pour stocker les données XML chargées.

  public xmlPath: string = ""; // Chemin pour la requête d'un fichier XML.

  /**
   * Constructeur de DataService.
   * @param requestService - Instance de XmlService pour récupérer les données XML.
   * @param jsonService - Instance de JsonService (potentiellement pour des conversions JSON).
   */
  constructor(private requestService: XmlService, private jsonService: JsonService) {}

  /**
   * Méthode pour faire une requête pour obtenir des données XML.
   * Charge les données XML dans xmlData et les affiche dans la console.
   */
  requestXml() {
    this.requestService.getXml(this.xmlPath) // Appelle la méthode getXml du service XmlService.
      .then(xml => {
        this.xmlData = xml; // Stocke les données XML dans xmlData.
        console.log(this.xmlData); // Affiche les données XML dans la console.
      })
      .catch(err => {
        console.log(err); // Affiche une erreur si la requête échoue.
      });
  }

  /**
   * Méthode asynchrone pour parser une chaîne XML en objet JSON.
   * @param xmlString - La chaîne XML à parser.
   * @returns Un objet JSON résultant du parsing.
   */
  async parseXml(xmlString: string) {
    const parser = new Parser({
      "mergeAttrs": true, // Fusionne les attributs dans les objets JSON résultants.
    });
    return await new Promise((resolve, reject) => 
      parser.parseString(xmlString, (err: any, jsonData: any) => {
        if (err) {
          reject(err); // Rejette la promesse en cas d'erreur de parsing.
        }
        resolve(jsonData); // Résout la promesse avec les données JSON.
      })
    );
  }

  /**
   * Méthode publique pour obtenir les données JSON à partir des données XML chargées.
   * @returns Un objet de type ParametersGroup.
   */
  public async getJSONData(): Promise<ParametersGroup> {
    return this.parseXml(this.xmlData) // Appelle la méthode parseXml pour convertir XML en JSON.
      .then((res: any) => {
        return res.ParametersGroup as ParametersGroup; // Renvoie l'objet ParametersGroup extrait des données JSON.
      });
  }

  /**
   * Méthode pour convertir un objet JSON en chaîne XML.
   * @param json - L'objet JSON à convertir.
   * @returns La chaîne XML résultante.
   */
  jsonToXml(json: any): string {
    const options = {
      attrkey: "$", // Définit la clé pour les attributs dans l'objet XML.
      rootName: "ParametersGroup", // Définit le nom de la racine pour le XML.
      headless: true, // Indique que la racine ne doit pas être incluse dans le XML.
    };
    const builder = new Builder(options); // Crée une instance du builder avec les options spécifiées.
    const xmlData = builder.buildObject(json); // Convertit l'objet JSON en XML.
    console.log(xmlData); // Affiche les données XML résultantes dans la console.
    return xmlData; // Renvoie les données XML.
  }
}