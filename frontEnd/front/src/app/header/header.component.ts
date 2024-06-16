import { Component, ViewEncapsulation , Input, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

//configuration element
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class HeaderComponent implements OnInit{
  //variable isLoggedIn est récuperer dans le component navbar 
  @Input() isLoggedIn!: boolean;
  subtitle : string = 'DefaultTitle';

  constructor(private router: Router) {}
//les titres sont présents dans frontEnd/front/src/assets/i18n, ce sont les fichier EN.json et FR.json  
  ngOnInit(): void {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        //vérifie la page avec url 
        const currentRoute = this.router.url;
        switch (currentRoute) {
          case '/home': this.subtitle = 'homeTitle'; break;
          case '/ficheSite' : this.subtitle = 'ficheSitesubTitle'; break;
          case '/settings': this.subtitle = 'settingsTitle'; break;
          case '/login': this.subtitle = 'loginTitle'; break;
          case '/modeling': this.subtitle = 'modelingTitle'; break;
          case '/simulator':this.subtitle = 'simulatorsubTitle';break;
          case '/analysis':this.subtitle = 'analysisTitle';break;
          case '/simulationHistory':this.subtitle = 'Mes simulations';break;

          default: this.subtitle = 'DefaultTitle'; break;
        }
      }
    });
  }
}

