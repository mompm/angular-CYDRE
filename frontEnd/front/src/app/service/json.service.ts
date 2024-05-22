import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {Observable, Subject, lastValueFrom, switchMap, takeWhile, timer } from 'rxjs';
import OldBSSData from '../model/OldBSSData';
import CorrespondancesBSSData from '../model/CorrespondanceBSSData';
import GDFWatershedsData from '../model/GDFWatershedsData';
import DFFData from '../model/DFFData';
import GDFPiezometryData  from '../model/GDFPiezometryData ';
import StationDischargedata from '../model/StationDischargedata';
import GDFStationData from '../model/GDFStationData';



@Injectable({
  providedIn: 'root'
})
export class JsonService {

  constructor(private http: HttpClient){}


	getOldBSS() : Promise<Array<OldBSSData>> {
		return lastValueFrom(this.http.get<Array<OldBSSData>>("osur/getoldBSS"));
	}

	getCorrespondanceBSS() : Promise<Array<CorrespondancesBSSData>>{
		return lastValueFrom(this.http.get<Array<CorrespondancesBSSData>>("osur/getcorrespondanceBSS"));
	}

	getdataGDFWatersheds(): Promise<Array<GDFWatershedsData>> {
		return lastValueFrom(this.http.get<Array<GDFWatershedsData>>("osur/GetGDFWatersheds"));
	  }
	
	getdataDFF() : Promise<Array<DFFData>>{
		return lastValueFrom(this.http.get<Array<DFFData>>("osur/getdff"));
	}

	gedataGDFStations(): Promise<Array<GDFStationData>>{
		return lastValueFrom(this.http.get<Array<GDFStationData>>("osur/GetGDFStations"));
	}

	getdataGDFPiezometry() : Promise<Array<GDFPiezometryData>>{
		return lastValueFrom(this.http.get<Array<GDFPiezometryData>>("/osur/getGDFPiezometry"));
	}

	getStationDischargeData(id: string): Promise<Array<StationDischargedata>> {
		const url = `/osur/stationDischarge/${id}`;
		return lastValueFrom(this.http.get<Array<StationDischargedata>>(url));
	}

	// getPrevisionGraphData(selectedStation: string, sliderValue: number, simulationDate: string):Observable<any>  {
	// 	const params = new HttpParams()
	// 	  .set('watershed', selectedStation)
	// 	  .set('sliderValue', sliderValue.toString())
	// 	  .set('simulationDate', simulationDate);
	
	// 	return this.http.get<any>('http://localhost:5000/getGraph', { params });
	//   }	
	
	runSimulation(params: any): Observable<any> {
	return this.http.post<any>('http://localhost:5000/api/get_run_cydre', params);
	}
	
	getResults(taskId: string): Observable<any> {
		return timer(0, 5000).pipe(
		  switchMap(() => this.http.get<any>(`http://localhost:5000/api/results/${taskId}`)),
		  takeWhile(response => response.status === 'processing', true)
		);
	  }
	  
}
