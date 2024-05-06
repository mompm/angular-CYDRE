import {Component, ElementRef, OnInit} from '@angular/core';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-ressource',
  templateUrl: './ressource.component.html',
  styleUrls: ['./ressource.component.scss']
})
export class RessourceComponent implements OnInit {

  constructor(private elementRef: ElementRef) { }

  ngOnInit(): void {
    this.createChart();
  }
  public chart: any;

  createChart(){
    let htmlRef = this.elementRef.nativeElement.querySelector('#MyChart');

    this.chart = new Chart(htmlRef, {
      type: 'line', //this denotes tha type of chart

      data: {// values on X-Axis
        labels: ['2022-05-10', '2022-05-11', '2022-05-12','2022-05-13',
          '2022-05-14', '2022-05-15', '2022-05-16','2022-05-17', ],
        datasets: [
          {
            label: "J0014010",
            data: ['467','576', '572', '79', '92',
              '574', '573', '800'],
            backgroundColor: '#fb7756'
          },
          {
            label: "J0121510",
            data: ['542', '542', '536', '327', '17',
              '0.00', '538', '541'],
            backgroundColor: '#fdfa66'
          },
          {
            label: "J0144010",
            data: ['243', '751', '645', '221', '31',
              '500', '400', '123'],
            backgroundColor: '#facd60'
          }
        ]
      },
      options: {
        aspectRatio:2.5
      }

    });
  }

}
