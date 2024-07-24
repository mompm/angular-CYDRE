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
  
private baseUrl = '';


  constructor(private http: HttpClient){}

	async updateSimualtionsBetaDatabase(station : string):Promise<any>{
		return lastValueFrom(this.http.post("api/updateSimulationsBeta", {station : station}))
	}

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

	async runSimulation(params: any, progressCallback: (message: string, progress: number) => void): Promise<any> {
		let simulation_id: string;
		try {
		  progressCallback('Préparation de la simulation...', 0);
		  
		  const CreateSimulationResponse = await this.CreateSimulation(params);
		  simulation_id = CreateSimulationResponse.SimulationID;
		  progressCallback('Récupération des conditions de la prévision', 10);
		  console.log('Simulation ID:', simulation_id);
	
		  await this.runSpatialSimilarity(simulation_id);
		  progressCallback('Typologie de bassins versants : OK', 20);
		  console.log('Similarités spatiales exécutées');
	
		  await this.runTimeseriesSimilarity(simulation_id);
		  progressCallback('Identification des années similaires : OK', 50);
		  console.log('Similarités temporelles exécutées');
	
		  await this.runScenarios(simulation_id);
		  progressCallback('Sélection des événements similaires : OK', 60);
		  console.log('Scenarios exécutés');
	
		  await this.getForecastResults(simulation_id);
		  progressCallback('Préparation des résultats', 75);
		  console.log('Graphe généré');
	
		//   await this.getCorrMatrix(simulation_id);
		//   // progressCallback('Matrice de corrélation récupérée.', 85);
		//   console.log('Matrice de corrélation récupérée');
	
		  const results = await this.getResults(simulation_id);
		  progressCallback('Fin de la prévision !', 100);
		  console.log('Résultats récupérés');
	
		  return { simulation_id, results };
		} catch (error) {
		  progressCallback('Erreur lors de la simulation :' + error, 0);
		  console.error('Erreur lors de la simulation:', error);
		  return null;
		} finally {
		  console.log('Chaîne d\'opérations terminée');
		}
	  }

	CreateSimulation(params: any): Promise<any> {
		return this.http.post(`${this.baseUrl}/api/create_simulation`, params).toPromise()
		  .then(response => {
			console.log('Create simulation in the database...');
			return response;
		  });
	  }
	
	runSpatialSimilarity(simulation_id: string): Promise<any> {
	return this.http.post(`${this.baseUrl}/api/run_spatial_similarity/${simulation_id}`, { simulation_id }).toPromise()
		.then(response => {
		console.log('Running spatial similarity');
		return response;
		});
	}

	runTimeseriesSimilarity(simulation_id: string): Promise<any> {
		return this.http.post(`${this.baseUrl}/api/run_timeseries_similarity/${simulation_id}`, { simulation_id }).toPromise()
		  .then(response => {
			console.log('Running timeseries similarity');
			return response;
		  });
	  }
	
	runScenarios(simulation_id: string): Promise<any> {
	return this.http.post(`${this.baseUrl}/api/select_scenarios/${simulation_id}`, { simulation_id }).toPromise()
		.then(response => {
		console.log('Running scenarios');
		return response;
		});
	}

	getForecastResults(taskId: string): Promise<any> {
	return this.http.get(`${this.baseUrl}/api/simulateur/getForecastResults/` + taskId).toPromise()
		.then(response => {
		console.log('Generating graph...');
		return response;
		});
	}

	get_indicators_value(simulation_id: string): Promise<any> {
	return this.http.get(`${this.baseUrl}/api/simulateur/get_indicators_value/` + simulation_id).toPromise()
		.then(response => {
		console.log('Fetching M10 values...');
		return response;
		});
	}
	
	removeIndicator(simulationId: string, indicatorType: string): Promise<any> {
	const url = `${this.baseUrl}/api/simulateur/remove_indicator/${simulationId}`;
	return this.http.post(url, { type: indicatorType }).toPromise();
	}
	
	updateIndicatorsValue(simulation_id: string, indicators: any[]): Promise<any> {
	const updatePromises = indicators.map(indicator => {
		console.log("Updating indicator:", indicator.type);
		return this.http.post(`${this.baseUrl}/api/simulateur/update_indicator/${simulation_id}`, indicator).toPromise();
	});
	
	return Promise.all(updatePromises)
		.then(() => {
		console.log('All indicators updated');
		return this.get_indicators_value(simulation_id);
		});
	}
	
	updateM10Value(params: any): Promise<any> {
	return this.http.post(`${this.baseUrl}/api/update_indicator`, params).toPromise()
		.then(response => {
		console.log('Fetching M10 values...');
		return response;
		});
	}
	
	getCorrMatrix(taskId: string): Promise<any> {
	return this.http.get(`${this.baseUrl}/api/simulateur/getCorrMatrix/` + taskId).toPromise()
		.then(response => {
		console.log('Fetching correlation matrix...');
		return response;
		});
	}

	getResults(taskId: string): Promise<any> {
	return this.http.get(`${this.baseUrl}/api/results/` + taskId).toPromise()
		.then(response => {
		console.log('Fetching results...');
		return response;
		});
	}
	  
	getUserSimulations(): Observable<any[]> {
		return this.http.get<any[]>(`${this.baseUrl}/api/simulations`,{ withCredentials: true });
	}

	getBetaSimulation(index :string ): Observable<any[]>{
		return this.http.get<any[]>(`${this.baseUrl}/api/getBetaSimulations/`+index);
	}
}
