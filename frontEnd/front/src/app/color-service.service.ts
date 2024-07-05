import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ColorService {
  private colorMap: { [year: number]: string } = {};
  private numColorsGenerated = 0;

  constructor() {}

  private generateNewColor(): string {
    const hue = this.numColorsGenerated * (360 / (this.numColorsGenerated + 1));
    this.numColorsGenerated++;
    return `hsl(${hue}, 100%, 50%)`;
  }

  public getColorForYear(year: number): string {
    if (!this.colorMap[year]) {
      this.colorMap[year] = this.generateNewColor();
    }
    return this.colorMap[year];
  }
}
