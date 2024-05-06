import { Component, OnInit } from '@angular/core';
import { XmlService } from 'src/app/service/xml.service';

@Component({
  selector: 'app-result',
  templateUrl: './result.component.html',
  styleUrls: ['./result.component.scss']
})
export class ResultComponent implements OnInit{ // manage the results display

  result: any;

  constructor(private service:XmlService){}

ngOnInit(): void {
  this.service.runCydre2().subscribe(
    response =>{
    this.result = response;
  },
  error => {
    console.error('Error:',error);
  }
  );
}

}

