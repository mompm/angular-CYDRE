import { Component, ViewEncapsulation,Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';


@Component({
  selector: 'app-selecteurLangue',
  templateUrl: './selecteurLangue.component.html',
  styleUrls: ['./selecteurLangue.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SelecteurLangueComponent{
    //variable isLoggedIn est récuperer dans le component navbar 
    @Input() isLoggedIn!: boolean;
    selectLang:string="";
    transLang : string[] =[];
  
    constructor(public translate: TranslateService){
      translate.setDefaultLang('FR');
      translate.addLangs(['EN', 'FR']);
      translate.use('FR');
      this.selectLang = translate.currentLang;
    }
  
    setTransLanguage(){
      this.translate.use(this.selectLang);
    }
  
    getTransLanguage(){
      this.transLang=[...this.translate.getLangs()];
    }
  
    ngOnInit(){
      this.getTransLanguage();
    }

  }