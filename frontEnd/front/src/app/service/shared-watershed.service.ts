import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedWatershedService {
  list_of_disabled_options: string[] = [
    'J0121510', 'J0323010', 'J1004520', 'J2233010', 'J2233020', 'J2605410', 'J3601810',
    'J3631810', 'J3821810', 'J3821820', 'J4313010', 'J4614010', 'J4623020', 'J4742010', 'J4902010', 'J5224010', 'J5402120',
    'J5412110', 'J7083110', 'J7114010', 'J7824010', 'J7833010', 'J7973010', 'J8202310', 'J8363110', 'J8443010', 'J8502310', 'J8813010'
  ];

  selectedValue: string | null = 'J0014010';
  selectedValueBSS: string | null = 'BSS000TRGE';
  selectedValueName: string | null = 'Nançon';

  constructor() {}

  isWatersheddisabled(index :string| null | undefined): boolean{
    if (index){
      if (this.list_of_disabled_options.includes(index)){
        return true;
      }
      else{
        return false
      }
    }
    return true;
  }

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
