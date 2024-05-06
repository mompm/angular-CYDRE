import { Component } from '@angular/core';

export interface PeriodicElement {
  Index: number;
  J0014010: number;
  J0121510: number;
  J0144010: number;
  J0323010: number;
  J0611610: number;
}

const ELEMENT_DATA: PeriodicElement[] = [
  {Index: 1, J0014010: 1.0079, J0121510: 1.0079, J0144010: 1.0079, J0323010: 1.0079, J0611610: 1.0079},
  {Index: 2, J0014010: 1.0079, J0121510: 4.0026, J0144010: 1.0079, J0323010: 1.0079, J0611610: 1.0079},
  {Index: 3, J0014010: 1.0079, J0121510: 6.941, J0144010: 1.0079, J0323010: 1.0079, J0611610: 1.0079},
  {Index: 4, J0014010: 1.0079, J0121510: 9.0122, J0144010: 1.0079, J0323010: 1.0079, J0611610: 1.0079},
  {Index: 5, J0014010: 1.0079, J0121510: 10.811, J0144010: 1.0079, J0323010: 1.0079, J0611610: 1.0079},
  {Index: 6, J0014010: 1.0079, J0121510: 12.0107, J0144010: 1.0079, J0323010: 1.0079, J0611610: 1.0079},
  {Index: 7, J0014010: 1.0079, J0121510: 14.0067, J0144010: 1.0079, J0323010: 1.0079, J0611610: 1.0079},
  {Index: 8, J0014010: 1.0079, J0121510: 15.9994, J0144010: 1.0079, J0323010: 1.0079, J0611610: 1.0079},
  {Index: 9, J0014010: 1.0079, J0121510: 18.9984, J0144010: 1.0079, J0323010: 1.0079, J0611610: 1.0079},
  {Index: 10, J0014010: 1.0079, J0121510: 20.1797, J0144010: 1.0079, J0323010: 1.0079, J0611610: 1.0079},
];
@Component({
  selector: 'app-historique',
  templateUrl: './historique.component.html',
  styleUrls: ['./historique.component.scss']
})
export class HistoriqueComponent {
  displayedColumns: string[] = ['Index','J0014010','J0121510','J0144010','J0323010','J0611610'];
  dataSource = ELEMENT_DATA;

}
