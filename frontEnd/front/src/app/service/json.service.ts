import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {Observable, Subject, catchError, concatMap, finalize, forkJoin, from, lastValueFrom, map, of, switchMap, takeWhile, tap, timer, toArray } from 'rxjs';
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

	  removeIndicator(simulationId: string, indicatorType: string): Observable<any> {
		const url = `${this.baseUrl}/api/simulateur/remove_indicator/${simulationId}`;
		return this.http.post(url, { type: indicatorType });
	  }  
	  
	  updateIndicatorsValue(simulation_id: string, indicators: any[]): Observable<any> {
		const updateRequests = from(indicators).pipe(
			concatMap(indicator => {
				console.log("Updating indicator:", indicator.type);
				return this.http.post(`${this.baseUrl}/api/simulateur/update_indicator/${simulation_id}`, indicator);
			}),
			toArray()  // Regroupe toutes les réponses en un seul tableau
		);
	
		return updateRequests.pipe(
			tap(() => console.log('All indicators updated')),
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
	  
	
	  runSimulation(params: any, progressCallback: (message: string, progress: number) => void): Observable<any> {
		let simulation_id: string;
	  
		progressCallback('Initialisation de la simulation...', 0);
		return this.getRunCydre(params).pipe(
		  tap(response => {
			simulation_id = response.SimulationID;
			progressCallback('Cydre app lancée.', 10);
			console.log('Simulation ID:', simulation_id);
		  }),
		  switchMap(() => this.runSpatialSimilarity(simulation_id).pipe(
			tap(() => {
			  progressCallback('Similarités spatiales exécutées.', 20);
			  console.log('Similarités spatiales exécutées');
			})
		  )),
		  switchMap(() => this.runTimeseriesSimilarity(simulation_id).pipe(
			tap(() => {
			  progressCallback('Similarités temporelles exécutées', 50);
			  console.log('Similarités temporelles exécutées');
			})
		  )),
		  switchMap(() => this.runScenarios(simulation_id).pipe(
			tap(() => {
			  progressCallback('Scenarios exécutés.', 60);
			  console.log('Scenarios exécutés');
			})
		  )),
		  switchMap(() => this.getGraph(simulation_id).pipe(
			tap(() => {
			  progressCallback('Graphe généré.', 75);
			  console.log('Graphe généré');
			})
		  )),
		  switchMap(() => this.getCorrMatrix(simulation_id).pipe(
			tap(() => {
			  progressCallback('Matrice de corrélation récupérée.', 85);
			  console.log('Matrice de corrélation récupérée');
			})
		  )),
		  switchMap(() => this.getResults(simulation_id).pipe(
			tap(() => {
			  progressCallback('Résultats récupérés.', 100);
			  console.log('Résultats récupérés');
			}),
			map(results => ({ simulation_id, results }))
		  )),
		  finalize(() => {
			console.log('Chaîne d\'observables terminée');
		  }),
		  catchError(error => {
			progressCallback('Erreur lors de la simulation :' + error, 0);
			console.error('Erreur lors de la simulation:', error);
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

	getUserSimulations(): Observable<any[]> {
		return this.http.get<any[]>(`${this.baseUrl}/api/simulations`,{ withCredentials: true });
	  }

}
