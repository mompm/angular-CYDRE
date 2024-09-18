import { Component, EventEmitter, OnInit, Input, Output } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ParametersService } from 'src/app/service/parameters.service';

@Component({
  selector: 'app-parameters-panel',
  templateUrl: './parameters-panel.component.html',
  styleUrls: ['./parameters-panel.component.scss']
})
export class ParametersPanelComponent implements OnInit {
  @Input() config: any = {}; // Configuration JSON pour les paramètres
  @Input() formGroup!: FormGroup; // Groupe de formulaires parent
  form: FormGroup = new FormGroup({}); // Formulaire pour les paramètres
  @Output() parametersChanged = new EventEmitter<any>(); // Événement émis lorsque les paramètres changent

  constructor(private parametersService: ParametersService, private fb: FormBuilder) {}

  ngOnInit(): void {
    if (this.config && this.formGroup) {
      this.form = this.formGroup;
    } else {
      this.parametersService.getDefaultParameters().subscribe(data => {
        this.config = data;
        console.log(this.config)
        this.form = this.buildForm(this.config);
  
        // Écoute les changements de valeurs et les émet
        this.form.valueChanges.subscribe(values => {
          this.parametersChanged.emit(values);
        });
      });
    }
  }
  

  // Crée un groupe de formulaires basé sur la configuration JSON
  buildForm(config: any): FormGroup {
    const group: any = {};

    for (const key in config) {
      if (this.isGroup(config[key])) {
        group[key] = this.buildForm(config[key]); // Appel récursif pour les groupes imbriqués
      } else {
        group[key] = new FormControl(config[key].value); // Crée un contrôle pour les paramètres individuels
      }
    }

    return this.fb.group(group);
  }

  // Soumet le formulaire et affiche les valeurs dans la console
  onSubmit(): void {
    console.log(this.form.value);
  }

  // Récupère les clés de l'objet JSON
  objectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  // Vérifie si un objet est un groupe
  isGroup(obj: any): boolean {
    return typeof obj === 'object' && !Array.isArray(obj) && !obj.hasOwnProperty('type');
  }

  // Récupère le groupe de formulaires pour une clé donnée
  getFormGroup(key: string): FormGroup | null {
    const control = this.form.get(key);
    return control instanceof FormGroup ? control : null;
  }

  // Sauvegarde les paramètres (méthode non utilisée actuellement)
  saveParameters(): void {
    if (this.form.valid) {
      this.parametersService.updateParameters(this.form.value).subscribe(response => {
        console.log('Parameters updated', response);
      });
    } else {
      console.error('Form is not valid');
    }
  }

  // Émet les valeurs du formulaire actuel
  getFormValues() {
    this.parametersChanged.emit(this.form.value);
  }

  // Détermine le type d'input à utiliser basé sur le type de paramètre
  getInputType(type: string): string {
    switch (type) {
      case 'int':
      case 'double':
        return 'number'; // Utilise un input de type "number" pour les entiers et les doubles
      case 'string':
      default:
        return 'text'; // Utilise un input de type "text" pour les chaînes de caractères
    }
  }

  // Détermine la valeur minimale pour un paramètre basé sur possible_values
  getMinValue(possibleValues: string[]): number | null {
    if (possibleValues && possibleValues.length && possibleValues[0] === '&gt;=0') {
      return 0; // Retourne 0 si possible_values contient ">=0"
    }
    return null;
  }
}
