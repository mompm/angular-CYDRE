import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {Observable, Subject, catchError, forkJoin, lastValueFrom, map, of, switchMap, takeWhile, tap, timer } from 'rxjs';
import dataGDFWatersheds from '../model/dataGDFWatersheds';
import dataGDFPiezometry from '../model/dataGDFPiezometry';
import dataDischarge from '../model/dataDischarge';
import dataGDFStation from '../model/dataGDFStation';
import dataTemperature from '../model/dataTemperature';
import dataDepth from '../model/dataDepth';
import dataPrecipitation from '../model/dataPrecipitation';
import { forEach } from 'mathjs';



@Injectable({
  providedIn: 'root'
})
export class JsonService {
private baseUrl = 'http://localhost:5000';


  constructor(private http: HttpClient){}

	getGDFWatersheds(): Promise<Array<dataGDFWatersheds>> {
		return lastValueFrom(this.http.get<Array<dataGDFWatersheds>>("osur/GetGDFWatersheds"));
	  }
	

	getGDFStations(): Promise<Array<dataGDFStation>>{
		return lastValueFrom(this.http.get<Array<dataGDFStation>>("osur/GetGDFStations"));
	}

	getGDFPiezometry() : Promise<Array<dataGDFPiezometry>>{
		return lastValueFrom(this.http.get<Array<dataGDFPiezometry>>("/osur/getGDFPiezometry"));
	}

	getDischarge(id: string): Promise<Array<dataDischarge>> {
		const url = `/osur/stationDischarge/${id}`;
		return lastValueFrom(this.http.get<Array<dataDischarge>>(url));
	}

	getRunCydre(params :any ): Observable<any> {
		return this.http.post(`${this.baseUrl}/api/run_cydre`, params).pipe(
		  tap(() => console.log('Running Cydre app...'))
		);
	  }
	  getGraph(taskId:string ): Observable<any> {
		return this.http.get(`${this.baseUrl}/api/simulateur/getGraph/`+taskId).pipe(
		  tap(() => console.log('Generating graph...'))
		);
	  }
	
	  get_indicators_value(simulation_id: string): Observable<any> {
		return this.http.get(`${this.baseUrl}/api/simulateur/get_indicators_value/`+simulation_id).pipe(
		  tap(() => console.log('Fetching M10 values...'))
		);
	  }	
	  updateIndicatorsValue(simulation_id: string, indicators: any[]): Observable<any> {
        // Création d'un tableau temporaire pour ne pas modifier le tableau original
        const tempIndicators = indicators.map(indicator => ({
            ...indicator,
            type: indicator.type === "1/10 du module" ? "mod10" : indicator.type
        }));

        // Création des requêtes HTTP à partir du tableau temporaire
        const updateRequests = tempIndicators.map(indicator => {
            console.log("Updating indicator:", indicator.type);
            return this.http.post(`${this.baseUrl}/api/simulateur/update_indicator/${simulation_id}`, indicator);
        });

        // Utilisation de forkJoin pour attendre la complétion de toutes les requêtes
	
		// Utiliser forkJoin pour exécuter toutes les requêtes POST en parallèle et attendre que toutes soient terminées
		return forkJoin(updateRequests).pipe(
			tap(() => console.log('All indicators updated')),
			// Une fois toutes les requêtes terminées, obtenir les valeurs des indicateurs
			switchMap(() => this.get_indicators_value(simulation_id))
		);
	}

	  updateM10Value(params: any): Observable<any> {
		return this.http.post(`${this.baseUrl}/api/update_indicator`, params).pipe(
		  tap(() => console.log('Fetching M10 values...'))
		);
	  }
	
	  getCorrMatrix(taskId: string): Observable<any> {
		return this.http.get(`${this.baseUrl}/api/simulateur/getCorrMatrix/`+taskId).pipe(
		  tap(() => console.log('Fetching correlation matrix...'))
		);
	  }
	
	  getResults(taskId: string): Observable<any> {
		return this.http.get(`${this.baseUrl}/api/results/`+taskId).pipe(
		  tap(() => console.log('Fetching results...'))
		);
	  }
	  runSpatialSimilarity(simulation_id:string): Observable<any> {
		return this.http.post(`${this.baseUrl}/api/run_spatial_similarity/${simulation_id}`,{simulation_id:simulation_id}).pipe(
		  tap(() => console.log('Running spatial similaritiy'))
		);
	  }
	  runTimeseriesSimilarity(simulation_id:string): Observable<any> {
		return this.http.post(`${this.baseUrl}/api/run_timeseries_similarity/${simulation_id}`,{simulation_id:simulation_id}).pipe(
		  tap(() => console.log('Running timeseries similaritiy'))
		);
	  }
	  runScenarios(simulation_id:string): Observable<any> {
		return this.http.post(`${this.baseUrl}/api/select_scenarios/${simulation_id}`,{simulation_id:simulation_id}).pipe(
		  tap(() => console.log('Running scenarios'))
		);
	  }
	  
	
	  runSimulation(params : any ,progressCallback: (message: string, progress: number) => void): Observable<any> {
		// let taskId: string;
		let simulation_id :string;
	
		progressCallback('Initialisation de la simulation...', 0);
		return this.getRunCydre(params).pipe(
		  tap(response => {
			simulation_id = response.SimulationID;
			progressCallback('Cydre app lancée.',10);
		  }),
		  switchMap(() => this.runSpatialSimilarity(simulation_id).pipe(
			tap(() => progressCallback('Similarités spatiales exécutées.',20))
		  )),
		  switchMap(() => this.runTimeseriesSimilarity(simulation_id).pipe(
			tap(() => progressCallback('Similarités temporelles exécutées',50))
		  )),
		  switchMap(() => this.runScenarios(simulation_id).pipe(
			tap(() => progressCallback('Scenarios exécutés.',60))
		  )),
		  switchMap(() => this.getGraph(simulation_id).pipe(
			tap(() => progressCallback('Graphe généré.',75))
		  )),
		  switchMap(() => this.getCorrMatrix(simulation_id).pipe(
			tap(() => progressCallback('Matrice de corrélation récupérée.',85))
		  )),
		  switchMap(() => this.getResults(simulation_id).pipe(
			tap(() => progressCallback('Résultats récupérés.',100)),
			map(results => ({ simulation_id, results }))
		  )),
		  catchError(error => {
			progressCallback('Erreur lors de la simulation :'+ error,0);
			return of(null);
		  })
		);
	  }
	getTemperature(id: string): Promise<Array<dataTemperature>> {
		const url = `/osur/stationTemperature/${id}`;
		return lastValueFrom(this.http.get<Array<dataTemperature>>(url));
	}

	getDepth(id: string): Promise<Array<dataDepth>> {
		const url = `/osur/stationWaterTableDepth/${id}`;
		return lastValueFrom(this.http.get<Array<dataDepth>>(url));
	}

	getPrecipitation(id: string): Promise<Array<dataPrecipitation>> {
		const url = `/osur/stationPrecipitation/${id}`;
		return lastValueFrom(this.http.get<Array<dataPrecipitation>>(url));
	}

}
