import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedWatershedService {
  // Liste des options désactivées pour les bassins versants
  list_of_disabled_options: string[] = [
    'J0121510', 'J0621610', 'J2233010', 'J3413030', 'J3514010', 'J3811810', 'J4614010', 'J4902010', 'J5224010',
    'J5412110', 'J5524010', 'J5618320', 'J7355010', 'J7356010', 'J7364210', 'J7373110', 'J8433010', 'J8502310', 
  ];

  selectedValue: string | null = 'J0014010'; // Valeur sélectionnée par défaut pour le bassin versant.
  selectedValueBSS: string | null = 'BSS000TRGE'; // Valeur sélectionnée par défaut pour BSS.
  selectedValueName: string | null = 'Nançon'; // Nom de la station sélectionnée par défaut.

  constructor() {} // Constructeur du service, ici vide car aucune initialisation particulière n'est nécessaire.

  /**
   * Vérifie si une option de bassin versant est désactivée.
   * @param index - L'index de l'option à vérifier.
   * @returns true si l'option est désactivée, false sinon.
   */
  isWatersheddisabled(index: string | null | undefined ): boolean {
    // Vérifie si l'index est dans la liste des désactivés
    if (index){
      return this.list_of_disabled_options.includes(index);
    }
    return false;
  
  }



  /**
   * Récupère la valeur sélectionnée pour le bassin versant.
   * @returns La valeur sélectionnée ou null.
   */
  getSelectedValue(): string | null {
    return this.selectedValue; // Renvoie la valeur actuellement sélectionnée.
  }

  /**
   * Récupère le nom de la station sélectionnée.
   * @returns Le nom de la station sélectionnée ou null.
   */
  getSelectedStationName(): string | null {
    // À changer par la logique de récupération du nom de la station
    return this.selectedValueName; // Renvoie le nom de la station sélectionnée.
  }

  /**
   * Définit le nom de la station sélectionnée.
   * @param value - Le nom de la station à définir.
   */
  setSelectedStationName(value: string | null): void {
    this.selectedValueName = value; // Définit le nom de la station.
  }

  /**
   * Définit la valeur sélectionnée pour le bassin versant.
   * @param value - La nouvelle valeur à définir.
   */
  setSelectedValue(value: string | null): void {
    this.selectedValue = value; // Définit la valeur sélectionnée pour le bassin versant.
  }
  
  /**
   * Récupère la valeur sélectionnée pour BSS.
   * @returns La valeur sélectionnée pour BSS ou null.
   */
  getSelectedValueBSS(): string | null {
    return this.selectedValueBSS; // Renvoie la valeur actuellement sélectionnée pour BSS.
  }

  /**
   * Définit la valeur sélectionnée pour BSS.
   * @param value - La nouvelle valeur à définir pour BSS.
   */
  setSelectedValueBSS(value: string | null): void {
    this.selectedValueBSS = value; // Définit la valeur sélectionnée pour BSS.
  }
}