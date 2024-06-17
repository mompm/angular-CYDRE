import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedWatershedService {
  list_of_disabled_options: string[] = [
    'J0121510', 'J0621610', 'J2233010', 'J3413030', 'J3514010', 'J3811810', 'J4614010', 'J4902010', 'J5224010',
    'J5412110', 'J5524010', 'J5618320', 'J7355010', 'J7356010', 'J7364210','J7373110', 'J8433010', 'J8502310', 
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
