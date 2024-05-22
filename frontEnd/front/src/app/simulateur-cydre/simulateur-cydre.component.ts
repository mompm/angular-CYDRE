import { Component, OnInit } from '@angular/core';
import { Options } from '@angular-slider/ngx-slider';
import { JsonService } from '../service/json.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-simulateur-cydre',
  templateUrl: './simulateur-cydre.component.html',
  styleUrls: ['./simulateur-cydre.component.scss']
})
export class SimulateurCydreComponent implements OnInit {

  constructor(private jsonService: JsonService, private http: HttpClient) { }

  stations: any[] = [];
  selectedStation: string = '';
  selectedStationName: string = '';
  sliderValue: number = 60;
  simulationDate: string = new Date().toISOString().split('T')[0];
  isModalOpen: boolean = false;
  list_of_disabled_options: string[] = [
    'J0121510', 'J0323010', 'J1004520', 'J2233010', 'J2233020', 'J2605410', 'J3601810',
    'J3631810', 'J3821810', 'J3821820', 'J4313010', 'J4614010', 'J4623020', 'J4742010', 'J4902010', 'J5224010', 'J5402120',
    'J5412110', 'J7083110', 'J7114010', 'J7824010', 'J7833010', 'J7973010', 'J8202310', 'J8363110', 'J8443010', 'J8502310', 'J8813010'
  ];

  simulationResults: any = null;
  results: any = {};
  progress: string[] = [];
  taskId: string | undefined;
  showResults :boolean = false;

  sliderOptions: Options = {
    floor: 0,
    ceil: 120,
    step: 20,
    showTicksValues: true,
    showTicks: true,
    translate: (value: number): string => {
      return value.toString();
    }
  };

  ngOnInit(): void {
    this.loadStations();
  }

  async loadStations() {
    try {
      this.stations = await this.jsonService.gedataGDFStations();
      console.log(this.stations);
    } catch (error) {
      console.error('Error loading stations:', error);
    }
  }

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }
  
  onStartSimulation() {
    const params = {
      watershed: this.selectedStation,
      slider: this.sliderValue,
      date: this.simulationDate
    };

    this.jsonService.runSimulation(params).subscribe({
      next: (response) => {
        this.taskId = response.task_id;
        this.checkResults();
      },
      error: (error) => {
        console.error('Error occurred:', error);
      }
    });
  }
  checkResults() {
    if (this.taskId) {
      this.jsonService.getResults(this.taskId).subscribe({
        next: (data) => {
          if (data.status !== 'processing') {
            this.results = data;
            this.progress.push('Simulation completed');
            this.showResults = true;
          } else {
            this.progress.push('Still processing...');
          }
        },
        error: (error) => {
          console.error('Error occurred:', error);
        }
      });
    }
  }
  onStationSelected(stationIndex: number) {
    this.selectedStation = stationIndex.toString();
    const selectedStation = this.stations.find(station => station.index === stationIndex);
    if (selectedStation) {
      this.selectedStationName = selectedStation.station_name;
    }
  }

//   async runSimulation(): Promise<any> {
    
//     try {
//       const body = { watershed : this.selectedStation, sliderValue : this.sliderValue, simulationDate: this.simulationDate };
//       // this.http.post('/api/run_cydre', body).subscribe(response=> this.simulationResults = response);
//       this.jsonService.getPrevisionGraphData(this.selectedStation, this.sliderValue, this.simulationDate).subscribe((results: any) => {
//         this.graphResults = JSON.parse(results);

//         // Convertir les dates et les débits en format correct
//         const dates = this.graphResults.map((result: any) => {
//           // Assurez-vous que la date est correctement formatée
//           return new Date(result.daily).toISOString().split('T')[0];
//         });
//         const discharge = this.graphResults.map((result: any) => {
//           return result.Q !== null ? result.Q : 0; // Remplacez les valeurs nulles par 0
//         });

//         this.simulationResults['graph'] = {
//             data: [
//               {
//                 x: dates,
//                 y: discharge,
//                 type: 'scatter',
//                 mode: 'lines+points',
//                 marker: { color: 'red' },
//                 name: 'Débit (Q)'
//               }
//             ],
//             layout: {
//               title: 'Débit selon la date',
//               xaxis: { title: 'Date' },
//               yaxis: { title: 'Débit (Q)' }
//             }
//         };
//       });
//     } catch (error) {
//       console.error('Error running simulation:', error);
//     }
//   }
}
