import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ColorService {
  private colorMap: { [year: number]: string } = {};
  private numColorsGenerated = 0;

  constructor() {
    this.loadColorsFromSessionStorage();
  }

   /**
   * Génère une nouvelle couleur HSL en utilisant le nombre total de couleurs déjà générées
   * pour déterminer la teinte. Incrémente le compteur après la génération.
   * @returns Une chaîne de caractères représentant la couleur en format HSL.
   */
  private generateNewColor(): string {
    const hue = this.numColorsGenerated * (360 / (this.numColorsGenerated + 1));
    this.numColorsGenerated++;
    return `hsl(${hue}, 100%, 50%)`;
  }

  /**
   * Obtient ou génère une couleur pour une année spécifique.
   * Si aucune couleur n'est associée à cette année, une nouvelle est générée.
   * @param year L'année pour laquelle obtenir ou générer une couleur.
   * @returns Une chaîne représentant la couleur en format HSL.
   */
  public getColorForYear(year: number): string {
    if (!this.colorMap[year]) {
      this.colorMap[year] = this.generateNewColor();
    }
    return this.colorMap[year];
  }

  /**
     * Met à jour la table de couleurs avec un nouvel ensemble de couleurs et ajuste le compteur de couleurs générées.
     * @param colorTab Un objet où les clés sont des années et les valeurs sont des chaînes de couleurs HSL.
     */
  public setColors(colorTab: { [year: number]: string }): void {
    this.colorMap = colorTab;
    this.numColorsGenerated = Object.keys(colorTab).length;
  }

  /**
   * Sauvegarde l'objet colorMap actuel dans le sessionStorage sous forme de chaîne JSON.
   */
  public saveSessionColors(){
    sessionStorage.removeItem('graphColors')
    sessionStorage.setItem('graphColors', JSON.stringify(this.colorMap));
  }

   /**
   * Charge l'objet colorMap du sessionStorage, s'il existe.
   * Rétablit également le compteur de couleurs en fonction des données chargées.
   */
  public loadColorsFromSessionStorage(): boolean {
    const storedColors = sessionStorage.getItem('graphColors');
    if (storedColors) {
      this.colorMap = JSON.parse(storedColors);
      this.numColorsGenerated = Object.keys(this.colorMap).length;
      return true;
    }
    return false;
  }

    /**
   * Renvoie un tableau contenant toutes les années pour lesquelles des couleurs ont été générées.
   * @returns Un tableau de nombres représentant les années.
   */
  getKeys(): number[] {
    return Object.keys(this.colorMap).map(key => parseInt(key));
  }

  /**
 * Met à jour le colorMap en supprimant les couleurs associées aux années qui ne sont pas incluses
 * dans le tableau d'années fourni. Cela permet de conserver uniquement les couleurs pour les années pertinentes.
 * @param years Un tableau de nombres représentant les années à conserver dans le colorMap.
 */
  updateColors(years: number[]): void {
    // Obtenir les clés de colorMap sous forme de tableau de nombres.
    const existingYears = Object.keys(this.colorMap).map(key => parseInt(key));
    
    // Parcourir chaque année existante et la supprimer si elle n'est pas incluse dans le tableau years.
    existingYears.forEach(year => {
      if (!years.includes(year)) { // Vérifie si l'année n'est pas incluse dans les années fournies.
        delete this.colorMap[year]; // Utilise l'opérateur delete pour supprimer la propriété de l'objet.
      }
    });
    this.numColorsGenerated = Object.keys(this.colorMap).length;

    this.saveSessionColors();
  }
}
