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
  title : string = 'DefaultTitle';

  constructor(private router: Router) {}
//les titres sont présents dans frontEnd/front/src/assets/i18n, ce sont les fichier EN.json et FR.json  
  ngOnInit(): void {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        //vérifie la page avec url 
        const currentRoute = this.router.url;
        switch (currentRoute) {
          case '/home': this.title = 'homeTitle'; break;
          case '/ficheSite' : this.title = 'ficheSiteTitle'; break;
          case '/settings': this.title = 'settingsTitle'; break;
          case '/login': this.title = 'loginTitle'; break;
          case '/modeling': this.title = 'modelingTitle'; break;
          default: this.title = 'DefaultTitle'; break;
        }
      }
    });
  }
}

