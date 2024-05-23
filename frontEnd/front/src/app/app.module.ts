import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { TreeTableModule } from 'primeng/treetable';
import { ButtonModule } from 'primeng/button';
import { InteractoModule } from 'interacto-angular';
import { HomeComponent } from './home/home.component';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HeaderComponent } from './header/header.component';
import { ModelingComponent } from './modeling/modeling.component';
import { SettingsComponent } from './settings/settings.component';
import { LoginComponent } from './login/login.component';
import { InputTextModule } from 'primeng/inputtext';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NavbarComponent } from './navbar/navbar.component';
import { SelecteurLangueComponent } from './selecteurLangue/selecteurLangue.component';
import { FicheSiteComponent } from './ficheSite/ficheSite.component';
import { RegionalMapComponent } from './ficheSite/RegionalMap/RegionalMap.component';
import { WatershedMapComponent } from './ficheSite/WatershedMap/WatershedMap.component';
import { hydrographGlobal } from './ficheSite/hydrographGlobal/hydrographGlobal.component';
import { hydrographSeasonal } from './ficheSite/hydrographSeasonal/hydrographSeasonal.component';
import { temperatureSeasonal } from './ficheSite/temperatureSeasonal/temperatureSeasonal.component';
import { WaterTableDepthSeasonal } from './ficheSite/WaterTableDepthSeasonal/WaterTableDepthSeasonal.component';
import { precipitationSeasonal } from './ficheSite/precipitationSeasonal/precipitationSeasonal.component';
import { Simulateur} from './Simulateur/Simulateur.component';
// Start of Hoang module
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { LocalisationComponent } from './modeling/localisation/localisation.component';
import { ModelisationComponent } from './modeling/modelisation/modelisation.component';
import { TabViewModule } from 'primeng/tabview';
import { HistoriqueComponent } from './modeling/historique/historique.component';
import { PrevisionComponent } from './modeling/prevision/prevision.component';
import { RessourceComponent } from './modeling/ressource/ressource.component';
import { MapComponent } from './modeling/localisation/map/map.component';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FooterComponent } from './footer/footer.component';
import { MatSliderModule } from '@angular/material/slider';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTreeNestedDataSource, MatTreeModule} from '@angular/material/tree';
import {MatIconModule} from "@angular/material/icon";
import {MatButtonModule} from "@angular/material/button";
import {MatTableModule} from "@angular/material/table";
import {MatStepperModule} from '@angular/material/stepper';
import {MatSelectModule} from "@angular/material/select";
import { MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {AsyncPipe} from '@angular/common';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';


// End of Hoang module
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http);
}

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    HeaderComponent,
    HomeComponent,
    ModelingComponent,
    SelecteurLangueComponent,
    FicheSiteComponent,
    RegionalMapComponent,
    WatershedMapComponent,
    hydrographGlobal,
    hydrographSeasonal,
    temperatureSeasonal,
    WaterTableDepthSeasonal,
    Simulateur,
    precipitationSeasonal,
    SettingsComponent,
    LoginComponent,
    LocalisationComponent,
    ModelisationComponent,
    HistoriqueComponent,
    PrevisionComponent,
    RessourceComponent,
    MapComponent,
    FooterComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TreeTableModule,
    InteractoModule,
    DropdownModule,
    InputSwitchModule,
    SelectButtonModule,
    TabViewModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    }),
    MatSliderModule,
    MatProgressSpinnerModule,
    MatTreeModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatStepperModule,
    MatSelectModule,
    MatDialogModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
    AsyncPipe,
    MatInputModule,
    MatFormFieldModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
