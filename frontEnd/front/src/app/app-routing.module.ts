import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import {LocalisationComponent} from "./modeling/localisation/localisation.component";
import {ModelisationComponent} from "./modeling/modelisation/modelisation.component";
import { FicheSiteComponent } from './ficheSite/ficheSite.component';
import { CreateAccountComponent } from './create-account/create-account.component';
import { AuthGuard } from './service/auth.guard';
import { SimulateurCydreComponent } from './Simulateur/simulateur-cydre/simulateur-cydre.component';
import { AnalyseDeSensibiliteComponent } from './analyse-de-sensibilite/analyse-de-sensibilite.component';
import { SimulationHistoryComponent } from './simulation-history/simulation-history.component';

const routes: Routes = [ //indicate which component to load depending on the path
  { path: 'ficheSite', component: FicheSiteComponent },
  { path: 'login', component: LoginComponent},
  { path: 'create-account', component: CreateAccountComponent, canActivate: [AuthGuard], data: {checkType : 'dev'} },
  { path: 'simulator', component: SimulateurCydreComponent},
  { path: 'simulationHistory', component: SimulationHistoryComponent,canActivate: [AuthGuard], data: {checkType : 'log'}},
  { path: 'analysis', component:AnalyseDeSensibiliteComponent, canActivate: [AuthGuard], data: {checkType : 'sci'} },
  { path: '**', redirectTo: '/ficheSite', pathMatch: 'full'}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
