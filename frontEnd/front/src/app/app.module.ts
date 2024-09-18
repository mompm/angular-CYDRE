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
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HeaderComponent } from './header/header.component';
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
// Start of Hoang module
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { TabViewModule } from 'primeng/tabview';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FooterComponent } from './footer/footer.component';
import { Documentation } from './documentation/documentation'; 
import { MatSliderModule } from '@angular/material/slider';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTreeNestedDataSource, MatTreeModule} from '@angular/material/tree';
import {MatIconModule} from "@angular/material/icon";
import { MatTooltipModule } from '@angular/material/tooltip';
import {MatButtonModule} from "@angular/material/button";
import {MatTableModule} from "@angular/material/table";
import { MatTabsModule } from '@angular/material/tabs';
import {MatStepperModule} from '@angular/material/stepper';
import {MatSelectModule} from "@angular/material/select";
import { MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { CreateAccountComponent } from './create-account/create-account.component';
import { SimulateurCydreComponent } from './Simulateur/simulateur-cydre/simulateur-cydre.component';
import { AnalyseDeSensibiliteComponent } from './analyse-de-sensibilite/analyse-de-sensibilite.component'; 
import { NgxSliderModule } from '@angular-slider/ngx-slider';
import { SimulationResultsComponent } from './Simulateur/simulation-results/simulation-results.component';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { PlotlyModule } from 'angular-plotly.js';
import * as PlotlyJS from 'plotly.js-dist';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {AsyncPipe} from '@angular/common';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import { SimulationHistoryComponent } from './simulation-history/simulation-history.component';
import { ParametersPanelComponent } from './parameters-panel/parameters-panel.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { TypologyMapComponent } from './ficheSite/typology-map/typology-map.component';
import { TooltipModule } from 'primeng/tooltip';




// End of Hoang module
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http);
}

PlotlyModule.plotlyjs = PlotlyJS;

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    HeaderComponent,
    SelecteurLangueComponent,
    FicheSiteComponent,
    RegionalMapComponent,
    WatershedMapComponent,
    hydrographGlobal,
    hydrographSeasonal,
    temperatureSeasonal,
    WaterTableDepthSeasonal,
    precipitationSeasonal,
    LoginComponent,
    FooterComponent,
    Documentation,
    CreateAccountComponent,
    SimulateurCydreComponent,
    AnalyseDeSensibiliteComponent,
    SimulationResultsComponent,
    SimulationHistoryComponent,
    ParametersPanelComponent,
    TypologyMapComponent,
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
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatButtonModule,
    MatTableModule,
    MatStepperModule,
    MatSelectModule,
    MatDialogModule,
    MatTooltipModule,
    MatExpansionModule,
    MatMenuModule,
    MatSlideToggleModule,
    NgxSliderModule,
    NgxChartsModule,
    PlotlyModule,
    MatAutocompleteModule,
    AsyncPipe,
    MatInputModule,
    MatFormFieldModule,
    MatTabsModule,
    TooltipModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
