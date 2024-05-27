import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { SettingsComponent } from './settings/settings.component';
import { LoginComponent } from './login/login.component';
import { ModelingComponent } from "./modeling/modeling.component";
import {LocalisationComponent} from "./modeling/localisation/localisation.component";
import {ModelisationComponent} from "./modeling/modelisation/modelisation.component";
import { FicheSiteComponent } from './ficheSite/ficheSite.component';
import { CreateAccountComponent } from './create-account/create-account.component';
import { AuthGuard } from './service/auth.guard';
import { SimulateurCydreComponent } from './simulateur-cydre/simulateur-cydre.component';
import { AnalyseDeSensibiliteComponent } from './analyse-de-sensibilite/analyse-de-sensibilite.component';
import { Simulateur } from './Simulateur/Simulateur.component';

const routes: Routes = [ //indicate which component to load depending on the path
  { path: 'home', component: HomeComponent },
  { path: 'ficheSite', component: FicheSiteComponent },
  { path: 'Simulateur', component: Simulateur},
  { path: 'modeling',
    component: ModelingComponent,
    children: [
      {path: 'localisation', component: LocalisationComponent},
      {path: 'modelisation', component: ModelisationComponent},
    ]
  },
  { path: 'settings', component: SettingsComponent },
  { path: 'login', component: LoginComponent},
  { path: 'create-account', component: CreateAccountComponent, canActivate: [AuthGuard] },
  { path: 'simulator', component: SimulateurCydreComponent},
  { path: 'analysis', component:AnalyseDeSensibiliteComponent },
  { path: '**', redirectTo: '/home', pathMatch: 'full'}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
