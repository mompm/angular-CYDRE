import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ColorService {
  private colorMap: { [year: number]: string } = {};
  private numColorsGenerated = 12; // nombre des couleurs generer random
  private readonly goldenRatioConjugate = 0.61803398875;  // Facteur d'or
  private readonly predefinedColors: string[] = [
    "hsl(0, 100%, 50%)",     // Rouge
    "hsl(210, 100%, 50%)",   // Bleu clair
    "hsl(150, 100%, 50%)",   // Vert foncé
    "hsl(30, 100%, 50%)",    // Orange
    "hsl(60, 100%, 50%)",    // Jaune
    "hsl(0, 0%, 0%)",        // Noir
    "hsl(270, 100%, 75%)",   // Violet clair
    "hsl(0, 0%, 50%)",       // Gris
    "hsl(90, 100%, 50%)",    // Vert clair
    "hsl(120, 100%, 50%)",   // Vert
    "hsl(300, 100%, 50%)",   // Magenta
    "hsl(240, 100%, 50%)",   // Bleu
    "hsl(180, 100%, 50%)",   // Cyan
    "hsl(270, 100%, 50%)",   // Violet
    "hsl(0, 100%, 75%)",     // Rouge clair
    "hsl(120, 100%, 75%)",   // Vert clair
    "hsl(30, 100%, 75%)",    // Orange clair
    "hsl(240, 100%, 75%)",   // Bleu clair
    "hsl(60, 100%, 75%)"     // Jaune clair
  ];

  constructor() {
    this.loadColorsFromSessionStorage();
  }

  /**
  * si on est dans les 11 premières couleurs, utilise la liste des couleurs prédefines 
  * sinon on genere des couleurs aleatoire
  */
  private generateNewColor(): string {
    // Si nous avons épuisé les couleurs prédéfinies, générons une couleur aléatoire
    if (this.numColorsGenerated < this.predefinedColors.length) {
      return this.predefinedColors[this.numColorsGenerated++];
    } else {
      // Générer une couleur aléatoire
      return this.generateRandomColor();
    }
  }

  /**
   * Génère une nouvelle couleur HSL en utilisant le nombre total de couleurs déjà générées
   * pour déterminer la teinte. Incrémente le compteur après la génération.
   * Si toutes les couleurs prédéfinies ont été générées, génère une couleur aléatoire.
   * @returns Une chaîne de caractères représentant la couleur en format HSL.
   */
  private generateRandomColor(): string {
    const hue = (this.numColorsGenerated * this.goldenRatioConjugate * 360) % 360;
    this.numColorsGenerated++;
    const saturation = Math.floor(Math.random() * 101); // Saturation aléatoire entre 0 et 100%
    const lightness = Math.floor(Math.random() * 101); // Luminosité aléatoire entre 0 et 100%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
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
    sessionStorage.removeItem('graphColors');
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
