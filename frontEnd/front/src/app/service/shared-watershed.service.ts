import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedWatershedService {
  selectedValue: string | null = 'J0014010';
  selectedValueBSS: string | null = 'BSS000TRGE';
  selectedValueName: string | null = 'Nançon';

  constructor() { }

  getSelectedValue(): string | null {
    return this.selectedValue;
  }

  getSelectedStationName(): string | null{
    //return "Nançon" // à changer par la logique de récupération du nom de la station
    return this.selectedValueName;
  }

  setSelectedStationName(value: string | null): void {
    this.selectedValueName = value;
  }

  setSelectedValue(value: string | null): void {
    this.selectedValue = value;
  }
  
  getSelectedValueBSS(): string | null {
    return this.selectedValueBSS;
  }

  setSelectedValueBSS(value: string | null): void {
    this.selectedValueBSS = value;
  }
}
