import { Component } from '@angular/core';
import { Options } from '@angular-slider/ngx-slider';
import { HttpClient } from '@angular/common/http';
import * as Papa from 'papaparse';
import { JsonService } from '../service/json.service';
import { lastValueFrom } from 'rxjs';


@Component({
  selector: 'app-simulateur-cydre',
  templateUrl: './simulateur-cydre.component.html',
  styleUrls: ['./simulateur-cydre.component.scss']
})
export class SimulateurCydreComponent {

  constructor(private http: HttpClient, private jsonService: JsonService) { }

  stations: any[] = [];
  selectedStation: string = '';
  sliderValue: number = 60;
  simulationDate: string = new Date().toISOString().split('T')[0];
  isModalOpen: boolean = false;

  sliderOptions: Options = {
    floor: 0,
    ceil: 120,
    step: 20,
    showTicksValues: true,
    showTicks: true,
    translate: (value: number): string => {
      return value.toString();
    }
  }

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

  async runSimulation(): Promise<any> { {
    try {
        const body = { watershed : this.selectedStation, sliderValue : this.sliderValue, simulationDate: this.simulationDate };
        const result = lastValueFrom(this.http.post('http://localhost:5000/api/run_cydre', body));
      }
      catch (error) {
      console.error('Error running simulation:', error);
    }
    }
  }
}
