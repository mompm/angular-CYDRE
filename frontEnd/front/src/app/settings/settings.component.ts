import { Component } from '@angular/core';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  //defin ngModel variables
  userNameOrg: string = "username";
  passwordOrg: string = "password";
  confirmPasswordOrg: string = "password";
  emailOrg: string = "insa@fr.com";
  firstNameOrg: string = "Le Hoang";
  lastNameOrg: string = "NGUYEN";
  orgNameOrg: string = "INSA";
  locationOrg: string = "Rennes";
  phoneNumberOrg : string = "02 34 56 78 90";
  birthdayOrg: string="05/10/2001";

  userName!: string;
  password!: string;
  confirmPassword!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  orgName!: string;
  location!: string;
  phoneNumber!: string;
  birthday!: string;

  constructor() { 
    this.userName = "username";
    this.password = "password";
    this.confirmPassword = "password";
    this.email = "insa@fr.com";
    this.firstName = "Le Hoang";
    this.lastName = "NGUYEN";
    this.orgName = "INSA";
    this.location = "Rennes";
    this.phoneNumber = "02 34 56 78 90";
    this.birthday = "05/10/2001";
  }
  discard(){
    this.userName = this.userNameOrg;
    this.password = this.passwordOrg;
    this.confirmPassword = this.confirmPasswordOrg;
    this.email = this.emailOrg;
    this.firstName = this.firstNameOrg;
    this.lastName = this.lastNameOrg;
    this.orgName = this.orgNameOrg;
    this.location = this.locationOrg;
    this.phoneNumber = this.phoneNumberOrg;
    this.birthday = this.birthdayOrg;
  }
}
