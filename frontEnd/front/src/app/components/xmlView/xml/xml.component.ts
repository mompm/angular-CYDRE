import { AfterViewInit, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { interactoTreeUndoProviders } from 'interacto-angular';
import { ParametersGroup } from 'src/app/model/parameters-group';
import { DataService } from 'src/app/service/data.service';
import { XmlService } from 'src/app/service/xml.service';


@Component({
  selector: 'app-xml',
  templateUrl: './xml.component.html',
  styleUrls: ['./xml.component.scss'],
  providers: [interactoTreeUndoProviders()]
})
export class XmlComponent implements AfterViewInit {

  parameters: ParametersGroup;

  constructor(private service: DataService,private requestService: XmlService, private router:Router){
    this.parameters = {name:[""]};
  }

  ngAfterViewInit(): void {
    // if the user chose an xml, request the xml
    if (this.service.xmlPath !="--Please choose an xml--" && this.service.xmlPath !=""){
      this.service.requestXml();
    }
  }

  parseIntoJson(){
    if (this.service.xmlPath !== "--Please choose an xml--" && this.service.xmlPath !=""){
      this.service.getJSONData() // load the xml parsed into JSON in parameters
      .then(data => {
        this.parameters = data;
        console.log(this.parameters);
      });
    }
  }


  convertFormat(input: any): any { //convert the format of the JSON to parse back into XML
    const attributes = ["name"];
    if (typeof input === "object") {
      const attributePairs: { [key: string]: string } = {};
      const result: any = {};

      for (const [key, value] of Object.entries(input)) { //go through all the elements
        if (attributes.includes(key)) {
          attributePairs[key] = value as string;
        } else if (Array.isArray(value)) {
          const newArray = value.map(item => this.convertFormat(item));
          result[key] = newArray;
        } else if (typeof value === "object") {
          result[key] = this.convertFormat(value);
        } else {
          result[key] = value;
        }
      }

      if (Object.keys(attributePairs).length > 0) {
        if (result["$"]) {
          Object.assign(result["$"], attributePairs);
        } else {
          result["$"] = attributePairs;
        }
      }

      return result;
    }
    return input;
  }



  runCydre(){
    //this.requestService.runCydre(this.service.jsonToXml(this.convertFormat(this.parameters))); // send modified xml (use api in backEnd)
    this.router.navigateByUrl("/result"); // go to result to launch the app (use with cydre project)
  }

}
