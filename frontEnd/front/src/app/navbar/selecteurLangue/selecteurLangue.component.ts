import { Component, ViewEncapsulation,Input } from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import {MatTabsModule} from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';


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
  
    constructor(public translate: TranslateService, public dialog : MatDialog){
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


