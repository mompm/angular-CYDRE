import { Component } from '@angular/core';
import { AuthService } from '../service/auth.service';
import { Router } from '@angular/router';
import { UsersService } from '../service/users.service';

@Component({
  selector: 'app-create-account',
  templateUrl: './create-account.component.html',
  styleUrls: ['./create-account.component.scss']
})
export class CreateAccountComponent {
  user = {
    username: '',
    password: '',
    role: ''
  };

  errorMessage: string | null = null;
  successMessage: string | null = null;


  constructor(public authService : AuthService, private router : Router, private usersService: UsersService){}
  ngOnInit() {
    // this.authService.isLogging = true;
  }

  onSubmit(form: any) {
    if (form.valid) {
      console.log('Form Data:', form.value);
      this.usersService.createUser(this.user).subscribe({
        next: (response) => {
          console.log('User created:', response);
          this.successMessage = 'User created successfully';
          this.errorMessage = null;
        },
        error: (error) => {
          console.error('Error creating user:', error);
          
          // Utiliser le code de statut HTTP pour déterminer le message d'erreur approprié
          if (error.status === 409) {
            this.errorMessage = 'Username already exists';
          } else if (error.status === 400) {
            this.errorMessage = 'Missing required fields';
          } else {
            this.errorMessage = error.message || 'An unexpected error occurred';
          }
          this.successMessage = null;
        }
      });
    } else {
      console.log('Form is not valid');
      this.errorMessage = 'Form is not valid';
      this.successMessage = null;
    }

    
    // this.router.navigateByUrl("");
    if(this.authService.isLoggedIn) console.log("User logged in");
  }

  addUser( username : string , password:string) {
    const newUser = { username: username, password: password, role: 'scientifique' };
    console.log("adding user :", newUser)
    this.usersService.createUser(newUser).subscribe({
      next: (response) => console.log(response),
      error: (error) => console.error(error)
    });
  }


}
