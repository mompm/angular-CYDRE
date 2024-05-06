import { Injectable } from '@angular/core';
import { Parameter, ParametersGroup } from '../model/parameters-group';
import { Parser,Builder} from 'xml2js';
import { XmlService } from './xml.service';
import { JsonService } from './json.service';
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
export class DataService { //service used to load the received xml and to convert it into json and vice versa

  private xmlData: string = ""; // variable to load the xml

  public xmlPath:string = ""; // path for the request of an xml

  constructor(private requestService: XmlService, private jsonService : JsonService) {}
  
  getMesurementCoordinates(): Promise<Array<StationsData>>{ // request the list of measurement points
    return this.jsonService.getCoordinates();
  }

  getMesurementOldBSS(): Promise<Array<OldBSSData>>{
    return this.jsonService.getOldBSS();
  }

  getMesurementCorrespondanceBSS(): Promise<Array<CorrespondancesBSSData>>{
    return this.jsonService.getCorrespondanceBSS();
  }

  getDatagdf(): Promise<Array<gdfData>> {
    return this.jsonService.getdatagdf();
  }

  getMesurementDFF(): Promise<Array<DFFData>>{
    return this.jsonService.getdataDFF();
  }

  getMesurementPiezoCoord(): Promise<Array<PiezoCoordData>>{
    return this.jsonService.getdataPiezoCoord();
  }

  getMesurementStationDischarge(id : string): Promise<Array<StationDischargedata>>{
    return this.jsonService.getStationDischargeData(id);
  }

  requestXml(){
	this.requestService.getXml(this.xmlPath)
    .then(xml=>{
		this.xmlData=xml;
		console.log(this.xmlData);
	})
    .catch(err=>{console.log(err)})
  }


  async parseXml(xmlString: string) {
    const parser = new Parser({
      "mergeAttrs": true,
    });
    return await new Promise((resolve, reject) => parser.parseString(xmlString, (err: any, jsonData: any) => {
      if (err) {
        reject(err);
      }
      resolve(jsonData);
    }));
  }

  public async getJSONData(): Promise<ParametersGroup> {
	return this.parseXml(this.xmlData)
	.then((res: any) => {
	  return res.ParametersGroup as ParametersGroup;
	})
	// .then(group => {
	// 	this.setParent(group);
	// 	return group;
	// });
  }

//   private setParent(param: ParametersGroup | Parameter, parent?: ParametersGroup): void {
// 	param.parent = parent;
// 	if(!("type" in param)) {
// 		param.ParametersGroup?.forEach(g => {
// 			this.setParent(g, param);
// 		});
// 		param.parameters?.forEach(sub => {
// 			this.setParent(sub, param);
// 		});
// 	}
//   }

  jsonToXml(json:any):string{ // convert the json to xml
	const options ={
		attrkey:"$",
		rootName: "ParametersGroup",
		headless: true,
	}
	const builder = new Builder(options);
	const xmlData = builder.buildObject(json);
	console.log(xmlData);
	return xmlData;
  }
}
