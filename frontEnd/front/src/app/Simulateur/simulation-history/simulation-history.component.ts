import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { JsonService } from 'src/app/service/json.service';
import { HttpClient } from '@angular/common/http';
import { forEach } from 'mathjs';

@Component({
  selector: 'app-simulation-history',
  templateUrl: './simulation-history.component.html',
  styleUrls: ['./simulation-history.component.scss']
})
export class SimulationHistoryComponent implements OnInit {
  simulations: any[] = [];
  user_horizon : number =0;
  constructor(private jsonService: JsonService, private router: Router,private http: HttpClient,) {}

  ngOnInit() {
    this.jsonService.getUserSimulations().subscribe({
      next: (data) => {
        this.simulations = data;
        data.forEach((simulation)=>{
          if(!simulation.parameters.user_horizon){
            simulation.parameters['user_horizon']=simulation.parameters.UserConfig['user_horizon']
            console.log("user_horizon added:"+simulation.parameters['user_horizon']);
          }
          if(!simulation.parameters.date){
            simulation.parameters['date']=simulation.parameters.General['date']
            console.log("date added:"+simulation.parameters['date']);
          }
        })
        console.log(this.simulations)},
      error: (err) => console.error('Failed to load simulations', err)
    });
  }

  goToSimulation(simulationId: string) {
    sessionStorage.setItem('lastSimulationId', simulationId)
    sessionStorage.setItem('showLastSimul', "true")

    this.router.navigate(['/simulator']);

  }

  deleteSimulation(simulationId: string) {
    // Votre logique pour supprimer une simulation
    // Par exemple, appel à un service qui envoie une requête DELETE au serveur
    this.http.post(`http://localhost:5000/api/delete_simulation/${simulationId}`, {}).subscribe({
      next: (response: any) => console.log('Simulation deleted successfully'),
      error: (error : any) => console.error('Failed to delete simulation', error)
    });
    if(sessionStorage.getItem('lastSimulationId')==simulationId){
      sessionStorage.removeItem('lastSimulationId');
    }
    // Retirer la simulation du tableau après la suppression réussie
    this.simulations = this.simulations.filter(simulation => simulation.SimulationID !== simulationId);
    }
}
