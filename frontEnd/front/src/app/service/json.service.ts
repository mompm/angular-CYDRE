import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {lastValueFrom } from 'rxjs';
import StationsData from '../model/StationsData';
import OldBSSData from '../model/OldBSSData';
import CorrespondancesBSSData from '../model/CorrespondanceBSSData';
import gdfData from '../model/gdfData';
import DFFData from '../model/DFFData';
import PiezoCoordData from '../model/PiezoCoordData';
import StationDischargedata from '../model/StationDischargedata';



@Injectable({
  providedIn: 'root'
})
export class JsonService {

  constructor(private http: HttpClient){}

	getCoordinates(): Promise<Array<StationsData>>{ 
		return lastValueFrom(this.http.get<Array<StationsData>>("osur/getCoordinates"));
	}

	getOldBSS() : Promise<Array<OldBSSData>> {
		return lastValueFrom(this.http.get<Array<OldBSSData>>("osur/getoldBSS"));
	}

	getCorrespondanceBSS() : Promise<Array<CorrespondancesBSSData>>{
		return lastValueFrom(this.http.get<Array<CorrespondancesBSSData>>("osur/getcorrespondanceBSS"));
	}

	getdatagdf(): Promise<Array<gdfData>> {
		return lastValueFrom(this.http.get<Array<gdfData>>("osur/getdatagdf"));
	  }
	
	getdataDFF() : Promise<Array<DFFData>>{
		return lastValueFrom(this.http.get<Array<DFFData>>("osur/getdff"));
	}

	getdataPiezoCoord() : Promise<Array<PiezoCoordData>>{
		return lastValueFrom(this.http.get<Array<PiezoCoordData>>("osur/getCoordpiezo"));
	}

	getStationDischargeData(id: string): Promise<Array<StationDischargedata>> {
		const url = `/osur/stationDischarge/${id}`;
		return lastValueFrom(this.http.get<Array<StationDischargedata>>(url));
	}

}
