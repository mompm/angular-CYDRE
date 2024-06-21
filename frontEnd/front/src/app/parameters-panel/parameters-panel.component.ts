import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ParametersService } from '../service/parameters.service';

@Component({
  selector: 'app-parameters-panel',
  templateUrl: './parameters-panel.component.html',
  styleUrls: ['./parameters-panel.component.scss']
})
export class ParametersPanelComponent implements OnInit {
  dataForm!: FormGroup;
  possibleValues: any = {};
  @Output() parametersChanged = new EventEmitter<any>();

  constructor(private fb: FormBuilder, private parametersService: ParametersService) { }

  ngOnInit(): void {
    this.parametersService.getDefaultParameters().subscribe(data => {
      this.possibleValues = data;
      this.initializeForm(data);
    });
  }

  initializeForm(data: any): void {
    this.dataForm = this.fb.group({
      General: this.fb.group({
        datasets: [data.General.datasets.value, Validators.required],
        version: [data.General.version.value, Validators.required]
      }),
      Similarity: this.fb.group({
        recharge: this.createGroup(data.Similarity.recharge),
        runoff: this.createGroup(data.Similarity.runoff),
        specific_discharge: this.createGroup(data.Similarity.specific_discharge),
        water_table_depth: this.createGroup(data.Similarity.water_table_depth),
        spatial: this.fb.group({n_clusters :[data.Similarity.spatial.n_clusters.value, Validators.required]})
      }),
    });
  }

  createGroup(data: any): FormGroup {
    return this.fb.group({
      Calculation: this.fb.group({
        maximal_percentage: [data.Calculation.maximal_percentage.value, Validators.required],
        metric: [data.Calculation.metric.value, Validators.required],
        minimal_threshold: [data.Calculation.minimal_threshold.value, Validators.required],
        n_scenarios: [data.Calculation.n_scenarios.value, Validators.required],
        scale: [data.Calculation.scale.value, Validators.required],
        selection_method: [data.Calculation.selection_method.value, Validators.required]
      }),
      Time: this.fb.group({
        ndays_before_forecast: [data.Time.ndays_before_forecast.value, Validators.required],
        similarity_period_calculation: [data.Time.similarity_period_calculation.value, Validators.required],
        time_step: [data.Time.time_step.value, Validators.required]
      })
    });
  }

  saveParameters(): void {
    if (this.dataForm.valid) {
      this.parametersService.updateParameters(this.dataForm.value).subscribe(response => {
        console.log('Parameters updated', response);
      });
    } else {
      console.error('Form is not valid');
    }
  }

  getFormValues() {
    this.parametersChanged.emit(this.dataForm.value);
  }
  
}
