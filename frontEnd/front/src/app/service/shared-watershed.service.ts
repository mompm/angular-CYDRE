import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedWatershedService {
  selectedValue: string | null = 'J0014010';
  selectedValueBSS: string | null = 'BSS000TRGE';

  constructor() { }

  getSelectedValue(): string | null {
    return this.selectedValue;
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
