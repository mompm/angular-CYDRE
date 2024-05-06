import { AfterViewInit, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from 'src/app/service/data.service';
import { XmlService } from 'src/app/service/xml.service';


@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent implements AfterViewInit {

  protected xmlNames: Array<string>;

  public constructor(private requestService: XmlService, private data: DataService, private router: Router){
    this.xmlNames = [];
  }

  public ngAfterViewInit(): void {
    console.log('coucou1');
     // we request all xml names
    this.requestService.getXmlNames()
    .then(names => {
      this.xmlNames = names;
      console.log('coucou');
    })
    .catch(err => {
      console.log('coucou eerrr');
      console.log(err);
    })
  }

  protected sendXmlName(){
    const e = document.getElementById("xml-select") as HTMLSelectElement;
    // we change the path of the request for the xml
    this.data.xmlPath = e.options[e.selectedIndex].text;
    this.router.navigateByUrl("/xmlView");
  }
}
