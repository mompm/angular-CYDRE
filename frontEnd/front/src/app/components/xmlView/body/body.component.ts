import { Component, Input } from '@angular/core';
// import { Binding, PartialTextInputBinder, TreeUndoHistory, UndoableCommand, UndoableSnapshot } from 'interacto';
import { Parameter, ParametersGroup,  } from '../../../model/parameters-group'; //getFullPathParam

@Component({
  selector: 'app-body',
  templateUrl: './body.component.html',
  styleUrls: ['./body.component.scss']
})
export class BodyComponent {

  // @Input() in order to give the variable a value from the html
  @Input() parameters: Array<Parameter | ParametersGroup>;


  constructor() { //private history: TreeUndoHistory
    this.parameters = [];
  }

  isParameter(element: any): element is Parameter {
    return (element as any).description !== undefined;
  }

  existParamGroup(element: any): boolean {
    return (element as any).ParametersGroup !== undefined;

  }

  existParam(element: any): boolean {
    return (element as any).Parameter !== undefined;
  }

//   protected setParamChange(binder: PartialTextInputBinder, param: Parameter): Binding<any, any, any> {
//     return binder
//       .toProduce(() => new SetParam(param))
//       .then((c, i) => {
//         c.newvalue = [i.widget?.value ?? ""];
//       })
//       .bind();
//   }

//   public getChangedParams(): Array<Parameter> {
//     let node = this.history.currentNode;
//     const changed: Map<string, Parameter> = new Map();

//     while (node.parent !== undefined) {
//       const cmd = (node.undoable as SetParam);
//       const path = getFullPathParam(cmd.param).join("-");
//       if (!changed.has(path)) {
//         changed.set(path, cmd.param);
//       }
//       node = node.parent;
//     }

//     return [...changed.values()];
//   }
// }

// export class SetParam extends UndoableCommand {
//   public newvalue: Array<string>;

//   protected mementoValue: Array<string>;

//   public constructor(public readonly param: Parameter) {
//     super();
//     this.newvalue = [];
//     this.mementoValue = [];
//   }

//   protected override createMemento(): void {
//     this.mementoValue = this.param.value;
//   }

//   protected execution(): void {
//     this.param.value = this.newvalue;
//   }

//   public redo(): void {
//     this.execution();
//   }

//   public undo(): void {
//     this.param.value = this.mementoValue;
//   }

//   public override getVisualSnapshot(): UndoableSnapshot {
//     return `${getFullPathParam(this.param).join("->")} => ${this.newvalue}`;
//   }
}
