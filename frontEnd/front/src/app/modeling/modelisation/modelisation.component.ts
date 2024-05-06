import { Component } from '@angular/core';
import {FlatTreeControl} from '@angular/cdk/tree';
import {MatTreeFlatDataSource, MatTreeFlattener} from '@angular/material/tree';


interface FoodNode {
  type?: boolean;
  name: string;
  children?: FoodNode[];
}

const TREE_DATA: FoodNode[] = [
  {
    name: 'Cydre',
    children: [
      {
        name: 'Files',
        children: [{ name: 'datasets', type: false}]
      },
      {
        name: 'ForecastInputs',
        children: [
          {
            name: 'watershed_target_id',
            type: true,
          },
          {
            name: 'forecast_horizon',
            type: true,
          }
        ]
      },
      {
        name: 'Similarity',
        children: [
          {
            name: 'specific_discharge',
            children: [
              {
                name: 'calculation',
                type: false,
              },
              {
                name: 'selection',
                type: true,
              }
            ]
          },
          {
            name: 'recharge',
            children: [
              {
                name: 'calculation',
                type: false,
              },
              {
                name: 'selection',
                type: true,
              }
            ]
          },
          {
            name: 'runoff',
            children: [
              {
                name: 'calculation',
                type: false,
              },
              {
                name: 'selection',
                type: true,
              }
            ]
          }
        ]
      },
      {
        name: 'TimeManagement',
        children: [
          {
            name: 'similarity_period',
            type: false,
          },
          {
            name: 'ndays_before_forecast',
            type: false,
          },
          {
            name: 'time_step',
            type: false,
          }
        ]
      },
    ],
  },

];

/** Flat node with expandable and level information */
interface ExampleFlatNode {
  expandable: boolean;
  name: string;
  level: number;
}
@Component({
  selector: 'app-modelisation',
  templateUrl: './modelisation.component.html',
  styleUrls: ['./modelisation.component.scss']
})
export class ModelisationComponent {
  selected = 'none';

  private _transformer = (node: FoodNode, level: number) => {
    return {
      expandable: !!node.children && node.children.length > 0,
      name: node.name,
      level: level,
    };
  };

  treeControl = new FlatTreeControl<ExampleFlatNode>(
    node => node.level,
    node => node.expandable,
  );

  treeFlattener = new MatTreeFlattener(
    this._transformer,
    node => node.level,
    node => node.expandable,
    node => node.children,
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  constructor() {
    this.dataSource.data = TREE_DATA;
  }

  hasChild = (_: number, node: ExampleFlatNode) => node.expandable;
  formatLabel(value: number): string {
    if (value >= 1000) {
      return Math.round(value / 1000) + 'k';
    }

    return `${value}`;
  }

  getTypeForName(node: FoodNode, targetName: string): boolean | undefined {
    if (node.name === targetName) {
      return node.type;
    } else if (node.children) {
      for (const child of node.children) {
        const result = this.getTypeForName(child, targetName);
        if (result !== undefined) {
          return result;
        }
      }
    }
    return undefined;
  }
  log(val: boolean | undefined){
    //console.log(val);
  }

  protected readonly TREE_DATA = TREE_DATA;
}
